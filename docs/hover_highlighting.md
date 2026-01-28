# Hover Highlighting for Assertion Mode

Visual feedback during assertion mode showing which element will be asserted before clicking. Blue overlay with selector label, similar to browser DevTools inspector.

**Features:** Dual trigger (widget button OR Cmd/Ctrl key), Shadow DOM isolation, RAF throttling, cross-platform.

---

## User Experience

### Method 1: Transient Mode (Keyboard)

1. Hold Cmd (macOS) or Ctrl (Windows/Linux)
2. Hover over elements → blue overlay appears
3. Click to record assertion
4. Release key → highlighting stops

### Method 2: Sticky Mode (Widget Button)

1. Click eye icon in widget
2. Button turns blue
3. Hover over elements → blue overlay appears
4. Click to record assertion
5. Mode auto-disables

**Both methods show:** Blue overlay (20% opacity), solid blue border (2px), selector label showing best locator.

---

## Implementation

### Shadow DOM Host

**File:** [`electron/browser/hover-highlighter.ts`](../electron/browser/hover-highlighter.ts)

```typescript
const highlightHost = document.createElement('div')
highlightHost.id = '__dodo-highlight-overlay-host'
highlightHost.style.cssText = `
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 2147483646;  /* Just below widget */
`
const shadow = highlightHost.attachShadow({ mode: 'closed' })
```

**Benefits:** Complete style isolation, high z-index, clicks pass through, closed mode prevents manipulation.

### Overlay Elements

**Background overlay:**
```typescript
overlay.style.cssText = `
  position: absolute;
  background: rgba(59, 130, 246, 0.2);
  border: 2px solid rgba(59, 130, 246, 0.8);
  pointer-events: none;
  transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  display: none;
  border-radius: 2px;
`
```

**Selector label:**
```typescript
label.style.cssText = `
  position: absolute;
  background: rgba(59, 130, 246, 0.95);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
`
```

### Event Handling

**Mousemove:**
```typescript
document.addEventListener('mousemove', (e) => {
  const target = e.target as Element
  
  if (!isAssertionModeActive()) {
    hideOverlay()
    return
  }
  
  if (isWithinWidget(target)) {
    hideOverlay()
    return
  }
  
  if (target === currentTarget) return
  currentTarget = target
  scheduleUpdate(target)
}, { passive: true })
```

**Key tracking:**
```typescript
let isCommandKeyPressed = false

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey) {
    if (!isCommandKeyPressed) {
      isCommandKeyPressed = true
    }
  }
}, { passive: true })

document.addEventListener('keyup', (e) => {
  if (!e.metaKey && !e.ctrlKey) {
    if (isCommandKeyPressed) {
      isCommandKeyPressed = false
      if (!win.__dodoAssertionMode?.()) {
        hideOverlay()
      }
    }
  }
}, { passive: true })

window.addEventListener('blur', () => {
  if (isCommandKeyPressed) {
    isCommandKeyPressed = false
    if (!win.__dodoAssertionMode?.()) {
      hideOverlay()
    }
  }
})
```

### Dual Trigger Mode

```typescript
function isAssertionModeActive(): boolean {
  const widgetMode = win.__dodoAssertionMode?.() || false
  const keyMode = isCommandKeyPressed
  return widgetMode || keyMode
}
```

Highlighting appears when either condition met (key OR button).

### Overlay Positioning

```typescript
function updateOverlay(element: Element): void {
  const rect = element.getBoundingClientRect()
  
  overlay.style.display = 'block'
  overlay.style.left = `${rect.left}px`
  overlay.style.top = `${rect.top}px`
  overlay.style.width = `${rect.width}px`
  overlay.style.height = `${rect.height}px`
  
  label.textContent = getElementLabel(element)
  label.style.left = `${rect.left}px`
  label.style.top = rect.top > 30 ? `${rect.top - 24}px` : `${rect.bottom + 4}px`
}
```

### Selector Label Priority

```typescript
function getElementLabel(element: Element): string {
  const testId = element.getAttribute('data-testid')
  const id = element.id
  const role = element.getAttribute('role')
  const type = element.getAttribute('type')
  const name = element.getAttribute('name')
  
  if (testId) return `[data-testid="${testId}"]`
  if (id) return `#${id}`
  if (role) return `${element.tagName.toLowerCase()}[role="${role}"]`
  if (type && element.tagName === 'INPUT') return `input[type="${type}"]`
  if (name) return `[name="${name}"]`
  
  // Text for buttons/links
  if (element.tagName === 'BUTTON' || element.tagName === 'A') {
    const text = element.textContent?.trim().substring(0, 20)
    if (text) return `${element.tagName.toLowerCase()}:text("${text}")`
  }
  
  return element.tagName.toLowerCase()
}
```

---

## Performance

### Optimizations

**RAF throttling:**
```typescript
let rafId: number | null = null

function scheduleUpdate(element: Element): void {
  if (rafId !== null) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    updateOverlay(element)
    rafId = null
  })
}
```

**Passive listeners:** All events use `{ passive: true }`

**Target caching:** Skip update if same element

**Early returns:** Check mode state first

**Performance targets:** 60 FPS, <5% CPU, <5 MB memory, <16ms update latency

---

## Integration

### Injection ([`electron/browser/recorder.ts:244`](../electron/browser/recorder.ts:244))

```typescript
await this.page.addInitScript('window.__dodoCreateHighlighter = ' + getHighlighterScript().toString())
await this.page.addInitScript(getHighlighterInitScript())
```

### Widget Exclusion

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

---

## Implementation Files

| File | Purpose | Lines |
|------|---------|-------|
| [`electron/browser/hover-highlighter.ts`](../electron/browser/hover-highlighter.ts) | Main implementation | ~350 |
| [`electron/browser/recorder.ts`](../electron/browser/recorder.ts:244) | Script injection | ~3 |

**Key Functions:**
- `getHighlighterScript()` - Returns highlighter creation function
- `getHighlighterInitScript()` - Returns initialization wrapper
- `isWithinWidget()` - Exclusion check
