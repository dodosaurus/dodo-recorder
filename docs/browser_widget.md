# Browser Recording Widget

## Overview

Floating UI control in browser window during recording sessions. Provides pause/resume, screenshot capture, and assertion mode without interfering with page content.

**Design Principles:** Shadow DOM isolation, widget interactions never recorded, draggable with edge snapping, keyboard shortcut alternatives.

---

## Architecture

### Injection

Widget injected via Playwright's [`page.addInitScript()`](../electron/browser/recorder.ts:215):

```typescript
// Two-phase injection (string concatenation to avoid nested template literal issues)
await this.page.addInitScript('window.__dodoCreateWidget = ' + getWidgetScript().toString())
await this.page.addInitScript(getWidgetInitScript())
```

Ensures widget code available before page scripts, works with SPAs, survives navigation.

### Shadow DOM Isolation

```typescript
const widgetHost = document.createElement('div')
widgetHost.id = '__dodo-recorder-widget-host'
widgetHost.style.cssText = 'position: fixed; z-index: 2147483647; pointer-events: none;'
widgetHost.setAttribute('data-dodo-recorder', 'true')  // Mark as non-React element
const shadow = widgetHost.attachShadow({ mode: 'closed' })
```

**Benefits:** Complete CSS isolation, page cannot affect widget styling, protection from page JavaScript.

**Structure:**
```
<div id="__dodo-recorder-widget-host" style="position: fixed; z-index: 2147483647; pointer-events: none;">
  #shadow-root (closed)
    <style>...</style>
    <div class="dodo-widget" style="position: fixed; top: 20px; right: 20px;">
      <button id="pause-resume-btn" class="widget-btn">...</button>
      <button id="screenshot-btn" class="widget-btn">...</button>
      <button id="assertion-btn" class="widget-btn">...</button>
      <div id="voice-indicator" class="voice-indicator"></div>
    </div>
</div>
```

---

## Features

### 1. Pause/Resume Button

**Visual:** Pause icon (two vertical bars) when recording, play icon (triangle) when paused.

**Behavior:**
- Pauses all action recording (clicks, inputs, navigation, screenshots, assertions)
- Pauses audio recording via MediaRecorder.pause()
- Disables screenshot and assertion buttons while paused
- Excluded time from elapsed timer
- Communicates state changes to main app via IPC events

**Implementation:**
```typescript
pauseResumeBtn.addEventListener('click', async (e) => {
  e.stopPropagation()

  const win = window as unknown as DodoWindow
  const isPaused = win.__dodoRecordingPaused === true

  try {
    if (isPaused) {
      // Resume
      if (typeof win.__dodoResumeRecording === 'function') {
        await win.__dodoResumeRecording()
        pauseResumeBtn.innerHTML = `<svg>...pause icon...</svg>`
        pauseResumeTooltip.textContent = 'Pause Recording'
        // Re-enable other buttons
        screenshotBtn.disabled = false
        assertionBtn.disabled = false
      }
    } else {
      // Pause
      if (typeof win.__dodoPauseRecording === 'function') {
        await win.__dodoPauseRecording()
        pauseResumeBtn.innerHTML = `<svg>...play icon...</svg>`
        pauseResumeTooltip.textContent = 'Resume Recording'
        // Disable other buttons while paused
        screenshotBtn.disabled = true
        assertionBtn.disabled = true
      }
    }
  } catch (error) {
    console.error('[Dodo Widget] Pause/Resume failed:', error)
  }
})
```

**State Management:**
- Main process sets `window.__dodoRecordingPaused` via `page.evaluate()`
- Widget button enables/disables based on pause state
- Injected script checks pause state before recording actions

### 2. Screenshot Button

**Visual:** Camera icon (22x22px), dark gray body, multi-layered lens, flash animation on capture.

