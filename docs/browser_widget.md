# Browser Recording Widget

## Overview

Floating UI control in browser window during recording sessions. Provides screenshot capture and assertion mode without interfering with page content.

**Design Principles:** Shadow DOM isolation, widget interactions never recorded, draggable with edge snapping, keyboard shortcut alternatives.

---

## Architecture

### Injection

Widget injected via Playwright's [`page.addInitScript()`](../electron/browser/recorder.ts:83):

```typescript
// Two-phase injection
await this.page.addInitScript(`window.__dodoCreateWidget = ${getWidgetScript().toString()}`)
await this.page.addInitScript(getWidgetInitScript())
```

Ensures widget code available before page scripts, works with SPAs, survives navigation.

### Shadow DOM Isolation

```typescript
const widgetHost = document.createElement('div')
widgetHost.id = '__dodo-recorder-widget-host'
const shadow = widgetHost.attachShadow({ mode: 'closed' })
```

**Benefits:** Complete CSS isolation, page cannot affect widget styling, protection from page JavaScript.

**Structure:**
```
<div id="__dodo-recorder-widget-host">
  #shadow-root (closed)
    <style>...</style>
    <div class="dodo-widget">
      <button>...</button>
    </div>
</div>
```

---

## Features

### 1. Screenshot Button

**Visual:** Camera icon (22x22px), dark gray body, multi-layered lens, flash animation on capture.

**Implementation:**
```typescript
screenshotBtn.addEventListener('click', async (e) => {
  e.stopPropagation()
  screenshotBtn.classList.add('flash')
  setTimeout(() => screenshotBtn.classList.remove('flash'), 300)
  
  const screenshotPath = await takeScreenshot()
  if (screenshotPath) {
    recordAction(JSON.stringify({ type: 'screenshot', screenshot: screenshotPath }))
  }
})
```

### 2. Assertion Button

**Visual:** Eye icon with iris/pupil rendering, blue-tinted when active.

**State Management:**
```typescript
let assertionModeActive = false

assertionBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  assertionModeActive = !assertionModeActive
  assertionBtn.classList.toggle('active', assertionModeActive)
})

// Expose to injected script
window.__dodoAssertionMode = () => assertionModeActive
window.__dodoDisableAssertionMode = () => {
  assertionModeActive = false
  assertionBtn.classList.remove('active')
}
```

Auto-disables after recording one assertion.

### 3. Voice Recording Indicator

**Visual:** 10px red pulsing dot, positioned after assertion button.

**Implementation:**
```typescript
// CSS animation
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

// State sync (checks every 100ms)
const updateVoiceIndicator = () => {
  const isActive = (window as DodoWindow).__dodoAudioActive === true
  voiceIndicator.classList.toggle('active', isActive)
}
setInterval(updateVoiceIndicator, 100)
```

Main process sets `window.__dodoAudioActive` via [`page.evaluate()`](../electron/browser/recorder.ts:247).

### 4. Drag and Drop

```typescript
let isDragging = false
let dragStartX, dragStartY, widgetStartX, widgetStartY

widget.addEventListener('mousedown', (e) => {
  isDragging = true
  widget.classList.add('dragging')
  dragStartX = e.clientX
  dragStartY = e.clientY
  const pos = getWidgetPosition()
  widgetStartX = pos.x
  widgetStartY = pos.y
  e.preventDefault()
})

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return
  const deltaX = e.clientX - dragStartX
  const deltaY = e.clientY - dragStartY
  setWidgetPosition(widgetStartX + deltaX, widgetStartY + deltaY)
})

document.addEventListener('mouseup', () => {
  if (!isDragging) return
  isDragging = false
  widget.classList.remove('dragging')
  snapToEdge()
})
```

### 5. Edge Snapping

After drag release, widget snaps to nearest edge (top/right/bottom/left) with 20px padding and cubic-bezier animation (0.3s).

```typescript
const snapToEdge = () => {
  const pos = getWidgetPosition()
  const distances = {
    top: pos.y,
    bottom: window.innerHeight - (pos.y + pos.height),
    left: pos.x,
    right: window.innerWidth - (pos.x + pos.width)
  }
  const minDist = Math.min(...Object.values(distances))
  // Position to edge with minDist
  widget.classList.add('snapping')
  setWidgetPosition(newX, newY)
  setTimeout(() => widget.classList.remove('snapping'), 300)
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

**Spacing:** 8px widget padding, 8px button gap, 40x40px button minimum

**Transitions:** 0.2s opacity, 0.3s snap animation, 0.2s SVG colors

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
if (document.getElementById(WIDGET_HOST_ID)) {
  console.log('[Dodo Recorder] Widget already exists, skipping creation')
  return
}
```

Prevents multiple widgets on page reload, conflicts with SPA routes, memory leaks.

---

## Implementation Files

| File | Purpose | Lines |
|------|---------|-------|
| [`electron/browser/recording-widget.ts`](../electron/browser/recording-widget.ts) | Widget implementation | ~400 |
| [`electron/browser/injected-script.ts`](../electron/browser/injected-script.ts) | Event recording + exclusion | ~390 |
| [`electron/browser/recorder.ts`](../electron/browser/recorder.ts) | Widget injection | ~170 |

**Key Functions:**
- [`getWidgetScript()`](../electron/browser/recording-widget.ts:12) - Widget creation
- [`getWidgetInitScript()`](../electron/browser/recording-widget.ts:376) - Initialization wrapper
- [`isWithinWidget()`](../electron/browser/injected-script.ts:258) - Exclusion check
