# Audio Equalizer Bug Investigation

**Date**: 2026-01-22  
**Status**: ❌ UNRESOLVED  
**Component**: Browser Widget Audio Visualizer (5-bar equalizer)

---

## Problem Description

The audio equalizer in the browser recording widget remains in idle state (bars stuck at 5% height) even when audio is being recorded and successfully transcribed. The bars do not animate and do not change colors based on audio levels.

### Expected Behavior
- When audio recording starts, equalizer should appear in browser widget
- 5 bars should animate vertically based on microphone input level
- Colors should change: green (0-50%), yellow (50-75%), red (75-100%)
- Animation should persist across page navigations

### Actual Behavior
- Equalizer appears but bars remain at minimum height (5%)
- No color changes occur
- Bars remain gray/idle color
- Audio IS being recorded (confirmed by successful Whisper transcription)

---

## Evidence of Audio Working

From backend logs, audio **IS** being captured and transcribed:
```
[20:09:29.653] [info]  Total segments from Whisper: 3
[20:09:29.653] [info]    [1] 00:00:00.000 -> 00:00:10.920
[20:09:29.653] [info]        Text: "This is the test recording..."
```

This confirms:
- ✅ Microphone permission granted
- ✅ MediaStream acquired successfully
- ✅ MediaRecorder capturing data
- ✅ Whisper transcription working
- ❌ But equalizer visualization NOT working

---

## Architecture Overview

