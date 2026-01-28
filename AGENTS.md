# Agent Guidelines for Dodo Recorder

This document provides coding guidelines and commands for AI agents working on this codebase.

## Project Overview

Dodo Recorder is an Electron + React + TypeScript desktop application for recording browser interactions with Playwright, voice commentary transcription via Whisper.cpp, and generating session bundles for AI-assisted test generation.

**Tech Stack:**
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand (state management)
- **Backend:** Electron 28, Node.js 18+, Playwright
- **Audio:** Whisper.cpp for transcription, ffmpeg for audio processing
- **UI Components:** shadcn/ui patterns (CVA for variants)

## Build/Lint/Test Commands

### Development
```bash
npm run dev                    # Start Vite dev server + Electron in watch mode
```

### Build (for testing only)
```bash
npm run build                  # Build the app for local testing
npm run preview               # Preview Vite build (no Electron)
```

### Output
- Development: Runs from source files
- Test builds: `release/` directory (for local testing only)
- Electron compiled output: `dist-electron/` (main.js, preload.js)
- Renderer compiled output: `dist/`

### Testing
**No automated test suite currently exists.** Manual testing only.

If you add tests:
- Name test files: `*.test.ts` or `*.spec.ts`
- Place alongside source files or in `__tests__` directories
- Consider Jest or Vitest for unit tests

## Code Style Guidelines

### Imports
```typescript
// Group imports: external dependencies → internal modules → types → assets
import { app, BrowserWindow } from 'electron'          // External
import { logger } from './utils/logger'                // Internal
import type { RecordedAction } from '@/types/session'  // Types
import saurusIcon from '@/assets/saurus.png'                 // Assets

// Use path alias @/* for src/ files (configured in tsconfig.json and vite.config.ts)
import { useRecordingStore } from '@/stores/recordingStore'

// Import types separately when possible
import type { SessionBundle, RecordingStatus } from '@/types/session'
```

### TypeScript

**Strict Mode Enabled:**
- `strict: true` in tsconfig.json
- `noUnusedLocals: true` and `noUnusedParameters: true`
- Must handle all type errors

**Type Conventions:**
```typescript
// Use interface for object shapes
interface RecordingState {
  status: RecordingStatus
  actions: RecordedAction[]
}

// Use type for unions, primitives, or utility types
type RecordingStatus = 'idle' | 'recording' | 'paused' | 'processing' | 'saving'

// Shared types live in shared/types.ts (accessible by both main and renderer)
// Renderer-only types in src/types/
// Main process types in electron/ alongside usage

// Always type function parameters and return values
async function validateUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  // Implementation
}

// Use explicit return types for public APIs
export async function start(url: string, screenshotDir?: string): Promise<void> {
  // Implementation
}
```

### React Components

```typescript
// Use function declarations for components (not arrow functions)
export default function App() {
  return <div>...</div>
}

// Use React.forwardRef for components needing refs
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button ref={ref} {...props} />
  }
)
Button.displayName = 'Button'

// Use Zustand for state management (not Context API)
const status = useRecordingStore((state) => state.status)
const setStatus = useRecordingStore((state) => state.setStatus)
```

### Naming Conventions

```typescript
// Files: camelCase for utilities, PascalCase for components/classes
// utils/logger.ts, components/RecordingControls.tsx

// Functions: camelCase, descriptive verb-noun pairs
function validateUrl(url: string) { }
async function requestMicrophonePermission() { }

// Classes: PascalCase
class BrowserRecorder extends EventEmitter { }

// Constants: UPPER_SNAKE_CASE for true constants
const MAX_AUDIO_SIZE = 50 * 1024 * 1024  // 50MB
const ALLOWED_PROTOCOLS = ['http:', 'https:']

// React component props: PascalCase with "Props" suffix
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

// Event handlers: "handle" or "on" prefix
const handleClick = () => { }
const onFrameNavigated = (frame: any) => { }
```

### Error Handling