**Implementation:**
```typescript
screenshotBtn.addEventListener('click', async (e) => {
  e.stopPropagation()

  screenshotBtn.classList.add('flash')
  setTimeout(() => screenshotBtn.classList.remove('flash'), 300)

  try {
    const screenshotPath = await takeScreenshot()
    if (screenshotPath) {
      recordAction(JSON.stringify({
        type: 'screenshot',
        screenshot: screenshotPath,
      }))
    }
  } catch (error) {
    console.error('[Dodo Widget] Screenshot failed:', error)
  }
})
```

**Keyboard shortcut:** Cmd/Ctrl+Shift+S (handled in injected-script.ts, blocked while paused)

### 3. Assertion Button

**Visual:** Eye icon with iris/pupil rendering, blue-tinted when active.

**State Management:**
```typescript
let assertionModeActive = false

assertionBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  assertionModeActive = !assertionModeActive

  if (assertionModeActive) {
    assertionBtn.classList.add('active')
  } else {
    assertionBtn.classList.remove('active')
  }
})

// Expose to injected script
window.__dodoAssertionMode = () => assertionModeActive
window.__dodoDisableAssertionMode = () => {
  assertionModeActive = false
  assertionBtn.classList.remove('active')
}
```

**Keyboard shortcut:** Cmd/Ctrl+Click (handled in injected-script.ts, blocked while paused)

### 4. Voice Recording Indicator

**Visual:** 10px red pulsing dot, positioned after assertion button.

**Implementation:**
```css
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

.voice-indicator {
  width: 10px;
  height: 10px;
  background: #ef4444;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}
```

**State sync:** Main process sets `window.__dodoAudioActive` via [`page.evaluate()`](../electron/browser/recorder.ts:306-317). The indicator shows/hides based on this global variable - no polling interval. Hidden while paused.

### 5. Drag and Drop

```typescript
let isDragging = false
let dragStartX = 0
let dragStartY = 0
let widgetStartX = 0
let widgetStartY = 0

widget.addEventListener('mousedown', (e) => {
  // Only start drag if clicking on widget body, not buttons
  if (e.target !== widget && !widget.contains(e.target as Node)) return

  isDragging = true
  widget.classList.add('dragging')

  const pos = getWidgetPosition()
  dragStartX = e.clientX
  dragStartY = e.clientY
  widgetStartX = pos.x
  widgetStartY = pos.y

  e.preventDefault()
})

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return

  const deltaX = e.clientX - dragStartX
  const deltaY = e.clientY - dragStartY

  const newX = widgetStartX + deltaX
  const newY = widgetStartY + deltaY

  setWidgetPosition(newX, newY)
})

document.addEventListener('mouseup', () => {
  if (!isDragging) return

  isDragging = false
  widget.classList.remove('dragging')

  // Snap to nearest edge
  snapToEdge()
})
```

### 6. Edge Snapping

After drag release, widget snaps to nearest edge (top/right/bottom/left) with 20px padding and cubic-bezier animation (0.3s).

```typescript
const snapToEdge = () => {
  const pos = getWidgetPosition()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // Calculate distances to each edge
  const distToTop = pos.y
  const distToBottom = viewportHeight - (pos.y + pos.height)
  const distToLeft = pos.x
  const distToRight = viewportWidth - (pos.x + pos.width)

  // Find minimum distance
  const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight)

  // Snap to nearest edge with padding
  const padding = 20
  let newX = pos.x
  let newY = pos.y

  if (minDist === distToTop) {
    newY = padding
  } else if (minDist === distToBottom) {
    newY = viewportHeight - pos.height - padding
  } else if (minDist === distToLeft) {
    newX = padding
  } else if (minDist === distToRight) {
    newX = viewportWidth - pos.width - padding
  }

  // Apply snapping animation
  widget.classList.add('snapping')
  setWidgetPosition(newX, newY)

  setTimeout(() => {
    widget.classList.remove('snapping')
  }, 300)
}
```

---

## Styling