### Data Flow for Equalizer
```
┌─────────────────────────────────────────────────────────────────┐
│ RecordingControls.tsx (Renderer Process - Electron App)         │
├─────────────────────────────────────────────────────────────────┤
│ 1. getUserMedia() → MediaStream                                 │
│ 2. AudioContext → AnalyserNode                                  │
│ 3. analyser.getByteFrequencyData() → calculate RMS level       │
│ 4. IPC: updateAudioLevel(level) ────────────┐                  │
└──────────────────────────────────────────────┼──────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ electron/ipc/recording.ts (Main Process)                        │
├─────────────────────────────────────────────────────────────────┤
│ ipcMain.handle('update-audio-level', (level) => {              │
│   if (browserRecorder && isRecording) { ◄── CRITICAL CHECK     │
│     await browserRecorder.updateAudioLevel(level)               │
│   }                                                              │
│ })                                                               │
└──────────────────────────────────────────────┬──────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ electron/browser/recorder.ts (Main Process)                     │
├─────────────────────────────────────────────────────────────────┤
│ await page.evaluate((lvl, isActive) => {                       │
│   window.__dodoAudioLevel = lvl                                │
│   if (isActive && !window.__dodoAudioActive) {                 │
│     window.__dodoAudioActive = true                            │
│     window.__dodoShowEqualizer()                               │
│   }                                                              │
│ }, level, this.audioActive)                                     │
└──────────────────────────────────────────────┬──────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ recording-widget.ts (Injected - Browser Context)               │
├─────────────────────────────────────────────────────────────────┤
│ requestAnimationFrame loop reads:                              │
│   - window.__dodoAudioLevel                                    │
│   - window.__dodoAudioActive                                   │
│                                                                  │
│ If active && level > 0:                                        │
│   - Update bar heights based on level                          │
│   - Apply color attributes (green/yellow/red)                  │
│   - Use sine wave for visual variance                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Attempted Solutions

### Attempt #1: Fix Race Condition in Audio Level Monitoring Start
**Hypothesis**: Audio level monitoring started before `browserRecorder` existed, causing early IPC calls to be dropped.

**Changes**:
- **File**: `src/components/RecordingControls.tsx`
- **Lines**: 209-210, 272-300
- **Action**: Removed early `requestAnimationFrame` call and moved animation loop to start AFTER `startRecording` IPC completes

**Result**: ❌ Failed - Equalizer still frozen

---

### Attempt #2: Fix iframe Injection Spam + Initialize Globals
**Hypothesis**: Widget being injected into every iframe causing state confusion. Also, `__dodoAudioActive` might be `undefined` on widget init.

**Changes**:
- **File**: `electron/browser/recording-widget.ts`
- **Lines**: 14-16, 38-44
- **Action**: 
  - Skip widget injection in iframes: `if (window !== window.top) return`
  - Initialize globals: `__dodoAudioLevel = 0`, `__dodoAudioActive = false`

**Result**: ❌ Failed - Equalizer still frozen

---

### Attempt #3: Maintain Audio State Across Page Navigations
**Hypothesis**: Page navigations reset `__dodoAudioActive` to `false` in new page context, hiding equalizer.

**Changes**:
- **File**: `electron/browser/recorder.ts`
- **Lines**: 44, 219-227, 238
- **Action**: 
  - Added `audioActive` property to recorder
  - Modified `updateAudioLevel()` to re-establish active state after navigations
  - Store state in `updateAudioActivity()`

**Result**: ❌ Failed - Equalizer still frozen

---

### Attempt #4: Await Audio Activity Before Starting Monitoring
**Hypothesis**: `updateAudioActivity(true)` was fire-and-forget, animation loop started before browser state was set.

**Changes**:
- **File**: `src/components/RecordingControls.tsx`
- **Lines**: 274-275
- **Action**: Changed to `await window.electronAPI.updateAudioActivity(true)` before starting animation loop

**Result**: ❌ Failed - Equalizer still frozen

---

### Attempt #5: Fix AudioContext Suspended State + Add Debug Logging
**Hypothesis**: Browser autoplay policy might suspend AudioContext, preventing audio analysis.

**Changes**:
- **File**: `src/components/RecordingControls.tsx`
- **Lines**: 203-207, 289-291
- **Action**: 
  - Explicitly resume suspended AudioContext
  - Add debug logging for AudioContext state
  - Log periodic audio level samples

**Changes**:
- **File**: `electron/browser/recording-widget.ts`
- **Lines**: 451-453
- **Action**: Add debug logging in equalizer update loop

**Result**: ❌ Failed - Equalizer still frozen

---

## Current Code State

### Key Files Modified
1. ✏️ `src/components/RecordingControls.tsx` - Audio monitoring logic
2. ✏️ `electron/browser/recording-widget.ts` - Widget and equalizer rendering
3. ✏️ `electron/browser/recorder.ts` - Playwright page interaction
4. ✅ `electron/ipc/recording.ts` - No changes (IPC handlers unchanged)

### Debug Logging Added

**Renderer Console (Expected)**:
```javascript
🎤 AudioContext state: running
✅ Audio activity set to true in browser
✅ Audio level monitoring animation loop started
🎤 Audio level: 45.23 %, RMS: 0.2261  // Periodic samples (1% of frames)
```

**Browser Console (Expected)**:
```javascript
[Widget] updateEqualizer - isActive: true , level: 45.23  // Periodic samples (1% of frames)
```

---

## Hypotheses to Investigate Next

### Theory A: IPC Call Never Reaches Browser Context
**Check**: Does `page.evaluate()` in `recorder.ts:updateAudioLevel()` actually execute?
**Test**: Add `console.log` directly in the evaluate callback
**File**: `electron/browser/recorder.ts:214-228`

### Theory B: Animation Loop Not Running
**Check**: Is `requestAnimationFrame` being called? Is the loop actually running?
**Test**: Add counter in updateEqualizer to log every frame
**File**: `electron/browser/recording-widget.ts:443-491`

### Theory C: CSS/Shadow DOM Issue
**Check**: Are the CSS styles being applied? Is `.eq-bar` selector working?
**Test**: Inspect element in browser DevTools, check computed styles
**File**: `electron/browser/recording-widget.ts:195-227`

### Theory D: Window Object Scope Issue
**Check**: Is the widget reading from the correct `window` object after inject?
**Test**: Log `window === window.top` in updateEqualizer
**File**: `electron/browser/recording-widget.ts:444-448`

### Theory E: Timing - Widget Not Ready When Updates Start
**Check**: Does widget exist when first `updateAudioLevel` is called?
**Test**: Add delay between `updateAudioActivity(true)` and starting animation loop
**File**: `src/components/RecordingControls.tsx:274-305`

### Theory F: updateAudioLevel IPC Handler Condition Failing
**Check**: Is `browserRecorder && isRecording` actually true when calls arrive?
**Test**: Add logging to IPC handler to see if it's being hit
**File**: `electron/ipc/recording.ts:122-126`

---

## Debugging Checklist

To properly debug this issue, we need to see console output from:

- [ ] **Renderer (Electron App)**: 
  - AudioContext state
  - Audio activity confirmation
  - Audio level samples
  
- [ ] **Browser (Playwright Window)**:
  - Widget initialization
  - updateEqualizer calls with state
  - `window.__dodoAudioLevel` and `window.__dodoAudioActive` values

- [ ] **Main Process (Backend)**:
  - IPC handler invocations
  - `page.evaluate()` success/failure
  - `browserRecorder` and `isRecording` state

---

## Recommendations for Next Investigation

1. **Add logging to IPC handler** in `electron/ipc/recording.ts`:
   ```typescript
   ipcMain.handle('update-audio-level', async (_event, level: number) => {
     console.log(`[IPC] update-audio-level called: ${level}, hasRecorder: ${!!browserRecorder}, isRecording: ${isRecording}`)
     if (browserRecorder && isRecording) {
       await browserRecorder.updateAudioLevel(level)
     } else {
       console.log('[IPC] Skipped - recorder not ready')
     }
   })
   ```

2. **Add logging inside page.evaluate** in `electron/browser/recorder.ts`:
   ```typescript
   await this.page.evaluate(({ lvl, isActive }) => {
     console.log('[Browser Context] Setting audio level:', lvl, 'isActive:', isActive)
     const win = window as any
     win.__dodoAudioLevel = lvl
     console.log('[Browser Context] Current state:', {
       audioLevel: win.__dodoAudioLevel,
       audioActive: win.__dodoAudioActive,
       hasShowEqualizer: typeof win.__dodoShowEqualizer === 'function'
     })
     // ... rest of logic
   }, { lvl: level, isActive: shouldBeActive })
   ```

3. **Add frame counter to widget** in `electron/browser/recording-widget.ts`:
   ```typescript
   let frameCount = 0
   const updateEqualizer = () => {
     frameCount++
     const win = window as unknown as DodoWindow
     const level = win.__dodoAudioLevel || 0
     const isActive = win.__dodoAudioActive === true
     
     if (frameCount % 60 === 0) { // Every 60 frames (~1 second)
       console.log(`[Widget Frame ${frameCount}] isActive: ${isActive}, level: ${level}`)
     }
     // ... rest of logic
   }
   ```

4. **Test in isolation**: Create a minimal test page that:
   - Manually sets `window.__dodoAudioLevel = 50`
   - Manually sets `window.__dodoAudioActive = true`
   - Verifies equalizer animates
   - This would confirm widget rendering logic is correct

5. **Check browser DevTools**: 
   - Inspect the equalizer element in the Playwright browser
   - Check if `.eq-bar` elements exist
   - Check if they're inside the shadow DOM
   - Check computed styles for `height` property

---

## Related Documentation

- [`docs/browser_widget.md`](docs/browser_widget.md) - Widget architecture and design
- [`AGENTS.md`](AGENTS.md) - Logging best practices (use `logger` in main, `console.log` in renderer)
- [`electron/browser/recording-widget.ts`](electron/browser/recording-widget.ts) - Widget implementation
- [`electron/browser/recorder.ts`](electron/browser/recorder.ts) - Browser recorder with Playwright
- [`src/components/RecordingControls.tsx`](src/components/RecordingControls.tsx) - Audio recording UI

---

## Summary

After 5 attempted fixes addressing race conditions, state management, iframe handling, and AudioContext issues, the equalizer visualization remains non-functional despite audio being successfully recorded and transcribed. The issue requires deeper investigation with more comprehensive logging across all three execution contexts (Renderer, Main, Browser) to identify where the data flow breaks down.

**Next Step**: Implement comprehensive logging strategy as outlined in "Recommendations for Next Investigation" section above.