```typescript
// Use IpcResult pattern for IPC calls
export interface IpcResultSuccess<T = object> {
  success: true
  data?: T
}

export interface IpcResultError {
  success: false
  error: string
}

export type IpcResult<T = object> = (IpcResultSuccess<T> & T) | IpcResultError

// Validate inputs early
function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' }
  }
  // ... more validation
  return { valid: true }
}

// Use try-catch for async operations
try {
  await this.page.goto(url)
} catch (e) {
  logger.error('Failed to navigate:', e)
  throw new Error('Navigation failed')
}

// Use logger utility (not console.log directly in main process)
import { logger } from './utils/logger'
logger.info('Recording started')
logger.error('Failed to start recording:', error)
logger.debug('Debug info')  // Shows in development, logs to file in production

// In renderer process (React), console.log is fine for debugging
console.log('🎬 startRecording() called')
console.error('❌ Failed to start recording:', error)
```

### Comments and Documentation

```typescript
// Use JSDoc for public APIs and complex functions
/**
 * Starts recording browser interactions
 * @param url - The URL to navigate to
 * @param screenshotDir - Optional directory to save screenshots
 * @throws {Error} If browser fails to launch or navigate
 * @returns Promise that resolves when recording has started
 */
async start(url: string, screenshotDir?: string): Promise<void> {
  // Implementation
}

// Inline comments for non-obvious logic
// Skip injection in iframes to reduce overhead
if (window !== window.top) return

// Module-level comments for file purpose
/**
 * Logger utility for handling sensitive data in logs
 * Provides environment-aware logging with different levels
 */
```

### File Organization

```
dodo-recorder/
├── electron/              # Electron main process
│   ├── main.ts           # Entry point
│   ├── preload.ts        # Preload script
│   ├── browser/          # Playwright browser recording
│   ├── audio/            # Audio recording & transcription
│   ├── session/          # Session management
│   ├── ipc/              # IPC handlers
│   ├── settings/         # Settings store
│   └── utils/            # Shared utilities
├── src/                  # React renderer process
│   ├── main.tsx          # React entry point
│   ├── App.tsx           # Root component
│   ├── components/       # React components
│   ├── stores/           # Zustand stores
│   ├── lib/              # Utilities
│   ├── types/            # TypeScript types
│   └── assets/           # Images, fonts
├── shared/               # Code shared between main and renderer
│   └── types.ts          # Shared type definitions
└── models/               # Whisper.cpp binaries and AI model
    ├── unix/             # Unix binary (macOS/Linux)
    │   └── whisper        # Whisper.cpp binary (committed to git)
    ├── win/              # Windows binaries
    │   └── whisper-cli.exe # Whisper.cpp binary (committed to git)
    └── ggml-small.en.bin # AI model weights (download manually, gitignored)
```

## Session Output Format

Each recording session produces a compact folder with 3 essential components:

```
session-YYYY-MM-DD-HHMMSS/
├── INSTRUCTIONS.md    # General AI instructions (reusable across sessions)
├── actions.json       # Complete session data (metadata + narrative + actions)
└── screenshots/       # Visual captures
```

**Key Characteristics:**
- **Framework-Agnostic**: Works with Playwright, Cypress, Selenium, Puppeteer, etc.
- **AI-Instruction-Complete**: Complete parsing documentation in INSTRUCTIONS.md
- **Token-Optimized**: Few tokens per session (INSTRUCTIONS.md is reused)
- **Single Source**: All session data in actions.json
- **Self-Documenting**: All instructions embedded, no external docs needed
- **Human-Readable**: Clear metadata and narrative flow

**File Purposes:**
- **INSTRUCTIONS.md**: Reusable framework-agnostic + framework-specific instructions
  - Written once per output directory, shared across all sessions
  - How to parse action references, choose locators, interpret action types
  - Framework detection logic (Playwright/Cypress)
  - Framework-specific implementation guides with code examples
  
- **actions.json**: Session-specific data with three sections:
  - `_meta`: Session metadata (ID, timestamps, URL, duration, action counts)
  - `narrative`: Voice commentary with embedded `[action:SHORT_ID:TYPE]` references
  - `actions`: Array of recorded actions with multiple locator strategies

