# Dodo Recorder - Code Review & Improvement Recommendations

**Review Date:** 2026-01-05  
**Reviewer:** Code Analysis  
**Project Version:** 0.1.0

---

## Executive Summary

This document outlines identified areas for improvement in the Dodo Recorder codebase, organized by category and priority. The review covers code duplication, security concerns, error handling, performance optimizations, type safety, and maintainability issues.

---

## 1. Code Duplication & DRY Principle Violations

### 1.1 Duplicate Permission Lists ⚠️ HIGH
**Location:** `electron/main.ts:34-44`

**Issue:** The `allowedPermissions` array is defined twice in the same file.

```typescript
// Lines 34-35
const allowedPermissions = ['media', 'microphone', 'audioCapture']
// Lines 43-44
const allowedPermissions = ['media', 'microphone', 'audioCapture']
```

**Recommendation:**
```typescript
const ALLOWED_PERMISSIONS = ['media', 'microphone', 'audioCapture'] as const
```

---

### 1.2 Duplicate Test ID Attribute Checks ⚠️ MEDIUM
**Location:** `electron/browser/recorder.ts:126-128` and `electron/browser/recorder.ts:204-206`

**Issue:** Test ID extraction logic appears twice in the injected script.

```typescript
const testId = element.getAttribute('data-testid') || 
               element.getAttribute('data-test-id') ||
               element.getAttribute('data-test')
```

**Recommendation:**
```typescript
const getTestId = (el: Element): string | null => 
  el.getAttribute('data-testid') || 
  el.getAttribute('data-test-id') || 
  el.getAttribute('data-test')
```

---

### 1.3 Duplicate ID Validation Regex ⚠️ MEDIUM
**Location:** `electron/browser/recorder.ts:61` and `electron/browser/recorder.ts:92`

**Issue:** Same regex pattern `/^[a-zA-Z][a-zA-Z0-9_-]*$/` used twice.

**Recommendation:**
```typescript
const VALID_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/
```

---

### 1.4 Duplicate Sorting Logic ⚠️ LOW
**Location:** `electron/utils/voiceDistribution.ts:45-54`

**Issue:** `sortByTimestamp` and `sortByStartTime` do essentially the same thing.

**Recommendation:**
```typescript
function sortByProperty<T>(items: T[], prop: keyof T): T[] {
  return [...items].sort((a, b) => (a[prop] as number) - (b[prop] as number))
}
```

---

### 1.5 Duplicate Closest Action Finding ⚠️ LOW
**Location:** `electron/utils/voiceDistribution.ts:216-232`

**Issue:** `findClosestAction` and `findNearestAction` are identical functions.

**Recommendation:** Remove `findNearestAction`, use only `findClosestAction`.

---

### 1.6 Duplicate Text Slicing ⚠️ LOW
**Location:** `electron/browser/recorder.ts:210-234`

**Issue:** Multiple `.slice(0, X)` operations with different limits (50, 100, 200).

**Recommendation:**
```typescript
const truncateText = (text: string, maxLength: number): string => 
  text.slice(0, maxLength)
```

---

## 2. Security Concerns 🔒

### 2.1 Path Traversal Vulnerability 🚨 CRITICAL
**Location:** `electron/utils/validation.ts:50-51`

**Issue:** Weak path validation that can be bypassed.

```typescript
if (path.includes('..')) {
  return { valid: false, error: 'Path traversal not allowed' }
}
```

**Vulnerabilities:**
- Doesn't catch `...` or URL-encoded paths (`%2e%2e`)
- Doesn't validate absolute paths
- Doesn't check if path is within allowed directories

**Recommendation:**
```typescript
import path from 'path'
import os from 'os'

export function validateOutputPath(outputPath: string): { valid: boolean; error?: string } {
  if (!outputPath || typeof outputPath !== 'string') {
    return { valid: false, error: 'Output path is required' }
  }
  
  const resolved = path.resolve(outputPath)
  const normalized = path.normalize(outputPath)
  
  // Check for path traversal attempts
  if (normalized.includes('..')) {
    return { valid: false, error: 'Path traversal not allowed' }
  }
  
  // Ensure path is within user directories
  const homeDir = os.homedir()
  if (!resolved.startsWith(homeDir)) {
    return { valid: false, error: 'Path must be within user directory' }
  }
  
  return { valid: true }
}
```

