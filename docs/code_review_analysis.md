# Dodo Recorder - Code Review Analysis

**Date**: 2026-01-13
**Review Scope**: README.md, docs/, AGENTS.md, and source code
**Purpose**: Identify refactorings, security flaws, and DRY principle violations

---

## Executive Summary

This code review identifies **15 refactoring opportunities**, **7 security concerns**, and **10 DRY violations** across the Dodo Recorder codebase. The project is well-structured overall, with good separation of concerns and comprehensive documentation. However, several areas could benefit from consolidation, security hardening, and code deduplication.

**Security Assessment**: The codebase has significant security vulnerabilities in path validation, command execution, and input sanitization that could lead to:
- **Path traversal attacks** allowing write access to arbitrary directories
- **Command injection** enabling arbitrary code execution via Whisper binary
- **Type confusion attacks** through `as any` type assertions
- **SSRF/XXS vulnerabilities** through insufficient URL validation

---

## 1. Refactoring Opportunities

### 1.1 Duplicate Session ID Generation Logic

**Locations:**
- [`electron/ipc/recording.ts`](electron/ipc/recording.ts:73-78)
- [`electron/session/writer.ts`](electron/session/writer.ts:17-22)

**Issue:** Both locations generate session IDs from timestamps using identical logic:

```typescript
// In recording.ts (lines 73-78)
const date = new Date(startTime)
const sessionId = date.toISOString()
  .replace(/T/, '-')
  .replace(/:/g, '')
  .split('.')[0]

// In writer.ts (lines 17-22) - EXACT SAME CODE
const date = new Date(session.startTime)
const sessionId = date.toISOString()
  .replace(/T/, '-')
  .replace(/:/g, '')
  .split('.')[0]
```

**Recommendation:** Extract to shared utility:

```typescript
// electron/utils/sessionId.ts
export function generateSessionId(startTime: number): string {
  const date = new Date(startTime)
  return date.toISOString()
    .replace(/T/, '-')
    .replace(/:/g, '')
    .split('.')[0]
}
```

---

### 1.2 Duplicate Duration Formatting Functions

**Locations:**
- [`electron/session/writer.ts`](electron/session/writer.ts:176-185)
- [`electron/utils/enhancedTranscript.ts`](electron/utils/enhancedTranscript.ts:260-269)

**Issue:** Identical implementations:

```typescript
// Both files have identical formatDuration() functions
private formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  
  if (minutes === 0) {
    return `${seconds}s`
  }
  return `${minutes}m ${seconds}s`
}
```

**Recommendation:** Move to `electron/utils/timeFormat.ts`:

```typescript
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  
  if (minutes === 0) {
    return `${seconds}s`
  }
  return `${minutes}m ${seconds}s`
}
```

---

### 1.3 Duplicate Timestamp Formatting Functions

**Locations:**
- [`electron/utils/enhancedTranscript.ts`](electron/utils/enhancedTranscript.ts:250-255) - `formatTimestamp()`
- [`electron/utils/voiceDistribution.ts`](electron/utils/voiceDistribution.ts:310-315) - `formatTranscriptTimestamp()`

**Issue:** Nearly identical implementations (MM:SS format):

```typescript
// enhancedTranscript.ts
function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// voiceDistribution.ts - SAME LOGIC
function formatTranscriptTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
```

**Recommendation:** Consolidate into single utility in `electron/utils/timeFormat.ts`:

```typescript
export function formatTimestampMMSS(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
```

---

### 1.4 Duplicate Action Validation Logic

**Locations:**
- [`electron/ipc/recording.ts`](electron/ipc/recording.ts:17-28) - `validateRecordedActionsArray()`
- [`electron/ipc/session.ts`](electron/ipc/session.ts:9-27) - `validateSessionBundle()`

**Issue:** Both validate action structure (id, timestamp, type) with identical checks:

```typescript
// Both functions check:
// - typeof action.id === 'string'
// - typeof action.timestamp === 'number'
// - typeof action.type === 'string'
```

**Recommendation:** Extract to shared validation:

```typescript
// electron/utils/validation.ts
export function validateActionStructure(data: unknown): data is RecordedAction {
  if (!data || typeof data !== 'object') return false
  const action = data as Partial<RecordedAction>
  return (
    typeof action.id === 'string' &&
    typeof action.timestamp === 'number' &&
    typeof action.type === 'string'
  )
}
```