**Action References Format:**
- Actions referenced in narrative as `[action:SHORT_ID:TYPE]`
- `SHORT_ID` = First 8 chars of full UUID in actions.json
- Example: `[action:8c61934e:click]` → `"id": "8c61934e-4cd3-4793-bdb5-5c1c6d696f37"`

**Multiple Locator Strategies:**
- Each action provides multiple locator strategies with confidence levels
- Priority: testId > text/placeholder/role > css > xpath
- Use high confidence locators when available

## Logging and Debugging

### Production Logging with electron-log

The app uses [`electron-log`](https://www.npmjs.com/package/electron-log) for production-ready logging:

**Features:**
- Automatic file logging to standard OS locations
- Console output in development
- Log rotation (max 10MB per file)
- Multiple log levels (debug, info, warn, error)

**Log Locations:**
```
macOS:    ~/Library/Logs/dodo-recorder/main.log
Windows:  %USERPROFILE%\AppData\Roaming\dodo-recorder\logs\main.log
Linux:    ~/.config/dodo-recorder/logs/main.log
```

**Usage in Main Process:**
```typescript
import { logger } from './utils/logger'

// Log levels
logger.debug('Detailed debug info')    // Dev only
logger.info('Normal operation')         // Always logged to file
logger.warn('Warning message')          // Always logged
logger.error('Error occurred', error)   // Always logged

// Get log file path
const logPath = logger.getLogPath()

// Log startup info (call once in main.ts)
logger.logStartupInfo()
```

**Usage in Renderer Process:**
```typescript
// Use console.log for renderer debugging - shows in DevTools
console.log('🎬 Component rendered')
console.error('❌ Error in component:', error)

// Access logs via IPC
const logPath = await window.electronAPI.getLogPath()
await window.electronAPI.openLogFile()    // Opens log in default editor
await window.electronAPI.openLogFolder()  // Opens log folder
```

**In-App Log Access:**
- The StatusBar component includes "View Logs" and folder buttons
- Located in bottom-right of the app window
- Users can click to open logs without knowing the path

**Log Levels by Environment:**
```typescript
// Development (npm run dev)
- Console: debug level
- File: debug level

// Production (built app)
- Console: error level only
- File: info level and above
```

**Best Practices:**
- Use `logger` in main process (Electron), `console.log` in renderer (React)
- Include context with errors: `logger.error('Operation failed', { url, reason })`
- Use emojis for visual scanning: `logger.info('🎬 Recording started')`
- Log state transitions: `logger.info(`Status: ${oldStatus} -> ${newStatus}`)`

**Debugging Production Issues:**
See [`docs/logs_and_debugging.md`](docs/logs_and_debugging.md) for comprehensive debugging guide.

## Important Notes

- **Whisper Model:** The 466MB `models/ggml-small.en.bin` file must be downloaded manually (not in git). The app shows an error dialog if missing.
- **Whisper Binaries:** Platform-specific Whisper.cpp binaries are committed to git:
  - **Windows**: `models/win/whisper-cli.exe`
  - **macOS/Linux**: `models/unix/whisper`
  - These are compiled from the [ggerganov/whisper.cpp](https://github.com/ggerganov/whisper.cpp) project
  - When updating Whisper binaries, ensure they are compiled for the target platforms and placed in the appropriate `models/` subdirectory
  - The app uses the `small.en` model (466MB) for a balance of accuracy, speed, and size
- **Path Alias:** Use `@/*` to import from `src/` directory
- **Tailwind:** Dark mode only (`darkMode: 'class'`), custom color scheme defined in `tailwind.config.js`
- **Security:** Validate all IPC inputs (see `electron/utils/validation.ts` for patterns)
- **Logging:** Main process uses `electron-log` (persists to file), renderer uses `console.log` (DevTools)
- **IPC Handlers:** Register once in `electron/ipc/handlers.ts` to prevent duplicates
- **Production Debugging:** Use "View Logs" button in app status bar or check log file locations above