**Color Palette:**
- Background: `rgba(10, 10, 11, 0.95)`
- Border: `rgba(255, 255, 255, 0.1)`
- Button hover: `rgba(255, 255, 255, 0.12)`
- Active state: `rgba(59, 130, 246, 0.25)`
- Shadow: `0 4px 12px rgba(0, 0, 0, 0.3)`
- Voice indicator: `#ef4444` (red)

**Spacing:** 8px widget padding, 8px button gap, 40x40px button minimum

**Transitions:** 0.2s opacity, 0.3s snap animation (cubic-bezier), 0.2s SVG colors

**Tooltips:**
- Appear on hover with 0.5s delay
- Black background with white text
- Positioned below buttons

---

## Hover Highlighter

The hover highlighter provides visual feedback during assertion mode, showing element boundaries and selector information.

### Features

**Dual Trigger Mode:**
- Widget button toggle (persistent mode)
- Cmd/Ctrl modifier key (transient mode)

**Visual Feedback:**
- Semi-transparent blue overlay (`rgba(59, 130, 246, 0.2)`)
- Solid border outline for clear boundaries
- Label showing element selector (testId, id, role, type, name, or text)

**Performance Optimizations:**
- RAF (requestAnimationFrame) throttling for overlay updates
- Passive event listeners for mousemove
- Scroll handler to update overlay position during scroll

### Implementation

**Shadow DOM Isolation:**
```typescript
const highlightHost = document.createElement('div')
highlightHost.id = '__dodo-highlight-overlay-host'
highlightHost.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2147483646;
`
const shadow = highlightHost.attachShadow({ mode: 'closed' })
```

**Assertion Mode Check:**
```typescript
function isAssertionModeActive(): boolean {
  const widgetMode = win.__dodoAssertionMode?.() || false
  const keyMode = isCommandKeyPressed
  return widgetMode || keyMode
}
```

**Event Handlers:**
- `mousemove` - Shows overlay on hover when assertion mode is active
- `keydown` - Activates transient mode on Cmd/Ctrl press
- `keyup` - Deactivates transient mode on key release
- `blur` - Cleans up key state on window focus loss
- `scroll` - Updates overlay position during scroll
- Periodic check (100ms) - Ensures overlay state matches assertion mode

**Element Label Generation:**
Priority order for selector display:
1. `[data-testid="..."]` - Test ID attributes
2. `#id` - Element ID
3. `tagName[role="..."]` - ARIA role
4. `input[type="..."]` - Input type
5. `[name="..."]` - Name attribute
6. `tagName:text("...")` - Text content (buttons, links)
7. `tagName` - Fallback to tag name

---

## Integration

### Preventing Widget Recording

```typescript
// In injected-script.ts
const WIDGET_HOST_ID = '__dodo-recorder-widget-host'

const isWithinWidget = (target: Element): boolean => {
  const widgetHost = document.getElementById(WIDGET_HOST_ID)
  return !!(widgetHost && (widgetHost.contains(target) || widgetHost === target))
}

// All event listeners check before recording
document.addEventListener('click', (e) => {
  if (isWithinWidget(e.target as Element)) return
  // Record action...
})
```

The hover highlighter also checks for widget exclusion:

```typescript
function isWithinWidget(element: Element): boolean {
  let current: Element | null = element
  while (current) {
    if (
      current.id === '__dodo-recorder-widget-host' ||
      current.id === '__dodo-highlight-overlay-host'
    ) {
      return true
    }
    // Check shadow host
    const root = current.getRootNode()
    if (root instanceof ShadowRoot) {
      current = root.host as Element
    } else {
      current = current.parentElement
    }
  }
  return false
}
```

### Communication

**Widget → Injected Script:**
```typescript
window.__dodoAssertionMode = () => assertionModeActive
window.__dodoDisableAssertionMode = () => { ... }
```

**Widget → Recorder:**
```typescript
// Exposed by recorder via page.exposeFunction()
const recordAction = window.__dodoRecordAction
const takeScreenshot = window.__dodoTakeScreenshot
const pauseRecording = window.__dodoPauseRecording
const resumeRecording = window.__dodoResumeRecording
```