---

### 1.5 Duplicate Transcript Segment Validation Logic

**Locations:**
- [`electron/ipc/recording.ts`](electron/ipc/recording.ts:30-42) - `validateTranscriptSegmentsArray()`
- [`electron/ipc/session.ts`](electron/ipc/session.ts) - (implicit in `validateSessionBundle`)

**Issue:** Similar validation patterns for transcript segments.

**Recommendation:** Add to `electron/utils/validation.ts`:

```typescript
export function validateTranscriptSegmentStructure(data: unknown): data is TranscriptSegment {
  if (!data || typeof data !== 'object') return false
  const segment = data as Partial<TranscriptSegment>
  return (
    typeof segment.id === 'string' &&
    typeof segment.startTime === 'number' &&
    typeof segment.endTime === 'number' &&
    typeof segment.text === 'string'
  )
}
```

---

### 1.6 IPC Handler Cleanup Manual List

**Location:** [`electron/ipc/handlers.ts`](electron/ipc/handlers.ts:28-39)

**Issue:** `cleanupHandlers()` manually lists all handlers to remove:

```typescript
export function cleanupHandlers(): void {
  ipcMain.removeHandler('start-recording')
  ipcMain.removeHandler('stop-recording')
  ipcMain.removeHandler('pause-recording')
  ipcMain.removeHandler('resume-recording')
  ipcMain.removeHandler('save-session')
  ipcMain.removeHandler('get-settings')
  ipcMain.removeHandler('update-settings')
  // ... manual list
}
```

**Recommendation:** Track registered handlers dynamically:

```typescript
const registeredHandlers = new Set<string>()

export function registerHandler(channel: string, handler: (...args: any[]) => any) {
  ipcMain.handle(channel, handler)
  registeredHandlers.add(channel)
}

export function cleanupHandlers(): void {
  for (const channel of registeredHandlers) {
    ipcMain.removeHandler(channel)
  }
  registeredHandlers.clear()
}
```

---

### 1.7 Model Path Logic Duplication

**Locations:**
- [`electron/audio/transcriber.ts`](electron/audio/transcriber.ts:67-73) - `getModelPath()`
- [`electron/main.ts`](electron/main.ts:46-100) - `checkWhisperComponents()`

**Issue:** Both compute model/binary paths using similar logic:

```typescript
// transcriber.ts
private getModelPath(): string {
  const appPath = app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : app.getAppPath()
  const modelsDir = path.join(appPath, 'models')
  return path.join(modelsDir, 'ggml-small.en.bin')
}

// main.ts - Similar pattern
const appPath = app.isPackaged
  ? path.dirname(app.getPath('exe'))
  : app.getAppPath()
const modelPath = path.join(appPath, 'models', 'ggml-small.en.bin')
```

**Recommendation:** Create centralized path utility:

```typescript
// electron/utils/paths.ts
export function getModelsDir(): string {
  const appPath = app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : app.getAppPath()
  return path.join(appPath, 'models')
}

export function getModelPath(): string {
  return path.join(getModelsDir(), 'ggml-small.en.bin')
}

export function getBinaryPath(): string {
  return path.join(getModelsDir(), 'whisper')
}
```

---

### 1.8 RecordingControls Component Too Large

**Location:** [`src/components/RecordingControls.tsx`](src/components/RecordingControls.tsx:1-377)

**Issue:** 377 lines handling too many responsibilities:
- Recording state management
- Audio recording
- Transcription
- Voice distribution
- Session saving
- UI rendering

**Recommendation:** Split into smaller components:

```
src/components/recording/
├── RecordingControls.tsx       # Main container (~100 lines)
├── AudioRecorder.tsx          # Audio recording logic (~100 lines)
├── TranscriptionStatus.tsx      # Transcription UI (~50 lines)
├── SessionActions.tsx          # Save/reset actions (~50 lines)
└── RecordingButtons.tsx         # Start/stop buttons (~50 lines)
```

---

### 1.9 Settings Type Assertions

