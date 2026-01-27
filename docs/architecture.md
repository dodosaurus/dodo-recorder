# Dodo Recorder - Architecture Documentation

## Architecture Overview (Electron Parallels to React/Next.js)

### **Two-Process Architecture**

Unlike a web app that runs entirely in the browser, Electron has **two separate processes**:

1. **Main Process** ([`electron/main.ts`](electron/main.ts:1)) - Like a Node.js backend server
   - Has full access to Node.js APIs (file system, native OS features)
   - Manages application lifecycle and windows
   - Cannot directly access the DOM
   - Similar to Next.js API routes, but more powerful

2. **Renderer Process** ([`src/App.tsx`](src/App.tsx:1)) - Like your React frontend
   - Runs your React UI code
   - Sandboxed for security (no direct Node.js access)
   - Exactly like a normal React app in the browser

### **Communication Bridge: IPC (Inter-Process Communication)**

Since these processes are isolated, they communicate via **IPC channels** - think of it like API calls between frontend and backend:

- **Frontend → Backend**: [`window.electron.startRecording()`](electron/preload.ts:1)
- **Backend → Frontend**: [`mainWindow.webContents.send('action-recorded')`](electron/main.ts:141)

The [`preload.ts`](electron/preload.ts:1) file acts as a secure bridge, exposing only specific functions to the renderer (like an API gateway).

---

## Core Components Breakdown

### 1. **Main Process** ([`electron/main.ts`](electron/main.ts:1))
The "backend server" that orchestrates everything:

**Key responsibilities:**
- Creates the BrowserWindow (the app UI)
- Initializes application settings
- Requests microphone permissions
- Registers IPC handlers via [`registerAllHandlers()`](electron/ipc/handlers.ts:12)
- Cleans up temporary files on startup
- Handles window controls (minimize, maximize, close)
- Provides simple IPC handlers (file dialogs, permission checks)

**Architecture note:** The main process delegates most IPC handling to specialized modules rather than implementing everything directly.

### 2. **IPC Handler Organization** ([`electron/ipc/`](electron/ipc/))
IPC handlers are organized into separate modules for better maintainability:

**[`handlers.ts`](electron/ipc/handlers.ts:1)** - Central registration point:
```typescript
export function registerAllHandlers(mainWindow: BrowserWindow | null) {
  registerRecordingHandlers(mainWindow)
  registerSessionHandlers()
  registerSettingsHandlers()
}
```

**[`recording.ts`](electron/ipc/recording.ts:1)** - Recording-related IPC handlers:
- `start-recording` - Initializes BrowserRecorder, Transcriber, and SessionWriter
- `stop-recording` - Stops browser recording and returns actions
- `transcribe-audio` - Transcribes audio buffer using Whisper
- `distribute-voice-segments` - Associates voice commentary with actions
- `generate-full-transcript` - Generates timestamped transcript text

**[`session.ts`](electron/ipc/session.ts:1)** - Session and settings IPC handlers:
- `save-session` - Saves session bundle to disk
- `settings-get-all` - Retrieves all application settings
- `settings-update` - Updates settings (partial updates supported)
- `settings-reset` - Resets settings to defaults
- `user-preferences-get` - Retrieves user preferences (startUrl, outputPath)
- `user-preferences-update` - Updates user preferences

**Design benefits:**
- Clear separation of concerns
- Easier testing and maintenance
- Prevents duplicate registration on hot reload
- Better code organization for complex IPC logic

### 3. **Browser Recorder** ([`electron/browser/recorder.ts`](electron/browser/recorder.ts:1))
The most complex component - launches a Chromium browser and captures user actions:

**How it works:**
1. **Launches Playwright browser** (Line 16-19):
   ```typescript
   this.browser = await chromium.launch({ headless: false })
   ```

2. **Injects tracking code** into every page (Lines 48-294):
   - Uses [`page.addInitScript()`](electron/browser/recorder.ts:48) to inject JavaScript before page loads
   - This injected code listens for DOM events (click, input, keypress)
   - When events occur, it calls [`__dodoRecordAction()`](electron/browser/recorder.ts:39) to send data back to Electron

3. **Captures rich locator information** (Lines 122-198):
   - For each element interacted with, generates multiple selector strategies:
     - `data-testid` attributes (highest priority)
     - `id` attributes
     - ARIA roles and labels
     - Text content
     - CSS selectors
     - XPath (fallback)
   - This gives AI models multiple ways to locate elements when generating tests

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

