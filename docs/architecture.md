# Architecture

## Two-Process Model

Electron applications run in two isolated processes:

1. **Main Process** ([`electron/main.ts`](electron/main.ts:1))
   - Node.js backend with full OS access
   - Manages application lifecycle, windows, IPC handlers
   - Cannot access DOM

2. **Renderer Process** ([`src/App.tsx`](src/App.tsx:1))
   - React UI running in Chromium
   - Sandboxed, no direct Node.js access
   - Standard React application

**Communication:** IPC (Inter-Process Communication) via [`preload.ts`](electron/preload.ts:1)
- Renderer → Main: `window.electronAPI.startRecording()`
- Main → Renderer: `mainWindow.webContents.send('action-recorded')`

---

## Core Components

### 1. Main Process ([`electron/main.ts`](electron/main.ts:1))

**Responsibilities:**
- Creates BrowserWindow
- Initializes settings and permissions
- Registers IPC handlers via [`registerAllHandlers()`](electron/ipc/handlers.ts:12)
- Cleans up temporary files on startup
- Handles window controls (minimize, maximize, close)

### 2. IPC Handlers ([`electron/ipc/`](electron/ipc/))

**[`handlers.ts`](electron/ipc/handlers.ts:1)** - Central registration:
```typescript
export function registerAllHandlers(mainWindow: BrowserWindow | null) {
  registerRecordingHandlers(mainWindow)
  registerSessionHandlers()
  registerSettingsHandlers()
}
```

**[`recording.ts`](electron/ipc/recording.ts:1)** - Recording handlers:
- `start-recording` - Initializes BrowserRecorder, Transcriber, SessionWriter
- `stop-recording` - Stops browser recording, returns actions
- `transcribe-audio` - Transcribes audio via Whisper
- `distribute-voice-segments` - Associates voice with actions
- `generate-full-transcript` - Generates timestamped transcript

**[`session.ts`](electron/ipc/session.ts:1)** - Session & settings handlers:
- `save-session` - Saves session bundle to disk
- `settings-get-all`, `settings-update`, `settings-reset`
- `user-preferences-get`, `user-preferences-update`

### 3. Browser Recorder ([`electron/browser/recorder.ts`](electron/browser/recorder.ts:1))

**Process:**
1. Launches Playwright Chromium browser (headless: false)
2. Injects tracking code via `page.addInitScript()` before page loads
3. Injected script listens for DOM events (click, input, keypress)
4. Events call `window.__dodoRecordAction()` to send data to Electron
5. Captures rich locator information for each element:
   - `data-testid`, `id`, ARIA roles/labels
   - Text content, CSS selectors, XPath
   - Multiple strategies with confidence levels

**Example captured action:**
```json
{
  "id": "uuid",
  "timestamp": 1234,
  "type": "click",
  "target": {
    "selector": "button:has-text('Submit')",
    "testId": "submit-btn",
    "role": "button",
    "locators": [
      { "strategy": "testId", "value": "[data-testid='submit-btn']", "confidence": "high" },
      { "strategy": "role", "value": "getByRole('button', { name: 'Submit' })", "confidence": "high" }
    ]
  }
}
```

### 4. Audio Transcriber ([`electron/audio/transcriber.ts`](electron/audio/transcriber.ts:1))

Converts voice recordings to text using Whisper.cpp (local, no cloud):

```
WebM Buffer → FFmpeg (16kHz mono WAV + 1.5s silence padding) 
  → Whisper.cpp CLI → JSON output → Timestamped segments
```

**FFmpeg conversion:**
```typescript
ffmpeg(inputPath)
  .audioFrequency(16000)  // 16kHz sample rate
  .audioChannels(1)        // Mono
  .audioCodec('pcm_s16le') // PCM format
  .audioFilters([
    'apad=pad_dur=1.5',   // Padding technique for early speech detection
    'areverse',
    'apad=pad_dur=1.5',
    'areverse'
  ])
```