---

### 2.2 XSS Risk in Injected Script 🚨 HIGH
**Location:** `electron/browser/recorder.ts:49-51`

**Issue:** Incomplete string escaping that doesn't handle all special characters.

```typescript
const escapeQuotes = (str: string): string => {
  return str.replace(/"/g, '\\"').replace(/'/g, "\\'")
}
```

**Recommendation:**
```typescript
const escapeForJson = (str: string): string => {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/\b/g, '\\b')
}
```

---

### 2.3 Unvalidated IPC Data 🚨 HIGH
**Location:** `electron/main.ts:160-171`

**Issue:** Session data from renderer is trusted without validation.

```typescript
ipcMain.handle('save-session', async (_, sessionData: SessionBundle) => {
  // No validation of sessionData structure
```

**Recommendation:**
```typescript
function validateSessionBundle(data: unknown): data is SessionBundle {
  if (!data || typeof data !== 'object') return false
  
  const bundle = data as Partial<SessionBundle>
  
  return (
    Array.isArray(bundle.actions) &&
    Array.isArray(bundle.timeline) &&
    Array.isArray(bundle.transcript) &&
    bundle.metadata !== undefined &&
    typeof bundle.metadata === 'object' &&
    typeof bundle.metadata.id === 'string' &&
    typeof bundle.notes === 'string'
  )
}

ipcMain.handle('save-session', async (_, sessionData: unknown) => {
  if (!validateSessionBundle(sessionData)) {
    return ipcError('Invalid session data structure')
  }
  // ... proceed with save
})
```

---

### 2.4 Unrestricted Browser Launch Arguments ⚠️ MEDIUM
**Location:** `electron/browser/recorder.ts:16-19`

**Issue:** Missing security-focused browser arguments.

**Recommendation:**
```typescript
this.browser = await chromium.launch({
  headless: false,
  args: [
    '--start-maximized',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
  ],
})
```

---

### 2.5 Sensitive Data in Console Logs ⚠️ MEDIUM
**Location:** Multiple files (e.g., `electron/audio/transcriber.ts:11`)

**Issue:** Logs may contain sensitive paths or data in production.

**Recommendation:**
```typescript
// Create logger utility: electron/utils/logger.ts
export const logger = {
  debug: (msg: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${msg}`, ...args)
    }
  },
  info: (msg: string, ...args: unknown[]) => {
    console.log(`[INFO] ${msg}`, ...args)
  },
  warn: (msg: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${msg}`, ...args)
  },
  error: (msg: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${msg}`, ...args)
  }
}
```

---

## 3. Error Handling & Robustness

### 3.1 Silent Error Swallowing ⚠️ MEDIUM
**Location:** `electron/utils/fs.ts:17-22`

**Issue:** Errors are completely ignored without logging.

```typescript
export async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath)
  } catch {
    // Ignore deletion errors
  }
}
```

**Recommendation:**
```typescript
export async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath)
  } catch (error) {
    console.warn(`Failed to delete file ${filePath}:`, error)
  }
}
```

---

### 3.2 Missing Error Handling in Event Listeners ⚠️ HIGH
**Location:** `electron/browser/recorder.ts:296-303`

**Issue:** No try-catch around event handler. Exceptions could crash the recorder.

**Recommendation:**
```typescript
this.page.on('framenavigated', (frame) => {
  try {
    if (frame === this.page?.mainFrame()) {
      this.recordAction({
        type: 'navigate',
        url: frame.url(),
      })
    }
  } catch (error) {
    console.error('Error handling frame navigation:', error)
  }
})
```

---

### 3.3 No Cleanup on Initialization Failure ⚠️ HIGH
**Location:** `electron/main.ts:135-148`

**Issue:** If any component fails to initialize, others aren't cleaned up.

**Recommendation:**
```typescript
return handleIpc(async () => {
  try {
    browserRecorder = new BrowserRecorder()
    sessionWriter = new SessionWriter(outputPath)
    transcriber = new Transcriber()

    browserRecorder.on('action', (action) => {
      mainWindow?.webContents.send('action-recorded', action)
    })

    await browserRecorder.start(startUrl)
    await transcriber.initialize()

    return {}
  } catch (error) {
    // Cleanup on failure
    await browserRecorder?.stop()
    browserRecorder = null
    sessionWriter = null
    transcriber = null
    throw error
  }
}, 'Failed to start recording')
```

---

### 3.4 Race Condition in Stop Recording ⚠️ HIGH
**Location:** `electron/main.ts:151-158`

**Issue:** Concurrent IPC calls could access null `browserRecorder`.

**Recommendation:**
```typescript
let isRecording = false