### 4. **Audio Transcriber** ([`electron/audio/transcriber.ts`](electron/audio/transcriber.ts:1))
Converts voice recordings to text using **Whisper.cpp** (OpenAI's speech recognition model running locally):

**Process flow:**
1. Receives audio buffer from renderer (WebM format)
2. Converts to WAV using FFmpeg (Lines 71-88):
   ```typescript
   ffmpeg(inputPath)
     .audioFrequency(16000)  // 16kHz sample rate
     .audioChannels(1)        // Mono
     .audioCodec('pcm_s16le') // PCM format
   ```
3. Runs Whisper model (Lines 101-155) - produces timestamped text segments
4. Returns structured segments with start/end times

**Why local processing?** Privacy and speed - no data sent to cloud services.

### 5. **Voice Distribution Algorithm** ([`electron/utils/voiceDistribution.ts`](electron/utils/voiceDistribution.ts:1))
Intelligently associates voice commentary with browser actions:

**The challenge:** User might say "Now I'll click the submit button" 2 seconds before actually clicking. The algorithm:
- Looks backward 4 seconds from each action
- Looks forward 2 seconds from each action
- Assigns voice segments to the nearest action
- Handles overlapping segments (long commentary spanning multiple actions)

This ensures AI models understand the user's intent for each action.

### 6. **Settings System** ([`electron/settings/store.ts`](electron/settings/store.ts:1))
Persistent settings management with JSON file storage:

**SettingsStore class features:**
- Persists settings to user data directory (`~/Library/Application Support/dodo-recorder/settings.json` on macOS)
- Automatically merges with defaults for missing fields
- Provides type-safe access to settings

**Settings structure:**
```typescript
interface AppSettings {
  whisper: {
    transcriptionTimeoutMs: number
  }
  voiceDistribution: {
    lookbackMs: number        // 4 seconds default
    lookaheadMs: number        // 2 seconds default
    longSegmentThresholdMs: number  // 2 seconds default
  }
  output: {
    includeScreenshots: boolean
    prettyPrintJson: boolean
  }
  userPreferences: {
    startUrl: string
    outputPath: string
  }
}
```

**Usage:**
- Settings loaded on app startup
- Voice distribution windows updated dynamically when settings change
- User preferences remembered between sessions
- Model is hard-coded to `small.en` (no user selection)

### 7. **Utility Modules** ([`electron/utils/`](electron/utils/))
Shared utility functions for common operations:

**[`fs.ts`](electron/utils/fs.ts:1)** - File system helpers:
- `ensureDir()` - Creates directories recursively
- `writeJson()` - Writes formatted JSON files
- `writeText()` - Writes text files
- `cleanupOldTempFiles()` - Removes temporary files older than specified age

**[`ipc.ts`](electron/utils/ipc.ts:1)** - IPC response helpers:
- `handleIpc()` - Wraps async operations with error handling
- `ipcSuccess()` - Creates success response
- `ipcError()` - Creates error response

**[`logger.ts`](electron/utils/logger.ts:1)** - Environment-aware logging:
- Sanitizes sensitive data (paths, tokens) in production
- Supports debug, info, warn, error levels
- Timestamp formatting
- Development mode shows full output

**[`validation.ts`](electron/utils/validation.ts:1)** - Input validation:
- `validateUrl()` - Ensures valid HTTP/HTTPS URLs
- `validateOutputPath()` - Prevents path traversal attacks
- `validateAudioBuffer()` - Checks buffer size and format
- `sanitizeSessionId()` - Cleans session identifiers

### 8. **React UI** ([`src/App.tsx`](src/App.tsx:1))
Standard React application with Tailwind CSS:

**Component structure:**
```
App
├── TitleBar (custom window controls)
├── Header (app branding)
├── Sidebar
│   ├── SettingsPanel (URL input, output folder)
│   └── RecordingControls (start/stop buttons, voice toggle)
└── ActionsList (live feed of recorded actions)
```

**State management:** Uses [Zustand](src/stores/recordingStore.ts:1) (simpler alternative to Redux):
```typescript
const useRecordingStore = create((set) => ({
  status: 'idle',
  actions: [],
  transcriptSegments: [],
  addAction: (action) => set((state) => ({ 
    actions: [...state.actions, action] 
  }))
}))
```

### 9. **Session Writer** ([`electron/session/writer.ts`](electron/session/writer.ts:1))
Saves everything to disk in a compact, LLM-optimized format:

**Output structure:**
```
session-2026-01-05-095500/
├── INSTRUCTIONS.md    # General, reusable AI instructions (framework-agnostic)
├── actions.json       # Complete session data (_meta + narrative + actions)
└── screenshots/       # Screenshots captured during session
    ├── screenshot-14227.png
    └── ...
```

**Design rationale:**
- **Token-optimized**: Few tokens per session (INSTRUCTIONS.md reused)
- **Single source**: All session data in actions.json (_meta + narrative + actions)
- **Reusable instructions**: INSTRUCTIONS.md shared across all sessions in output directory
- **Framework-agnostic**: Works with Playwright, Cypress, Selenium, Puppeteer, any framework
- **AI-ready**: Complete instructions embedded, no external documentation needed
- **Human-readable**: Clear structure engineers can quickly understand

---

## Data Flow Example

Here's what happens when you record a session:

1. **User clicks "Start Recording"** in React UI
   - React calls `window.electron.startRecording(url, outputPath, startTime)`
   
2. **IPC message** sent to main process
   - Handled by [`recording.ts:start-recording`](electron/ipc/recording.ts:48)
   
3. **Recording handler initializes subsystems:**
   - Gets settings from [`SettingsStore`](electron/settings/store.ts:58)
   - Creates [`BrowserRecorder`](electron/browser/recorder.ts:6) → launches Chromium
   - Creates [`SessionWriter`](electron/session/writer.ts:7) → prepares output directory
   - Creates [`Transcriber`](electron/audio/transcriber.ts:20) → initializes Whisper model
   - Sets up event listener to forward actions to React
   
4. **User interacts with browser:**
   - Injected script captures click → sends to recorder
   - Recorder emits 'action' event → forwarded to React via IPC
   - React updates UI with new action in real-time
   
5. **User speaks into microphone:**
   - React captures audio chunks via Web Audio API
   - Audio accumulated in renderer process memory
   - No streaming to main process (sent all at once at end)
   
6. **User clicks "Stop Recording":**
   - React calls `window.electron.stopRecording()`
   - Browser closes, actions collected
   - React sends complete audio buffer via `window.electron.transcribeAudio()`
   - Transcriber converts audio and returns timestamped segments
   - React calls `window.electron.distributeVoiceSegments()` to associate voice with actions
   - React calls `window.electron.saveSession()` with complete SessionBundle
   - [`SessionWriter`](electron/session/writer.ts:7) saves to disk:
     - Ensures INSTRUCTIONS.md exists in session directory (writes once)
     - Generates narrative text with embedded action references
     - Strips voiceSegments from actions array
     - Builds actions.json structure (_meta + narrative + actions)
     - Screenshots already saved to screenshots/ folder

---

## Project Structure

```
dodo-recorder/
├── electron/                    # Main process (Node.js backend)
│   ├── main.ts                 # App entry point, window creation
│   ├── preload.ts              # IPC bridge (secure API exposure)
│   ├── audio/
│   │   └── transcriber.ts      # Whisper.cpp integration
│   ├── browser/
│   │   └── recorder.ts         # Playwright browser recording
│   ├── ipc/                    # ⚡ IPC handlers organized by domain
│   │   ├── handlers.ts         # Central registration
│   │   ├── recording.ts        # Recording-related handlers
│   │   └── session.ts          # Session & settings handlers
│   ├── session/
│   │   └── writer.ts           # Session output to disk
│   ├── settings/               # ⚡ Settings persistence
│   │   └── store.ts            # Settings store with JSON file
│   └── utils/                  # ⚡ Shared utilities
│       ├── enhancedTranscript.ts # Transcript generation
│       ├── voiceDistribution.ts  # Voice-to-action association
│       ├── fs.ts               # File system helpers
│       ├── ipc.ts              # IPC response helpers
│       ├── logger.ts           # Environment-aware logging
│       └── validation.ts       # Input validation & sanitization
├── src/                        # Renderer process (React frontend)
│   ├── App.tsx                 # Main React app
│   ├── components/             # React components
│   │   ├── RecordingControls.tsx
│   │   ├── ActionsList.tsx
│   │   ├── SettingsPanel.tsx
│   │   └── ...
│   ├── stores/
│   │   └── recordingStore.ts   # Zustand state management
│   └── types/
│       ├── electron.d.ts       # Electron API types
│       └── session.ts          # Type re-exports
├── shared/                     # ⚡ Types shared between main & renderer
│   └── types.ts                # RecordedAction, SessionBundle, etc.
├── docs/                       # Documentation
├── models/                     # Whisper components
│   ├── whisper                 # Whisper.cpp binary (committed to git)
│   └── ggml-small.en.bin      # AI model weights (download manually, gitignored)
└── shared/                     # Types shared between main & renderer
    └── types.ts                # RecordedAction, SessionBundle, etc.

⚡ = Added/reorganized since initial architecture
```

---

## Key Technologies

| Technology | Purpose | Web Equivalent |
|------------|---------|----------------|
| **Electron** | Desktop app framework | N/A (wraps web tech in native app) |
| **Playwright** | Browser automation | Puppeteer/Selenium |
| **Whisper.cpp** | Local speech-to-text | Google Speech API (but local) |
| **Zustand** | State management | Redux/Context API |
| **IPC (Inter-Process Communication)** | Frontend ↔ Backend | REST API / WebSocket |
| **Vite** | Build tool | Webpack/Next.js bundler |

---

## Electron vs Next.js Mental Model

| Concept | Next.js | Electron |
|---------|---------|----------|
| **Backend** | API routes (`/api/*`) | Main process ([`main.ts`](electron/main.ts:1)) |
| **Frontend** | Pages/Components | Renderer process ([`App.tsx`](src/App.tsx:1)) |
| **Communication** | `fetch('/api/...')` | IPC (`ipcMain.handle` / `ipcRenderer.invoke`) |
| **Server** | Node.js server | Main process (Node.js) |
| **Client** | Browser | BrowserWindow (Chromium) |
| **Development** | Next.js dev server | `npm run dev` (Vite + Electron) |

---

## Why Electron for This Project?

1. **Native OS access** - File system, microphone permissions, system dialogs
2. **Controlled browser** - Playwright needs to launch/control Chromium
3. **Local processing** - Whisper runs locally (no cloud dependencies)
4. **Desktop UX** - Native window controls, always-on-top widget potential
5. **Cross-platform** - One codebase → macOS, Windows, Linux apps

This project couldn't be a pure web app because it needs to:
- Launch and control a separate browser instance
- Access the file system to save sessions
- Run CPU-intensive ML models locally (Whisper)
- Request native OS permissions (microphone)

---

## Tech Stack

- **Electron** - Cross-platform desktop framework
- **React** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Playwright** - Browser automation
- **Whisper.cpp** - Local voice transcription (direct whisper.cpp calls)
- **Zustand** - State management

---

## Whisper Model Choice: Why ggerganov/whisper.cpp?

### The Models Are The Same - Just Different Implementations

**Important:** The `ggerganov/whisper.cpp` models ARE OpenAI's Whisper models. They're the exact same neural network weights that OpenAI trained and released. The difference is in how they're executed:

| Implementation | What It Is | Use Case |
|----------------|------------|----------|
| **OpenAI Whisper API** | Cloud service (API calls) | Web apps, no local processing needed |
| **OpenAI whisper (Python)** | Original Python implementation | Research, server-side processing |
| **whisper.cpp (ggerganov)** | C++ port of Whisper | Desktop apps, embedded systems, privacy-focused |

### Why We Use whisper.cpp (ggerganov's port)

1. **Runs Locally (Privacy)**
   - No audio data sent to OpenAI servers
   - No API keys needed
   - No internet connection required
   - User's voice recordings stay on their machine

2. **No API Costs**
   - OpenAI Whisper API charges per minute of audio
   - whisper.cpp is free once downloaded
   - Important for a tool users might run frequently

3. **Performance**
   - C++ implementation is faster than Python
   - Optimized for CPU inference (no GPU required)
   - Lower memory footprint

4. **Desktop Integration**
   - Easy to bundle with Electron app
   - No external dependencies at runtime

5. **Same Accuracy**
   - Uses identical model weights from OpenAI
   - Same transcription quality as OpenAI's API
   - Just runs locally instead of in the cloud

### The GGML Format

The `.bin` file (`ggml-small.en.bin`) contains:
- OpenAI's Whisper model weights
- Converted to GGML format (Georgi Gerganov's ML format)
- Optimized for CPU inference
- Quantized for smaller file sizes and faster processing

### Bundled Model: small.en

**Characteristics:**
- Size: 466 MB disk, ~1.0 GB RAM during transcription
- Quality: Better accuracy, especially for technical terms (LinkedIn, GitHub, etc.)
- Speed: Medium (~2-3x real-time - 10 seconds of audio transcribes in 3-5 seconds)
- Reliability: Better early speech detection with optimized parameters

**Why small.en?**
- Best balance of accuracy, speed, and size for production use
- Captures early speech reliably (critical for recording sessions)
- No model selection complexity - one model that works well for all users

### Alternative Approaches (Not Used)

**Why not OpenAI API?**
- Requires API key and internet
- Costs money per use
- Privacy concerns (audio sent to cloud)
- Latency from network calls

**Why not Python whisper?**
- Requires Python runtime bundled with app
- Slower than C++ implementation
- Larger app size
- More complex deployment

### Summary

We're using **OpenAI's Whisper small.en model**, running it locally via the `whisper.cpp` implementation instead of calling OpenAI's cloud API. It's the same AI, different execution environment - optimized for desktop apps that need privacy, offline capability, and no recurring costs.