**Recorder → Widget:**
```typescript
// Audio activity state and pause state
await this.page.evaluate((isActive) => {
  const win = window as any
  win.__dodoAudioActive = isActive
  win.__dodoRecordingPaused = false  // Set pause state

  if (isActive && typeof win.__dodoShowEqualizer === 'function') {
    win.__dodoShowEqualizer()
  }

  if (!isActive && typeof win.__dodoHideEqualizer === 'function') {
    win.__dodoHideEqualizer()
  }
}, active)
```

**Widget → Main App (via IPC):**
```typescript
// Pause/resume triggered from widget notifies main app
mainWindow.webContents.send('recording-state-changed', { status: 'paused' })
mainWindow.webContents.send('recording-state-changed', { status: 'recording' })
```

---

## Technical Requirements

### Self-Contained Code

Widget code serialized and injected as string, must be completely self-contained:

**✅ Allowed:**
- ES6+ syntax, TypeScript interfaces (compiled away)
- Window API, DOM manipulation

**❌ Not allowed:**
- External imports (`import { x } from 'y'`)
- Node.js modules
- Module-level variables

**Correct pattern:**
```typescript
export function getWidgetScript(): () => void {
  return () => {
    // ✅ Constants INSIDE function
    const WIDGET_HOST_ID = '__dodo-recorder-widget-host'
    interface DodoWindow extends Window { ... }
    // All logic self-contained
  }
}
```

### Duplicate Prevention

```typescript
// Widget
if (document.getElementById(WIDGET_HOST_ID)) {
  console.log('[Dodo Recorder] Widget already exists, skipping creation')
  return
}

// Hover highlighter
if (document.getElementById('__dodo-highlight-overlay-host')) {
  if (DEBUG) console.log('[Dodo Highlighter] Already initialized, skipping')
  return
}
```

Prevents multiple widgets on page reload, conflicts with SPA routes, memory leaks.

### Initialization Timing

Both widget and highlighter use a two-stage initialization pattern:

```typescript
export function getWidgetInitScript(): () => void {
  return () => {
    const initWidget = () => {
      try {
        const checkBodyAndCreate = () => {
          if (document.body && typeof (window as any).__dodoCreateWidget === 'function') {
            (window as any).__dodoCreateWidget()
          } else {
            setTimeout(checkBodyAndCreate, 50)
          }
        }

        // Small delay to ensure page scripts have loaded
        setTimeout(checkBodyAndCreate, 100)
      } catch (error) {
        console.error('[Dodo Recorder] Failed to create widget:', error)
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initWidget)
    } else {
      initWidget()
    }
  }
}
```

This ensures the widget/highlighter is created after the document body is available and works with both synchronous and asynchronous page loads.

---

## Implementation Files

| File | Purpose | Lines |
|------|---------|-------|
| [`electron/browser/recording-widget.ts`](../electron/browser/recording-widget.ts) | Widget implementation | ~465 |
| [`electron/browser/hover-highlighter.ts`](../electron/browser/hover-highlighter.ts) | Hover highlighter | ~400 |
| [`electron/browser/injected-script.ts`](../electron/browser/injected-script.ts) | Event recording + exclusion | ~390 |
| [`electron/browser/recorder.ts`](../electron/browser/recorder.ts) | Widget injection | ~340 |

**Key Functions:**
- [`getWidgetScript()`](../electron/browser/recording-widget.ts:12) - Widget creation
- [`getWidgetInitScript()`](../electron/browser/recording-widget.ts:438) - Initialization wrapper
- [`getHighlighterScript()`](../electron/browser/hover-highlighter.ts:36) - Highlighter creation
- [`getHighlighterInitScript()`](../electron/browser/hover-highlighter.ts:370) - Highlighter initialization
- [`isWithinWidget()`](../electron/browser/injected-script.ts:258) - Exclusion check