**Whisper parameters:**
- Model: `small.en` (466MB)
- Entropy threshold: `2.0` (aggressive early detection)
- Beam search: 5 candidates
- Max segment length: 50 characters
- Split on word boundaries

### 5. Voice Distribution ([`electron/utils/voiceDistribution.ts`](electron/utils/voiceDistribution.ts:1))

Associates voice commentary with browser actions using temporal proximity:

**Algorithm:**
- Lookback window: 4 seconds (speech precedes action)
- Lookahead window: 2 seconds (confirmations)
- Assigns voice segments to nearest actions
- Handles long commentary spanning multiple actions

### 6. Settings System ([`electron/settings/store.ts`](electron/settings/store.ts:1))

Persistent JSON file storage in user data directory:

```typescript
interface AppSettings {
  whisper: {
    transcriptionTimeoutMs: number
  }
  voiceDistribution: {
    lookbackMs: number        // 4000ms
    lookaheadMs: number        // 2000ms
    longSegmentThresholdMs: number  // 2000ms
  }
  output: {
    includeScreenshots: boolean
    prettyPrintJson: boolean
  }
  userPreferences: {
    startUrl: string
    outputPath: string
  }
  audio: {
    selectedMicrophoneId?: string
  }
}
```

### 7. Utility Modules ([`electron/utils/`](electron/utils/))

**[`fs.ts`](electron/utils/fs.ts:1)** - File system helpers:
- `ensureDir()`, `writeJson()`, `writeText()`, `cleanupOldTempFiles()`

**[`ipc.ts`](electron/utils/ipc.ts:1)** - IPC response helpers:
- `handleIpc()`, `ipcSuccess()`, `ipcError()`

**[`logger.ts`](electron/utils/logger.ts:1)** - Environment-aware logging:
- Uses electron-log with sanitization
- Levels: debug, info, warn, error

**[`validation.ts`](electron/utils/validation.ts:1)** - Input validation:
- `validateUrl()`, `validateOutputPath()`, `validateAudioBuffer()`, `sanitizeSessionId()`

### 8. React UI ([`src/App.tsx`](src/App.tsx:1))

```
App
├── TitleBar (window controls)
├── Header (branding + StatusBar)
├── Sidebar
│   ├── SettingsPanel
│   └── RecordingControls
└── Main (ActionsList or ActionsList + TranscriptView)
```

**State:** Zustand store ([`src/stores/recordingStore.ts`](src/stores/recordingStore.ts:1))

### 9. Session Writer ([`electron/session/writer.ts`](electron/session/writer.ts:1))

Saves sessions to disk in LLM-optimized format:

```
session-YYYY-MM-DD-HHMMSS/
├── INSTRUCTIONS.md    # Reusable AI instructions (framework-agnostic)
├── actions.json       # _meta + narrative + actions (all-in-one)
└── screenshots/       # PNG files
```

---

## Data Flow

**Recording lifecycle:**

1. **Start Recording**
   - React: `window.electronAPI.startRecording(url, outputPath, startTime)`
   - IPC: [`recording.ts:start-recording`](electron/ipc/recording.ts:48)
   - Main: Creates BrowserRecorder, SessionWriter, Transcriber
   - Browser: Launches Chromium, injects scripts

2. **User Interactions**
   - Browser: Injected script captures events → `__dodoRecordAction()`
   - Recorder: Emits 'action' event → forwarded to React via IPC
   - React: Updates UI with new action in real-time

3. **Voice Recording**
   - React: Captures audio chunks via MediaRecorder (WebM, 16kHz)
   - Audio accumulated in renderer memory (not streamed)

4. **Stop Recording**
   - React: `window.electronAPI.stopRecording()`
   - Browser closes, actions collected
   - React: `window.electronAPI.transcribeAudio(buffer)`
   - Transcriber: Converts audio, returns timestamped segments
   - React: `window.electronAPI.distributeVoiceSegments()`
   - React: `window.electronAPI.generateTranscriptWithReferences()`
   - Transcript available for viewing

