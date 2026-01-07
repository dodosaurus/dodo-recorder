# Dodo Recorder - Architecture Documentation

## What This Project Does

**Dodo Recorder** is a desktop application that records browser interactions (clicks, typing, navigation) while simultaneously capturing voice commentary. It produces structured JSON files that AI models can use to automatically generate Playwright test scripts. Think of it as a "screen recorder" but instead of video, it captures actionable test data.

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

```typescript
// Creates the app window
createWindow() // Lines 48-78

// IPC handlers (like API endpoints)
ipcMain.handle('start-recording', ...) // Line 124
ipcMain.handle('stop-recording', ...) // Line 151
ipcMain.handle('transcribe-audio', ...) // Line 182
```

**Key responsibilities:**
- Creates the BrowserWindow (the app UI)
- Manages three main subsystems:
  - [`BrowserRecorder`](electron/browser/recorder.ts:6) - Records browser interactions
  - [`Transcriber`](electron/audio/transcriber.ts:20) - Converts voice to text
  - [`SessionWriter`](electron/session/writer.ts:7) - Saves session data to disk

### 2. **Browser Recorder** ([`electron/browser/recorder.ts`](electron/browser/recorder.ts:1))
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

### 3. **Audio Transcriber** ([`electron/audio/transcriber.ts`](electron/audio/transcriber.ts:1))
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

### 4. **Voice Distribution Algorithm** ([`electron/utils/voiceDistribution.ts`](electron/utils/voiceDistribution.ts:1))
Intelligently associates voice commentary with browser actions:

**The challenge:** User might say "Now I'll click the submit button" 2 seconds before actually clicking. The algorithm:
- Looks backward 10 seconds from each action
- Looks forward 5 seconds from each action
- Assigns voice segments to the nearest action
- Handles overlapping segments (long commentary spanning multiple actions)

This ensures AI models understand the user's intent for each action.

### 5. **React UI** ([`src/App.tsx`](src/App.tsx:1))
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

### 6. **Session Writer** ([`electron/session/writer.ts`](electron/session/writer.ts:1))
Saves everything to disk in a streamlined, LLM-optimized format:

**Output structure:**
```
session-2026-01-05-095500/
├── actions.json       # All browser actions with locators (clean, no voice data)
├── transcript.txt     # Voice commentary with embedded action/screenshot references
└── screenshots/       # Screenshots captured during session
    ├── screenshot-14227.png
    └── ...
```

**Design rationale:**
- **Minimal output**: Only 3 essential components for clarity
- **Clean actions.json**: Actions without embedded voice data, each with unique ID
- **Integrated transcript.txt**: Voice commentary with embedded references to actions and screenshots
- **LLM-optimized**: Format designed for AI consumption to generate Playwright tests
- **Human-readable**: Test automation engineers can quickly understand the session

---

## Data Flow Example

Here's what happens when you record a session:

1. **User clicks "Start Recording"** in React UI
2. React calls `window.electron.startRecording(url, outputPath)`
3. **IPC message** sent to main process
4. Main process creates:
   - [`BrowserRecorder`](electron/browser/recorder.ts:6) → launches Chromium
   - [`Transcriber`](electron/audio/transcriber.ts:20) → initializes Whisper
5. **User interacts with browser:**
   - Injected script captures click → sends to recorder
   - Recorder emits 'action' event → main process forwards to React
   - React updates UI with new action
6. **User speaks into microphone:**
   - React captures audio chunks via Web Audio API
   - Sends chunks to main process via IPC
   - Main process queues for transcription
7. **User clicks "Stop Recording":**
   - Browser closes, actions collected
   - Audio transcribed to text segments
   - Voice segments distributed across actions
   - Everything saved to disk via [`SessionWriter`](electron/session/writer.ts:7)

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
| **Deployment** | Deploy to Vercel | Build native app (`.dmg`, `.exe`) |

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
- **Whisper.cpp** - Local voice transcription (via whisper-node)
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
   - Works offline

5. **Same Accuracy**
   - Uses identical model weights from OpenAI
   - Same transcription quality as OpenAI's API
   - Just runs locally instead of in the cloud

### The GGML Format

The `.bin` files you see (like `ggml-base.en.bin`) are:
- OpenAI's Whisper model weights
- Converted to GGML format (Georgi Gerganov's ML format)
- Optimized for CPU inference
- Quantized for smaller file sizes and faster processing

### Model Size Trade-offs

```
tiny.en   (75 MB)  → Fast but basic accuracy
base.en   (142 MB) → Good balance ✓ (default choice)
small.en  (466 MB) → Better accuracy, slower
medium.en (1.5 GB) → Best accuracy, much slower
```

The project defaults to `base.en` because it offers the best balance of:
- Accuracy (good enough for voice commentary)
- Speed (transcribes in reasonable time)
- Size (doesn't bloat the app download)

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

We're using **OpenAI's Whisper model**, just running it locally via the `whisper.cpp` implementation instead of calling OpenAI's cloud API. It's the same AI, different execution environment - optimized for desktop apps that need privacy, offline capability, and no recurring costs.