**Locations:**
- [`electron/ipc/session.ts`](electron/ipc/session.ts:71) - `settings.update(updates as any)`
- [`electron/ipc/session.ts`](electron/ipc/session.ts:102) - `settings.updateUserPreferences(preferences as any)`

**Issue:** Using `as any` bypasses TypeScript type checking:

```typescript
settings.update(updates as any)  // Line 71
settings.updateUserPreferences(preferences as any)  // Line 102
```

**Recommendation:** Create proper type guards or validation:

```typescript
function validateSettingsUpdate(data: unknown): data is Partial<AppSettings> {
  if (!data || typeof data !== 'object') return false
  // Add validation logic
  return true
}

// Usage
if (validateSettingsUpdate(updates)) {
  settings.update(updates)
}
```

---

### 1.10 Preference Restoration Pattern Duplication

**Location:** [`src/components/RecordingControls.tsx`](src/components/RecordingControls.tsx:215-229, 241-254)

**Issue:** Identical pattern of reloading and restoring preferences:

```typescript
// Lines 215-229 (in saveSession)
const prefsResult = await window.electronAPI.getUserPreferences()
reset()
if (prefsResult.success && (prefsResult as any).preferences) {
  const preferences = (prefsResult as any).preferences
  if (preferences.startUrl) {
    useRecordingStore.getState().setStartUrl(preferences.startUrl)
  }
  if (preferences.outputPath) {
    useRecordingStore.getState().setOutputPath(preferences.outputPath)
  }
}

// Lines 241-254 (in resetSession) - EXACT SAME CODE
const prefsResult = await window.electronAPI.getUserPreferences()
reset()
if (prefsResult.success && (prefsResult as any).preferences) {
  const preferences = (prefsResult as any).preferences
  if (preferences.startUrl) {
    useRecordingStore.getState().setStartUrl(preferences.startUrl)
  }
  if (preferences.outputPath) {
    useRecordingStore.getState().setOutputPath(preferences.outputPath)
  }
}
```

**Recommendation:** Extract to custom hook:

```typescript
// src/hooks/usePreferences.ts
export function usePreferences() {
  const reloadPreferences = async () => {
    const prefsResult = await window.electronAPI.getUserPreferences()
    if (prefsResult.success && prefsResult.preferences) {
      const { startUrl, outputPath } = prefsResult.preferences
      const store = useRecordingStore.getState()
      if (startUrl) store.setStartUrl(startUrl)
      if (outputPath) store.setOutputPath(outputPath)
    }
  }

  const resetWithPreferences = async () => {
    useRecordingStore.getState().reset()
    await reloadPreferences()
  }

  return { reloadPreferences, resetWithPreferences }
}
```

---

### 1.11 Audio Stream Cleanup Duplication

**Location:** [`src/components/RecordingControls.tsx`](src/components/RecordingControls.tsx:110-113, 127-129)

**Issue:** Identical audio stream cleanup code in two places:

```typescript
// Lines 110-113
if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
  mediaRecorderRef.current.stop()
  mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
}

// Lines 127-129 - EXACT SAME CODE
if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
  mediaRecorderRef.current.stop()
  mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
}
```

**Recommendation:** Extract to utility function:

```typescript
function stopAudioRecording(mediaRecorder: MediaRecorder | null) {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
    mediaRecorder.stream.getTracks().forEach(track => track.stop())
  }
}
```

---

### 1.12 Console.log Usage Instead of Logger

**Location:** [`src/components/RecordingControls.tsx`](src/components/RecordingControls.tsx:95, 97, 139-145, 157, 162, 179, 213, 231)

**Issue:** Multiple `console.log`/`console.error` calls instead of using the logger utility:

```typescript
console.log('🎤 Audio recording started at:', recordingStartTime)  // Line 95
console.error('Failed to start audio recording:', err)  // Line 97
// ... many more
```

**Recommendation:** Use logger utility consistently (or create renderer logger):