5. **Save Session**
   - React: `window.electronAPI.saveSession(bundle)`
   - SessionWriter: Writes INSTRUCTIONS.md (once), actions.json, screenshots/

---

## Project Structure

```
dodo-recorder/
├── electron/                    # Main process
│   ├── main.ts                 # Entry point
│   ├── preload.ts              # IPC bridge
│   ├── audio/
│   │   └── transcriber.ts      # Whisper.cpp integration
│   ├── browser/
│   │   ├── recorder.ts         # Playwright recording
│   │   ├── recording-widget.ts # Browser widget
│   │   ├── injected-script.ts  # Event tracking
│   │   └── hover-highlighter.ts # Assertion highlighting
│   ├── ipc/
│   │   ├── handlers.ts         # Central registration
│   │   ├── recording.ts        # Recording handlers
│   │   └── session.ts          # Session/settings handlers
│   ├── session/
│   │   ├── writer.ts           # Session output
│   │   └── instructions-template.ts # INSTRUCTIONS.md template
│   ├── settings/
│   │   └── store.ts            # Settings persistence
│   └── utils/
│       ├── enhancedTranscript.ts # Transcript generation
│       ├── voiceDistribution.ts  # Voice-to-action association
│       ├── fs.ts, ipc.ts, logger.ts, validation.ts
├── src/                        # Renderer process
│   ├── App.tsx                 # Main React app
│   ├── components/
│   │   ├── RecordingControls.tsx, ActionsList.tsx
│   │   ├── SettingsPanel.tsx, TranscriptView.tsx
│   │   ├── MicrophoneSelector.tsx, AudioLevelMeter.tsx
│   │   ├── StatusBar.tsx, TitleBar.tsx
│   │   └── ui/ (button, input, select, switch, dialog)
│   ├── stores/
│   │   └── recordingStore.ts   # Zustand state
│   ├── lib/
│   │   └── audioDevices.ts     # Microphone enumeration
│   └── types/
│       ├── electron.d.ts       # Electron API types
│       └── session.ts          # Type re-exports
├── shared/
│   └── types.ts                # Shared types (RecordedAction, SessionBundle, etc.)
├── models/                     # Whisper components
│   ├── unix/whisper            # macOS binary (committed)
│   ├── win/whisper-cli.exe     # Windows binary (committed)
│   └── ggml-small.en.bin      # Model weights (download manually, gitignored)
└── docs/                       # Documentation
```

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Electron** | Desktop app framework |
| **Playwright** | Browser automation |
| **Whisper.cpp** | Local speech-to-text (OpenAI's Whisper via C++ port) |
| **React 18** | UI library |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Styling |
| **Zustand** | State management |
| **Vite** | Build tool |
| **electron-log** | Production logging |

---

## Whisper Integration

### Why whisper.cpp (ggerganov port)?

Uses OpenAI's Whisper model (same weights, same accuracy) but runs locally via C++ implementation:

**Benefits:**
- **Privacy:** No cloud API calls, no audio uploaded
- **No costs:** Free after model download
- **Performance:** Faster than Python, optimized for CPU
- **Offline:** No internet required
- **Desktop integration:** Easy to bundle

### Model: small.en

**Characteristics:**
- Size: 466 MB disk, ~1.0 GB RAM during transcription
- Speed: ~2-3x real-time (10s audio → 3-5s transcription)
- Quality: Better accuracy for technical terms (LinkedIn, GitHub)
- Early speech detection: Reliable with optimized parameters

**Location:**
```
models/
├── unix/whisper            # macOS binary (committed)
├── win/whisper-cli.exe     # Windows binary (committed)
└── ggml-small.en.bin      # Weights (download manually)
```

**Download command:**
```bash
curl -L -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin
```
