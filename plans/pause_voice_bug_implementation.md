# Pause/Resume Voice Recording Bug - Implementation Plan

## Overview

Fix the bug where MediaRecorder continues recording audio when pause is triggered from the browser widget. The solution uses an event-driven architecture where `BrowserRecorder` emits events that IPC handlers forward to the renderer.

---

## Implementation Steps

### Step 1: Update BrowserRecorder to emit pause/resume events

**File:** [`electron/browser/recorder.ts`](../electron/browser/recorder.ts)

**Location 1:** In the `pause()` method (line ~371)

**After this line:**
```typescript
logger.info('🔶 Recording paused')
```

**Add this line at the END of the pause() method (after the try-catch):**
```typescript
// Emit event for IPC handler to forward to renderer
this.emit('paused')
```

**Location 2:** In the `resume()` method (line ~431)

**After this line:**
```typescript
logger.info('▶️ Recording resumed', `(paused for ${this.pausedDurationMs}ms total)`)
```

**Add this line at the END of the resume() method (after the try-catch):**
```typescript
// Emit event for IPC handler to forward to renderer
this.emit('resumed')
```

### Step 2: Update IPC handlers to listen for events and forward to renderer

**File:** [`electron/ipc/recording.ts`](../electron/ipc/recording.ts)

**Location:** In the `start-recording` handler, after `browserRecorder.on('action', ...)` (around line ~62)

**Add these event listeners:**
```typescript
// Listen for pause/resume events from browser widget and forward to renderer
browserRecorder.on('paused', () => {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('recording-state-changed', { status: 'paused' })
    logger.debug('🔶 Forwarded paused event to renderer')
  }
})

browserRecorder.on('resumed', () => {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('recording-state-changed', { status: 'recording' })
    logger.debug('▶️ Forwarded resumed event to renderer')
  }
})
```

**Location 2:** Update the `pause-recording` handler (around line ~99)

**Remove this block:**
```typescript
// Notify renderer of state change
if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
  mainWindow.webContents.send('recording-state-changed', { status: 'paused' })
}
```

**Replace with comment:**
```typescript
// Event forwarding now handled by 'paused' event listener
```

**Location 3:** Update the `resume-recording` handler (around line ~114)

**Remove this block:**
```typescript
// Notify renderer of state change
if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
  mainWindow.webContents.send('recording-state-changed', { status: 'recording' })
}
```

**Replace with comment:**
```typescript
// Event forwarding now handled by 'resumed' event listener
```

### Step 3: Clean up event listeners on stop

**File:** [`electron/browser/recorder.ts`](../electron/browser/recorder.ts)

**Location:** In the `stop()` method (around line ~504)

**Before this block:**
```typescript
if (this.browser) {
  await this.browser.close()
  this.browser = null
  this.page = null
}
```

**Add:**
```typescript
// Remove all event listeners to prevent memory leaks
this.removeAllListeners('paused')
this.removeAllListeners('resumed')
```

---

## Testing Instructions

### Manual Test 1: Basic Pause/Resume from Widget

1. Start recording with voice enabled
2. Speak: "Recording started"
3. Wait 2 seconds
4. Click pause button in browser widget
5. **Verify:** Voice indicator disappears
6. Speak: "This should not be recorded"
7. Wait 2 seconds
8. Click play button in browser widget
9. **Verify:** Voice indicator reappears
10. Speak: "Recording resumed"
11. Wait 2 seconds
12. Stop recording
13. **Expected Result:** Transcript contains "Recording started" and "Recording resumed" but NOT "This should not be recorded"

### Manual Test 2: Multiple Pause/Resume Cycles

1. Start recording with voice enabled
2. Speak: "First segment"
3. Pause from widget → wait → resume
4. Speak: "Second segment"
5. Pause from widget → wait → resume
6. Speak: "Third segment"
7. Stop recording
8. **Expected Result:** Transcript contains all three segments, no paused speech

### Manual Test 3: Pause from App UI (regression test)

1. Start recording with voice enabled
2. Speak: "Before pause"
3. Click pause button in APP UI (if available)
4. Speak: "Paused speech"
5. Click resume in APP UI
6. Speak: "After resume"
7. Stop recording
8. **Expected Result:** Transcript excludes paused speech (same as widget pause)

### Manual Test 4: Edge Cases

- [ ] Pause → immediate resume (rapid clicks)
- [ ] Start recording → immediately pause → resume → stop
- [ ] Pause with voice disabled
- [ ] Page navigation while paused (verify resume state maintained)

### Verification Points

After each test:
- [ ] Check console logs for `🔶 Forwarded paused event to renderer`
- [ ] Check console logs for `▶️ Forwarded resumed event to renderer`
- [ ] Check console logs for `🎤 Audio recording paused`
- [ ] Check console logs for `🎤 Audio recording resumed`
- [ ] Verify MediaRecorder state in DevTools (should be 'paused' when paused)

---

## Code Changes Summary

| File | Lines Changed | Purpose |
|------|--------------|---------|
| `electron/browser/recorder.ts` | +4 (2 emit calls, 2 cleanup) | Emit pause/resume events |
| `electron/ipc/recording.ts` | +18, -8 | Listen for events and forward to renderer |
| **Total** | ~14 net new lines | Event-driven pause/resume |

---

## Rollback Plan

If issues arise:

1. Remove `this.emit('paused')` and `this.emit('resumed')` from `recorder.ts`
2. Restore the `mainWindow.webContents.send()` calls in `pause-recording` and `resume-recording` IPC handlers
3. Remove the event listeners from `start-recording` handler

This returns to the previous state where pause from app UI works but pause from widget doesn't.

---

## Success Criteria

- [x] Root cause identified and documented
- [ ] Code changes implemented
- [ ] Manual tests pass
- [ ] No regressions in app UI pause/resume
- [ ] Console logs show correct event flow
- [ ] Transcripts exclude paused speech
- [ ] Voice indicator behavior correct
- [ ] Documentation updated

---

## Related Files

- Analysis: [`plans/pause_voice_bug_analysis.md`](pause_voice_bug_analysis.md)
- Original plan: [`pause_resume_plan.md`](../pause_resume_plan.md)
- Architecture doc: [`docs/architecture.md`](../docs/architecture.md)
- Voice transcription doc: [`docs/voice_transcription.md`](../docs/voice_transcription.md)