```typescript
// src/utils/logger.ts (renderer-side)
export const rendererLogger = {
  info: (msg: string, ...args: unknown[]) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[ERROR] ${msg}`, ...args),
  debug: (msg: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${msg}`, ...args)
    }
  },
}
```

---

### 1.13 SettingsStore Getter/Setter Redundancy

**Location:** [`electron/settings/store.ts`](electron/settings/store.ts:120-188)

**Issue:** Multiple similar getter/setter methods:

```typescript
getAll(): AppSettings { return { ...this.settings } }
get<K extends keyof AppSettings>(key: K): AppSettings[K] { return this.settings[key] }
getWhisperTimeout(): number { return this.settings.whisper.transcriptionTimeoutMs }
getVoiceDistributionConfig(): {...} { return { ...this.settings.voiceDistribution } }
getUserPreferences(): {...} { return { ...this.settings.userPreferences } }
```

**Recommendation:** Consider using a more generic approach or simplify:

```typescript
// Most getters could be replaced with direct access
// Or create typed accessors:
const getWhisperTimeout = (settings: AppSettings): number => 
  settings.whisper.transcriptionTimeoutMs
```

---

### 1.14 Unused Type Re-export

**Location:** [`src/types/session.ts`](src/types/session.ts:1-11)

**Issue:** Just re-exports everything from shared/types.ts:

```typescript
export type {
  ElementTarget,
  RecordedAction,
  TranscriptSegment,
  // ... all types from shared/types
} from '../../shared/types'
```

**Recommendation:** Either:
1. Import directly from `@/types/session` is already aliasing to `shared/types`
2. Create a proper barrel export with only necessary types
3. Remove this file and update imports

---

### 1.15 Magic Numbers in Voice Distribution

**Location:** [`electron/utils/voiceDistribution.ts`](electron/utils/voiceDistribution.ts:5-9)

**Issue:** Configuration constants as module-level variables:

```typescript
let TIME_WINDOWS = {
  LOOKBACK: 10000,
  LOOKAHEAD: 5000,
  LONG_SEGMENT_THRESHOLD: 3000,
}
```

**Recommendation:** Move to settings or use constants file:

```typescript
// electron/constants/voiceDistribution.ts
export const DEFAULT_VOICE_DISTRIBUTION = {
  LOOKBACK_MS: 10000,
  LOOKAHEAD_MS: 5000,
  LONG_SEGMENT_THRESHOLD_MS: 3000,
} as const
```

---

## 2. Security Flaws

### 2.1 Path Traversal Validation Weakness

**Location:** [`electron/utils/validation.ts`](electron/utils/validation.ts:49-74)

**Issue:** `validateOutputPath()` has insufficient path traversal protection:

```typescript
export function validateOutputPath(outputPath: string): { valid: boolean; error?: string } {
  // ...
  const normalized = path.normalize(outputPath)
  
  // Only checks for '..' in normalized path
  if (normalized.includes('..')) {
    return { valid: false, error: 'Path traversal not allowed' }
  }
  
  // Checks URL-encoded variants
  if (outputPath.includes('%2e') || outputPath.includes('%2E')) {
    return { valid: false, error: 'Path traversal not allowed' }
  }
  
  // Only checks if path is within home directory
  const homeDir = os.homedir()
  if (!resolved.startsWith(homeDir)) {
    return { valid: false, error: 'Path must be within user directory' }
  }
}
```

**Problems:**
1. Doesn't handle Windows absolute paths (`C:\`, `\\`)
2. Doesn't check for symlinks
3. URL encoding check is insufficient
4. `path.normalize()` doesn't fully resolve all traversal patterns

**Recommendation:**

```typescript
export function validateOutputPath(outputPath: string): { valid: boolean; error?: string } {
  if (!outputPath || typeof outputPath !== 'string') {
    return { valid: false, error: 'Output path is required' }
  }
  
  // Resolve to absolute path first
  const resolved = path.resolve(outputPath)
  
  // Normalize to remove . and .. segments
  const normalized = path.normalize(resolved)
  
  // Check for path traversal (normalized should not differ from resolved)
  if (normalized !== resolved) {
    return { valid: false, error: 'Path traversal not allowed' }
  }
  
  // Additional Windows-specific checks
  if (process.platform === 'win32') {
    // Check for UNC paths or device paths
    if (/^\\\\\?\\/.test(outputPath) || /^[A-Za-z]:/.test(outputPath)) {
      // Allow but validate further
    }
  }
  
  // Ensure path is within user directories
  const homeDir = os.homedir()
  const userDataDir = app.getPath('userData')
  const allowedDirs = [homeDir, userDataDir]
  
  if (!allowedDirs.some(dir => normalized.startsWith(dir))) {
    return { valid: false, error: 'Path must be within user directory' }
  }
  
  // Check for symlink traversal
  try {
    const realPath = fs.realpathSync(normalized)
    if (realPath !== normalized) {
      return { valid: false, error: 'Symlink traversal not allowed' }
    }
  } catch {
    // Path doesn't exist yet, that's OK
  }
  
  return { valid: true }
}
```

---

### 2.2 Command Injection Risk in Whisper Execution

**Location:** [`electron/audio/transcriber.ts`](electron/audio/transcriber.ts:170-225)

**Issue:** Uses `execAsync()` with command string containing user-controlled paths:

```typescript
const commandArgs = [
  `"${whisperPath}"`,
  '-m', `"${modelPath}"`,
  '-f', `"${audioPath}"`,
  // ... more args
]

const command = commandArgs.join(' ')

const { stdout, stderr } = await execAsync(command, {
  cwd: binaryDir,
  maxBuffer: 10 * 1024 * 1024
})
```

**Problems:**
1. Building command as string is vulnerable to injection
2. Even with quotes, specially crafted paths could break out
3. `execAsync()` spawns a shell, increasing attack surface

**Recommendation:** Use `spawn()` with array arguments:

```typescript
import { spawn } from 'child_process'

private async runWhisper(audioPath: string): Promise<TranscriptSegment[]> {
  // ...
  const args = [
    '-m', modelPath,
    '-f', audioPath,
    '-l', 'en',
    '-oj',
    '--print-progress',
    '-ml', '0',
    '-sow',
    '-bo', '5',
    '-bs', '5',
    '-et', '2.0',
    '-lpt', '-1.0',
    '--prompt', 'This is a recording session with browser interactions, clicking, navigation, and voice commentary."'
  ]
  
  return new Promise<TranscriptSegment[]>((resolve, reject) => {
    const child = spawn(whisperPath, args, {
      cwd: binaryDir,
      maxBuffer: 10 * 1024 * 1024
    })
    
    let stdout = ''
    let stderr = ''
    
    child.stdout?.on('data', (data) => stdout += data)
    child.stderr?.on('data', (data) => stderr += data)
    
    child.on('close', (code) => {
      if (code === 0) {
        // Process output
        resolve(/* ... */)
      } else {
        reject(new Error(`Whisper exited with code ${code}`))
      }
    })
    
    child.on('error', reject)
  })
}
```

---

### 2.3 Settings Update Type Bypass

**Location:** [`electron/ipc/session.ts`](electron/ipc/session.ts:68-78, 99-105)

**Issue:** No validation of incoming settings data:

```typescript
ipcMain.handle('settings-update', async (_, updates: unknown) => {
  return handleIpc(async () => {
    const settings = getSettingsStore()
    settings.update(updates as any)  // ⚠️ Type assertion bypass
    // ...
  }, 'Failed to update settings')
})

ipcMain.handle('user-preferences-update', async (_, preferences: unknown) => {
  return handleIpc(async () => {
    const settings = getSettingsStore()
    settings.updateUserPreferences(preferences as any)  // ⚠️ Type assertion bypass
    // ...
  }, 'Failed to update user preferences')
})
```

**Problems:**
1. `as any` completely bypasses TypeScript validation
2. No runtime validation of data structure
3. Could inject malicious settings

**Recommendation:**

```typescript
// electron/utils/validation.ts
export function validateSettingsUpdate(data: unknown): data is Partial<AppSettings> {
  if (!data || typeof data !== 'object') return false
  
  const settings = data as Partial<AppSettings>
  
  // Validate nested objects
  if (settings.whisper && typeof settings.whisper !== 'object') return false
  if (settings.voiceDistribution && typeof settings.voiceDistribution !== 'object') return false
  if (settings.output && typeof settings.output !== 'object') return false
  if (settings.userPreferences && typeof settings.userPreferences !== 'object') return false
  
  // Validate specific fields
  if (settings.whisper?.transcriptionTimeoutMs !== undefined) {
    if (typeof settings.whisper.transcriptionTimeoutMs !== 'number') return false
    if (settings.whisper.transcriptionTimeoutMs < 0 || settings.whisper.transcriptionTimeoutMs > 600000) {
      return false  // Max 10 minutes
    }
  }
  
  if (settings.userPreferences?.startUrl !== undefined) {
    if (typeof settings.userPreferences.startUrl !== 'string') return false
    if (settings.userPreferences.startUrl.length > 2048) return false
  }
  
  if (settings.userPreferences?.outputPath !== undefined) {
    if (typeof settings.userPreferences.outputPath !== 'string') return false
    if (settings.userPreferences.outputPath.length > 4096) return false
  }
  
  return true
}

// Usage in IPC handler
ipcMain.handle('settings-update', async (_, updates: unknown) => {
  if (!validateSettingsUpdate(updates)) {
    return ipcError('Invalid settings data structure')
  }
  
  return handleIpc(async () => {
    const settings = getSettingsStore()
    settings.update(updates)  // Now type-safe
    // ...
  }, 'Failed to update settings')
})
```

---

### 2.4 No Input Sanitization for URLs

**Location:** [`electron/utils/validation.ts`](electron/utils/validation.ts:8-22)

**Issue:** `validateUrl()` doesn't sanitize the URL before use:

```typescript
export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' }
  }

  try {
    const parsed = new URL(url)
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return { valid: false, error: `Protocol ${parsed.protocol} is not allowed. Use http: or https:` }
    }
    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}
```

**Problems:**
1. Doesn't check for data URLs (`data:`)
2. Doesn't check for javascript URLs (`javascript:`)
3. Doesn't validate hostname
4. Could be used for SSRF attacks

**Recommendation:**

```typescript
const ALLOWED_PROTOCOLS = ['http:', 'https:'] as const
const BLOCKED_PATTERNS = [
  /^data:/i,
  /^javascript:/i,
  /^file:/i,
  /^(127\.|0x7f|0x0|localhost)/i,  // Localhost variants
]

export function validateUrl(url: string): { valid: boolean; error?: string; sanitized?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' }
  }

  // Trim whitespace
  const trimmed = url.trim()
  
  // Check for blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'URL contains blocked pattern' }
    }
  }

  try {
    const parsed = new URL(trimmed)
    
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol as any)) {
      return { valid: false, error: `Protocol ${parsed.protocol} is not allowed. Use http: or https:` }
    }
    
    // Validate hostname
    if (!parsed.hostname || parsed.hostname.length === 0) {
      return { valid: false, error: 'Invalid hostname' }
    }
    
    // Check for IP address (optional, may want to allow)
    const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(parsed.hostname)
    
    return { valid: true, sanitized: trimmed }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}
```

---

### 2.5 IPC Handler Duplicate Registration Risk

**Location:** [`electron/ipc/handlers.ts`](electron/ipc/handlers.ts:5-23)

**Issue:** Flag-based duplicate prevention doesn't handle all edge cases:

```typescript
let handlersRegistered = false

export function registerAllHandlers(mainWindow: BrowserWindow | null): void {
  if (handlersRegistered) {
    return
  }
  
  registerRecordingHandlers(mainWindow)
  registerSessionHandlers()
  registerSettingsHandlers()
  
  handlersRegistered = true
}
```

**Problems:**
1. Flag never resets (even after hot reload)
2. No cleanup on window close
3. Could lead to memory leaks in dev mode

**Recommendation:**

```typescript
const registeredHandlers = new Set<string>()

export function registerAllHandlers(mainWindow: BrowserWindow | null): void {
  // Don't re-register existing handlers
  if (registeredHandlers.size > 0) {
    logger.warn('Handlers already registered, skipping')
    return
  }
  
  registerRecordingHandlers(mainWindow)
  registerSessionHandlers()
  registerSettingsHandlers()
  
  // Track which handlers were registered
  const handlerChannels = [
    'start-recording', 'stop-recording', 'pause-recording',
    'resume-recording', 'save-session', 'settings-get-all',
    'settings-update', 'settings-reset', 'user-preferences-get',
    'user-preferences-update'
  ]
  handlerChannels.forEach(channel => registeredHandlers.add(channel))
}

export function cleanupHandlers(): void {
  for (const channel of registeredHandlers) {
    ipcMain.removeHandler(channel)
  }
  registeredHandlers.clear()
  logger.debug(`Cleaned up ${registeredHandlers.size} IPC handlers`)
}
```

---

### 2.6 File System Operations Without Path Validation

**Location:** [`electron/utils/fs.ts`](electron/utils/fs.ts:9-16)

**Issue:** `writeJson()` and `writeText()` don't validate paths:

```typescript
export async function writeJson(filePath: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2)
  await fs.promises.writeFile(filePath, content, 'utf-8')
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await fs.promises.writeFile(filePath, content, 'utf-8')
}
```

**Problems:**
1. No path validation before writing
2. Could overwrite arbitrary files
3. No check for directory traversal

**Recommendation:**

```typescript
import { validateOutputPath } from './validation'

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  // Validate path before writing
  const validation = validateOutputPath(filePath)
  if (!validation.valid) {
    throw new Error(`Invalid file path: ${validation.error}`)
  }
  
  const content = JSON.stringify(data, null, 2)
  await fs.promises.writeFile(filePath, content, 'utf-8')
}

export async function writeText(filePath: string, content: string): Promise<void> {
  const validation = validateOutputPath(filePath)
  if (!validation.valid) {
    throw new Error(`Invalid file path: ${validation.error}`)
  }
  
  await fs.promises.writeFile(filePath, content, 'utf-8')
}
```

---

### 2.7 Audio Buffer Validation Insufficient

**Location:** [`electron/utils/validation.ts`](electron/utils/validation.ts:36-47)

**Issue:** Only validates size, not format:

```typescript
export function validateAudioBuffer(buffer: ArrayBuffer): { valid: boolean; error?: string } {
  if (!buffer || !(buffer instanceof ArrayBuffer)) {
    return { valid: false, error: 'Invalid audio buffer' }
  }
  if (buffer.byteLength > MAX_AUDIO_SIZE) {
    return { valid: false, error: `Audio buffer too large (max ${MAX_AUDIO_SIZE / 1024 / 1024}MB)` }
  }
  if (buffer.byteLength === 0) {
    return { valid: false, error: 'Audio buffer is empty' }
  }
  return { valid: true }
}
```

**Problems:**
1. Doesn't validate WebM format
2. Doesn't check for malicious patterns
3. Could accept arbitrary binary data

**Recommendation:**

```typescript
const MIN_AUDIO_SIZE = 100 // 100 bytes minimum
const WEBM_MAGIC_NUMBER = [0x1A, 0x45, 0xDF, 0xA3] // WebM header

export function validateAudioBuffer(buffer: ArrayBuffer): { valid: boolean; error?: string } {
  if (!buffer || !(buffer instanceof ArrayBuffer)) {
    return { valid: false, error: 'Invalid audio buffer' }
  }
  if (buffer.byteLength > MAX_AUDIO_SIZE) {
    return { valid: false, error: `Audio buffer too large (max ${MAX_AUDIO_SIZE / 1024 / 1024}MB)` }
  }
  if (buffer.byteLength < MIN_AUDIO_SIZE) {
    return { valid: false, error: `Audio buffer too small (min ${MIN_AUDIO_SIZE} bytes)` }
  }
  
  // Check WebM magic number (first 4 bytes)
  const view = new Uint8Array(buffer)
  if (view.length < 4) {
    return { valid: false, error: 'Audio buffer too short to validate format' }
  }
  
  for (let i = 0; i < WEBM_MAGIC_NUMBER.length; i++) {
    if (view[i] !== WEBM_MAGIC_NUMBER[i]) {
      return { valid: false, error: 'Invalid audio format (expected WebM)' }
    }
  }
  
  return { valid: true }
}
```

---

## 3. DRY Violations

### 3.1 Session ID Generation (Duplicated 2x)

**Files:**
- [`electron/ipc/recording.ts`](electron/ipc/recording.ts:73-78)
- [`electron/session/writer.ts`](electron/session/writer.ts:17-22)

**Violation:** Identical timestamp-to-session-ID conversion logic.

---

### 3.2 Duration Formatting (Duplicated 2x)

**Files:**
- [`electron/session/writer.ts`](electron/session/writer.ts:176-185)
- [`electron/utils/enhancedTranscript.ts`](electron/utils/enhancedTranscript.ts:260-269)

**Violation:** Identical `formatDuration()` implementations.

---

### 3.3 Timestamp Formatting (Duplicated 2x)

**Files:**
- [`electron/utils/enhancedTranscript.ts`](electron/utils/enhancedTranscript.ts:250-255)
- [`electron/utils/voiceDistribution.ts`](electron/utils/voiceDistribution.ts:310-315)

**Violation:** Nearly identical MM:SS formatting.

---

### 3.4 Action Validation (Duplicated 2x)

**Files:**
- [`electron/ipc/recording.ts`](electron/ipc/recording.ts:17-28)
- [`electron/ipc/session.ts`](electron/ipc/session.ts:9-27)

**Violation:** Same action structure validation logic.

---

### 3.5 Preference Restoration Pattern (Duplicated 2x)

**File:** [`src/components/RecordingControls.tsx`](src/components/RecordingControls.tsx:215-229, 241-254)

**Violation:** Identical preference reload/restore code in `saveSession()` and `resetSession()`.

---

### 3.6 Audio Stream Cleanup (Duplicated 2x)

**File:** [`src/components/RecordingControls.tsx`](src/components/RecordingControls.tsx:110-113, 127-129)

**Violation:** Identical audio stream cleanup code.

---

### 3.7 IPC Error Handling Pattern (Repeated 8x)

**Files:**
- [`electron/ipc/recording.ts`](electron/ipc/recording.ts:51-52, 56-57, 106-107, 120-122, 143-144, 163-165)
- [`electron/ipc/session.ts`](electron/ipc/session.ts:38-40, 42-45)

**Violation:** Repetitive `ipcError()` and `handleIpc()` patterns.

---

### 3.8 Settings Get/Set Pattern (Repeated 5x)

**File:** [`electron/settings/store.ts`](electron/settings/store.ts:120-188)

**Violation:** Similar getter/setter methods for different settings groups.

---

### 3.9 Log Formatting (Duplicated 2x)

**Files:**
- [`electron/utils/logger.ts`](electron/utils/logger.ts:33-36)
- [`src/components/RecordingControls.tsx`](src/components/RecordingControls.tsx:139-145) (inline console formatting)

**Violation:** Similar timestamp/level formatting logic.

---

### 3.10 Type Re-exports (Unnecessary)

**File:** [`src/types/session.ts`](src/types/session.ts:1-11)

**Violation:** Just re-exports from `shared/types.ts` - adds no value.

---

## 4. Priority Recommendations

### High Priority (Security)

1. **Fix command injection** in Whisper execution (Section 2.2)
2. **Strengthen path validation** (Section 2.1)
3. **Add settings validation** (Section 2.3)
4. **Add URL sanitization** (Section 2.4)

### Medium Priority (Code Quality)

5. **Extract session ID generation** (Section 1.1)
6. **Consolidate duration formatting** (Section 1.2)
7. **Consolidate timestamp formatting** (Section 1.3)
8. **Extract action validation** (Section 1.4)
9. **Fix IPC handler registration** (Section 1.6, 2.5)

### Low Priority (Maintainability)

10. **Split RecordingControls component** (Section 1.8)
11. **Extract preference restoration** (Section 1.10)
12. **Extract audio cleanup** (Section 1.11)
13. **Centralize model paths** (Section 1.7)
14. **Remove unused type re-export** (Section 1.14)

---

## 5. Summary Statistics

| Category | Count | Severity |
|----------|--------|----------|
| Refactoring Opportunities | 15 | Medium |
| Security Flaws | 7 | High |
| DRY Violations | 10 | Low-Medium |

**Total Issues Identified:** 32

---

## 6. Conclusion

The Dodo Recorder codebase demonstrates good overall architecture and documentation. The primary areas for improvement are:

1. **Security hardening** - Path validation, command execution, and input sanitization need strengthening
2. **Code deduplication** - Several formatting and validation functions are duplicated across files
3. **Component organization** - Some components handle too many responsibilities

Addressing the high-priority security issues should be the first priority, followed by code quality improvements to reduce technical debt and improve maintainability.