ipcMain.handle('start-recording', async (_, startUrl: string, outputPath: string) => {
  if (isRecording) {
    return ipcError('Recording already in progress')
  }
  isRecording = true
  // ... start logic
})

ipcMain.handle('stop-recording', async () => {
  if (!isRecording) {
    return ipcError('No recording in progress')
  }
  // ... stop logic
  isRecording = false
})
```

---

## 4. Performance Optimizations

### 4.1 Inefficient Array Operations ⚠️ MEDIUM
**Location:** `electron/utils/voiceDistribution.ts:114-117`

**Issue:** Creates new array on every segment assignment.

```typescript
actionIds.forEach(actionId => {
  const existing = voiceMap.get(actionId) || []
  voiceMap.set(actionId, [...existing, segment])
})
```

**Recommendation:**
```typescript
actionIds.forEach(actionId => {
  const existing = voiceMap.get(actionId)
  if (existing) {
    existing.push(segment)
  } else {
    voiceMap.set(actionId, [segment])
  }
})
```

---

### 4.2 Redundant Sorting ⚠️ LOW
**Location:** `electron/utils/voiceDistribution.ts:28-29`

**Issue:** Sorts arrays that may already be sorted.

**Recommendation:** Add documentation stating inputs should be pre-sorted, or add a check:
```typescript
function isSorted<T>(arr: T[], key: keyof T): boolean {
  for (let i = 1; i < arr.length; i++) {
    if ((arr[i][key] as number) < (arr[i-1][key] as number)) return false
  }
  return true
}
```

---

### 4.3 Large Injected Script ⚠️ MEDIUM
**Location:** `electron/browser/recorder.ts:48-294`

**Issue:** 250-line script injected into every page, including iframes.

**Recommendation:** 
- Split into smaller modules
- Consider using `page.evaluate()` for complex operations
- Add check to prevent injection into iframes

---

## 5. Type Safety Issues

### 5.1 Loose Type Casting ⚠️ LOW
**Location:** `electron/browser/recorder.ts:251`

**Issue:** Double casting through `unknown` bypasses type safety.

```typescript
(window as unknown as { __dodoRecordAction: (data: string) => void }).__dodoRecordAction(...)
```

**Recommendation:**
```typescript
// Define interface at top of injected script
interface DodoWindow extends Window {
  __dodoRecordAction: (data: string) => void
}

