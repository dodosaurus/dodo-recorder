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

### Build
```bash
npm run build                  # Build and package the app for distribution
npm run electron:build         # Same as above
npm run preview               # Preview Vite build (no Electron)
```

### Output
- Development: Runs from source files
- Production builds: `release/` directory (dmg, zip for Mac; nsis, portable for Windows; AppImage, deb for Linux)
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
import saurusIcon from '@/assets/saurus_no_bg.png'           // Assets

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
type AudioStatus = 'idle' | 'recording' | 'processing' | 'complete' | 'error'

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

// Use logger utility (not console.log directly)
import { logger } from './utils/logger'
logger.info('Recording started')
logger.error('Failed to start recording:', error)
logger.debug('Debug info (dev only)')  // Only shows in NODE_ENV=development
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
└── models/               # Whisper.cpp binary and model
```

## Session Output Format

Each recording session produces a folder with 4 essential files:

```
session-YYYY-MM-DD-HHMMSS/
├── README.md          # Quick start for AI agents (session metadata, test intent)
├── transcript.txt     # Comprehensive AI header + narrative with action references
├── actions.json       # _meta wrapper + clean actions array (no voice data)
└── screenshots/       # Visual captures
```

**Key Characteristics:**
- **Framework-Agnostic**: Works with Playwright, Cypress, Selenium, Puppeteer, etc.
- **AI-Instruction-Complete**: Standalone with full parsing documentation in transcript.txt
- **Self-Documenting**: All instructions embedded, no external docs needed
- **Human-Readable**: Clear metadata and narrative flow

**Action References Format:**
- Actions referenced in transcript as `[action:SHORT_ID:TYPE]`
- `SHORT_ID` = First 8 chars of full UUID in actions.json
- Example: `[action:8c61934e:click]` → `"id": "8c61934e-4cd3-4793-bdb5-5c1c6d696f37"`

**Multiple Locator Strategies:**
- Each action provides multiple locator strategies with confidence levels
- Priority: testId > text/placeholder/role > css > xpath
- Use high confidence locators when available

## Important Notes

- **Whisper Model:** The 466MB `models/ggml-small.en.bin` file must be downloaded manually (not in git). The app shows an error dialog if missing.
- **Path Alias:** Use `@/*` to import from `src/` directory
- **Tailwind:** Dark mode only (`darkMode: 'class'`), custom color scheme defined in `tailwind.config.js`
- **Security:** Validate all IPC inputs (see `electron/utils/validation.ts` for patterns)
- **Logging:** Use `logger` utility, which sanitizes sensitive paths/tokens in production
- **IPC Handlers:** Register once in `electron/ipc/handlers.ts` to prevent duplicates