// Use it
(window as DodoWindow).__dodoRecordAction(...)
```

---

### 5.2 Missing Return Type Annotations ⚠️ LOW
**Location:** `electron/utils/voiceDistribution.ts` (multiple functions)

**Recommendation:** Add explicit return types:
```typescript
function sortByTimestamp(actions: RecordedAction[]): RecordedAction[] {
  return [...actions].sort((a, b) => a.timestamp - b.timestamp)
}
```

---

### 5.3 Unsafe Type Assertion ⚠️ MEDIUM
**Location:** `electron/preload.ts:37`

**Issue:** Assumes IPC data is valid without validation.

```typescript
const handler = (_: unknown, action: RecordedAction) => callback(action)
```

**Recommendation:** Add runtime validation before casting.

---

## 6. Code Organization & Maintainability

### 6.1 God Object: BrowserRecorder ⚠️ HIGH
**Location:** `electron/browser/recorder.ts:6`

**Issue:** Class has too many responsibilities:
- Browser lifecycle management
- Event listening
- Locator generation (250+ lines)
- Action recording

**Recommendation:** Split into separate modules:
```
electron/browser/
├── BrowserController.ts    # Browser lifecycle
├── EventInjector.ts         # Script injection
├── LocatorGenerator.ts      # Locator strategies
└── ActionRecorder.ts        # Action storage
```

---

### 6.2 Magic Numbers ✅ GOOD
**Location:** `electron/utils/voiceDistribution.ts:4-8`

**Status:** Already well-implemented with named constants.

**Improvement:** Make configurable via settings:
```typescript
interface VoiceDistributionConfig {
  lookbackMs: number
  lookaheadMs: number
  longSegmentThresholdMs: number
}
```

---

### 6.3 Hardcoded Model Name ⚠️ LOW
**Location:** `electron/audio/transcriber.ts:22`

**Issue:** Model name is hardcoded.

**Recommendation:**
```typescript
export class Transcriber {
  constructor(private modelName: string = 'base.en') {}
}
```

---

### 6.4 Mixed Concerns in Main Process ⚠️ MEDIUM
**Location:** `electron/main.ts:1`

**Issue:** Main process handles window management, IPC, and business logic.

**Recommendation:** Extract IPC handlers:
```
electron/
├── main.ts                  # Window & app lifecycle
├── ipc/
│   ├── handlers.ts          # IPC handler registration
│   ├── recording.ts         # Recording-related handlers
│   └── session.ts           # Session-related handlers
```

---

## 7. Resource Management

### 7.1 No Timeout on Transcription ⚠️ HIGH
**Location:** `electron/audio/transcriber.ts:101-155`

**Issue:** Whisper transcription has no timeout. Long audio could hang indefinitely.

**Recommendation:**
```typescript
async transcribeWithTimeout(audioPath: string, timeoutMs: number = 300000): Promise<TranscriptSegment[]> {
  return Promise.race([
    this.runWhisper(audioPath),
    new Promise<TranscriptSegment[]>((_, reject) => 
      setTimeout(() => reject(new Error('Transcription timeout')), timeoutMs)
    )
  ])
}
```

---

### 7.2 Temp File Cleanup on Crash ⚠️ MEDIUM
**Location:** `electron/audio/transcriber.ts:46-62`

**Issue:** If app crashes, temp files are never cleaned up.

**Recommendation:**
```typescript
// In electron/main.ts
app.on('ready', async () => {
  const tempDir = path.join(app.getPath('temp'), 'dodo-recorder')
  await cleanupOldTempFiles(tempDir, 24 * 60 * 60 * 1000) // 24 hours
})

async function cleanupOldTempFiles(dir: string, maxAgeMs: number): Promise<void> {
  try {
    const files = await fs.promises.readdir(dir)
    const now = Date.now()
    
    for (const file of files) {
      const filePath = path.join(dir, file)
      const stats = await fs.promises.stat(filePath)
      
      if (now - stats.mtimeMs > maxAgeMs) {
        await fs.promises.unlink(filePath)
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup temp files:', error)
  }
}
```

---

### 7.3 Memory Leak: Event Listeners ⚠️ HIGH
**Location:** `electron/browser/recorder.ts:296`

**Issue:** Page event listeners are never removed.

**Recommendation:**
```typescript
export class BrowserRecorder extends EventEmitter {
  private eventHandlers: Map<string, Function> = new Map()

  private async setupEventListeners(): Promise<void> {
    const frameHandler = (frame: Frame) => {
      if (frame === this.page?.mainFrame()) {
        this.recordAction({
          type: 'navigate',
          url: frame.url(),
        })
      }
    }
    
    this.eventHandlers.set('framenavigated', frameHandler)
    this.page.on('framenavigated', frameHandler)
  }

  async stop(): Promise<void> {
    // Remove all event listeners
    this.eventHandlers.forEach((handler, event) => {
      this.page?.off(event, handler as any)
    })
    this.eventHandlers.clear()
    
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.page = null
    }
  }
}
```

---

## 8. Testing & Validation

### 8.1 No Input Validation on Whisper Options ⚠️ LOW
**Location:** `electron/audio/transcriber.ts:107-126`

**Issue:** Whisper options are hardcoded without validation.

**Recommendation:** Create a validation function for whisper options.

---

### 8.2 Missing Boundary Checks ⚠️ LOW
**Location:** `electron/browser/recorder.ts:197`

**Issue:** Assumes locators array exists.

```typescript
return locators.slice(0, 3)
```

**Recommendation:**
```typescript
return locators.length > 0 ? locators.slice(0, 3) : [createFallbackLocator(element)]
```

---

## 9. Documentation & Code Comments

### 9.1 Missing JSDoc for Public APIs ⚠️ MEDIUM
**Location:** `electron/browser/recorder.ts:12-34`

**Recommendation:**
```typescript
/**
 * Starts recording browser interactions
 * @param url - The URL to navigate to
 * @throws {Error} If browser fails to launch
 * @returns Promise that resolves when recording has started
 */
async start(url: string): Promise<void> {
  // ...
}
```

---

### 9.2 Unclear Variable Names ⚠️ LOW
**Location:** `electron/utils/voiceDistribution.ts:95`

**Issue:** Units not clear in variable names.

```typescript
const segmentMidpoint = (segment.startTime + segment.endTime) / 2
```

**Recommendation:**
```typescript
const segmentMidpointMs = (segment.startTime + segment.endTime) / 2
```

---

## 10. Configuration & Flexibility

### 10.1 Hardcoded Paths ⚠️ MEDIUM
**Location:** `electron/audio/transcriber.ts:25-27`

**Issue:** Whisper model path is hardcoded.

**Recommendation:**
```typescript
const modelPath = process.env.WHISPER_MODEL_PATH || 
  path.join(whisperModelsDir, `ggml-${this.modelName}.bin`)
```

---

### 10.2 No User Preferences ⚠️ LOW

**Issue:** The app lacks a settings/preferences system for:
- Whisper model selection
- Voice distribution time windows
- Audio quality settings
- Output format options

**Recommendation:** Implement a settings store:
```typescript
// electron/settings/store.ts
interface AppSettings {
  whisper: {
    modelName: 'tiny.en' | 'base.en' | 'small.en' | 'medium.en'
  }
  voiceDistribution: {
    lookbackMs: number
    lookaheadMs: number
  }
  output: {
    includeScreenshots: boolean
    prettyPrintJson: boolean
  }
}
```

---

## Priority Summary

### 🚨 Critical (Security) - Fix Immediately
1. ✅ Fix path traversal validation (`electron/utils/validation.ts`)
2. ✅ Add IPC data validation (`electron/main.ts`)
3. ✅ Improve XSS protection in injected script (`electron/browser/recorder.ts`)

### ⚠️ High (Bugs/Reliability) - Fix Soon
4. Fix race conditions in recording lifecycle
5. Add proper error handling in event listeners
6. Implement resource cleanup on failure
7. Remove duplicate code (DRY violations)
8. Fix memory leaks from event listeners
9. Add transcription timeout

### 📊 Medium (Performance & Maintainability) - Plan & Execute
10. Optimize array operations in voice distribution
11. Reduce injected script size
12. Split BrowserRecorder into smaller modules
13. Extract IPC handlers to separate module
14. Implement proper logging system
15. Add temp file cleanup on startup

### 📝 Low (Nice to Have) - Future Improvements
16. Add JSDoc documentation
17. Make configuration options user-configurable
18. Improve variable naming
19. Add return type annotations
20. Implement user preferences system

---

## Recommended Action Plan

### Phase 1: Security & Critical Bugs (Week 1)
- [ ] Implement robust path validation
- [ ] Add IPC data validation
- [ ] Fix XSS vulnerabilities
- [ ] Add error handling to event listeners
- [ ] Fix race conditions

### Phase 2: Code Quality & DRY (Week 2)
- [ ] Remove all code duplication
- [ ] Extract constants
- [ ] Implement proper logging
- [ ] Add JSDoc documentation

### Phase 3: Performance & Architecture (Week 3-4)
- [ ] Optimize voice distribution algorithm
- [ ] Refactor BrowserRecorder class
- [ ] Extract IPC handlers
- [ ] Implement resource cleanup

### Phase 4: Features & Polish (Week 5+)
- [ ] Add user preferences system
- [ ] Make configurations flexible
- [ ] Add comprehensive error messages
- [ ] Improve type safety

---

## Conclusion

The Dodo Recorder codebase is well-structured and implements its core functionality effectively. However, there are several areas that require attention, particularly around security, error handling, and code duplication. Addressing the critical security issues should be the top priority, followed by improving reliability and maintainability.

The project demonstrates good practices in some areas (e.g., named constants for magic numbers, separation of concerns in some modules), but would benefit from more consistent application of these principles throughout the codebase.

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-05
