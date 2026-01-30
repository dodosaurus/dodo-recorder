# Application UI

**Tech Stack:** React 18, TypeScript, Tailwind CSS (dark mode), Zustand (state), shadcn/ui patterns, Lucide icons

**Design:** Dark theme, minimal chrome, real-time feedback, persistent settings, responsive flexbox layout

---

## Application Layout

**File:** [`src/App.tsx`](../src/App.tsx)

```
┌─────────────────────────────────────────────────┐
│  TitleBar (custom window controls)              │
├─────────────────────────────────────────────────┤
│  Header (StatusBar + DebugInfoWidget)           │
├──────────────┬──────────────────────────────────┤
│              │                                   │
│  Settings    │  Recorded Actions                │
│  Panel       │  (ActionsList or Split View)     │
│  (320px)     │                                   │
│              │                                   │
│  Recording   │                                   │
│  Controls    │                                   │
└──────────────┴──────────────────────────────────┘
```

**Layout Implementation** ([`App.tsx:27`](../src/App.tsx:27)):
```tsx
<div className="h-screen flex flex-col overflow-hidden select-none">
  <TitleBar />
  <header>...</header>
  <main className="flex-1 flex overflow-hidden">
    <aside className="w-80 border-r border-border bg-card flex flex-col flex-shrink-0">
      <SettingsPanel />
      <RecordingControls />
    </aside>
    {isTranscriptViewOpen ? (
      <section className="flex-1 flex overflow-hidden bg-background">
        <div className="flex-1 min-w-0 border-r border-border bg-background flex flex-col">
          <div className="flex-shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-foreground">Recorded Actions</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click on transcript to highlight actions
              </p>
            </div>
          </div>
          <ActionsList />
        </div>
        <TranscriptView />
      </section>
    ) : (
      <section className="flex-1 flex flex-col overflow-hidden bg-background">
        <div className="flex-shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">Recorded Actions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status === 'recording' ? 'Recording in progress...' : 'Actions will appear here during recording'}
            </p>
          </div>
          {canViewTranscript && (
            <Button onClick={() => setTranscriptViewOpen(true)}>
              <FileText className="h-4 w-4" />
              View transcript
            </Button>
          )}
        </div>
        <ActionsList />
      </section>
    )}
  </main>
</div>
```

- **Sidebar:** 320px fixed, settings top + controls bottom
- **Main content:** Conditional split view or full-width ActionsList
- **Split view:** ActionsList and TranscriptView side by side with border divider

---

## Core Components

### TitleBar
**File:** [`src/components/TitleBar.tsx`](../src/components/TitleBar.tsx)

Custom window controls for frameless Electron window (minimize, maximize/restore, close) with platform-specific positioning.

- **Height:** 36px (`h-9`)
- **macOS:** Window controls on left (native system controls)
- **Windows:** Window controls on right (minimize, maximize, close buttons)

### Header
**Location:** [`App.tsx:30`](../src/App.tsx:30)

Contains `StatusBar` (left) and `DebugInfoWidget` (right).

### StatusBar
**File:** [`src/components/StatusBar.tsx`](../src/components/StatusBar.tsx)

Displays recording status, elapsed time (during recording), and action count.

**Status indicators:**
- `idle`: Green dot (`bg-green-500`), label "Ready"
- `recording`: Red pulsing dot (`bg-destructive animate-pulse-recording`), label "Recording"
- `paused`: Yellow dot (`bg-yellow-500`), label "Paused"
- `processing`: Blue dot (`bg-primary`), label "Processing"
- `saving`: Accent color dot (`bg-accent`), label "Saving"

During recording, shows elapsed time and action count.

### DebugInfoWidget
**File:** [`src/components/DebugInfoWidget.tsx`](../src/components/DebugInfoWidget.tsx)

Collapsible widget in header showing build info and log access.

**Features:**
- Build info: commit hash, branch, build time, Node version
- Log access: Two compact icon buttons for opening log file and log folder
- Toggle button showing commit hash with expand/collapse chevron

---

## Settings Panel

**File:** [`src/components/SettingsPanel.tsx`](../src/components/SettingsPanel.tsx)

### Input Fields

**1. Start URL** ([`SettingsPanel.tsx:54`](../src/components/SettingsPanel.tsx:54))
```tsx
<Input
  placeholder="https://example.com"
  value={startUrl}
  onChange={(e) => handleStartUrlChange(e.target.value)}
  disabled={isDisabled}
  className="bg-background"
/>
```
Auto-saved to persistent settings via `useSettings` hook, disabled during recording.

**2. Output Folder** ([`SettingsPanel.tsx:67`](../src/components/SettingsPanel.tsx:67))
```tsx
<div className="flex gap-2">
  <Input
    placeholder="Select a folder..."
    value={outputPath}
    readOnly
    disabled={isDisabled}
    className="bg-background flex-1"
  />
  <Button variant="secondary" size="icon" onClick={handleSelectFolder} disabled={isDisabled}>
    <Folder className="h-4 w-4" />
  </Button>
</div>
```
Read-only input + button opens native folder picker. Auto-saved.

**3. Voice Recording Toggle** ([`SettingsPanel.tsx:90`](../src/components/SettingsPanel.tsx:90))
```tsx
<div className="flex items-center justify-between py-2">
  <div className="flex items-center gap-2">
    <Mic className="h-4 w-4 text-muted-foreground" />
    <span className="text-sm">Voice Recording</span>
  </div>
  <Switch
    checked={isVoiceEnabled}
    onCheckedChange={setVoiceEnabled}
    disabled={isDisabled}
  />
</div>
```
Enables/disables audio transcription. When enabled, shows microphone selector and informational text.

**4. Microphone Selector** ([`src/components/MicrophoneSelector.tsx`](../src/components/MicrophoneSelector.tsx))

Visible only when voice recording enabled. Features dropdown (select device) and refresh button (re-enumerate).

**Device Enumeration** ([`src/lib/audioDevices.ts`](../src/lib/audioDevices.ts)):
```typescript
export async function enumerateAudioDevices(): Promise<AudioDevice[]> {
  await requestMicrophonePermission()
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter(device => device.kind === 'audioinput')
    .map(device => ({
      deviceId: device.deviceId,
      label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
      groupId: device.groupId,
    }))
}
```

**Device Usage** ([`RecordingControls.tsx:152`](../src/components/RecordingControls.tsx:152)):
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    deviceId: selectedMicrophoneId ? { exact: selectedMicrophoneId } : undefined,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 16000
  }
})
```

**Fallback:** If selected device fails, app automatically falls back to system default with notification.

### Settings Persistence

Settings are managed via the `useSettings` hook ([`src/lib/useSettings.ts`](../src/lib/useSettings.ts)):

```typescript
const { updatePreferences, updateMicrophoneSettings } = useSettings()

// Update startUrl with automatic persistence
const handleStartUrlChange = async (url: string) => {
  setStartUrl(url)
  await updatePreferences({ startUrl: url })
}
```

The hook loads settings on mount and provides centralized update functions that persist changes via IPC.

---

## Recording Controls

**File:** [`src/components/RecordingControls.tsx`](../src/components/RecordingControls.tsx)

### Buttons

**1. Start Recording** ([`RecordingControls.tsx:543`](../src/components/RecordingControls.tsx:543))

Shown when: `status === 'idle' && actions.length === 0`
Enabled when: `startUrl && outputPath && status === 'idle'`

**Process:**
1. Validates URL and output path
2. Requests microphone permission (if voice enabled)
3. Validates selected microphone device exists
4. Starts audio recording (if voice enabled)
5. Launches Playwright browser
6. Navigates to start URL
7. Sets status to 'recording'

**2. Stop Recording** ([`RecordingControls.tsx:555`](../src/components/RecordingControls.tsx:555))

Shown when: `status === 'recording'`

**Process:**
1. Stops browser recording, closes browser
2. Stops audio recording (if enabled)
3. Transcribes audio via Whisper
4. Distributes voice segments to actions
5. Generates transcript text
6. Sets status to 'idle'

**3. Save Session** ([`RecordingControls.tsx:582`](../src/components/RecordingControls.tsx:582))

Shown when: `status === 'idle' && actions.length > 0`

Writes session bundle to output folder (INSTRUCTIONS.md, actions.json, screenshots/). Shows success state, disables to prevent duplicate saves. Button uses `variant="success"` when not saved, `variant="outline"` when saved.

**4. Reset** ([`RecordingControls.tsx:601`](../src/components/RecordingControls.tsx:601))

Shown when: `status === 'idle' && actions.length > 0`

Shows confirmation dialog if session hasn't been saved. Clears actions, transcript, audio state. Preserves settings (URL, path, voice toggle, microphone) and reloads saved preferences.

### Audio Status Display

**Recording** ([`RecordingControls.tsx:473`](../src/components/RecordingControls.tsx:473)):
```tsx
<div className="flex items-center justify-center text-xs bg-red-500/10 text-red-400 px-3 py-2 rounded-md">
  <div className="flex items-center gap-2">
    <Mic className="h-3.5 w-3.5 animate-pulse" />
    <span>Recording audio</span>
    <span className="font-mono">{audioChunksCount}s</span>
  </div>
</div>
```

**Processing:** Spinner + "Transcribing audio..." (amber/yellow)
**Complete:** Segment count display (emerald/green)
**Error:** Error message with MicOff icon (red)

---

## Actions List

**File:** [`src/components/ActionsList.tsx`](../src/components/ActionsList.tsx)

Displays recorded browser actions in real-time.

**Empty State:** Shows icon and message "No actions recorded yet" when no actions exist.

**Action items:**
- Numbered index (01, 02, etc.)
- Type icon and color-coded badge
- Timestamp (MM:SS)
- Type badge: "action", "assertion", or "screenshot"
- Description text (truncated with tooltip)
- Expandable details (locators, confidence, bounding box, voice segments)
- Delete button (Trash2 icon) - appears on hover when not recording

**Highlighting** ([`ActionsList.tsx:141`](../src/components/ActionsList.tsx:141)):
```tsx
className={cn(
  highlightedActionId === action.id
    ? 'bg-blue-500/20 border-l-4 border-l-blue-400'
    : 'hover:bg-card'
)}
```
Triggered by clicking action reference in transcript or programmatic selection.

**Action Types and Colors:**
- `click`: Blue (`text-blue-400`)
- `fill`: Green (`text-green-400`)
- `navigate`: Purple (`text-purple-400`)
- `keypress`: Yellow (`text-yellow-400`)
- `select`: Orange (`text-orange-400`)
- `check`: Orange (`text-orange-400`)
- `scroll`: Cyan (`text-cyan-400`)
- `assert`: Pink (`text-pink-400`)
- `screenshot`: Indigo (`text-indigo-400`)

---

## Transcript View

**File:** [`src/components/TranscriptView.tsx`](../src/components/TranscriptView.tsx)

See [`docs/transcript_view.md`](transcript_view.md) for details.

**Summary:** Voice commentary with embedded, clickable action references. Split-pane layout with ActionsList. Natural reading flow with sentence-level action placement.

**Features:**
- Header with close button (X icon)
- Parses `[action:SHORT_ID:TYPE]` and `[screenshot:FILENAME]` references
- Clickable action badges that highlight corresponding action in ActionsList
- Smooth scroll to highlighted action
- Screenshot references are skipped (rendered as action badges instead)

---

## Audio Features

### Voice Recording Indicator (Browser Widget)

Pulsing red dot (10px) in browser widget when voice recording active. Main process sets `window.__dodoAudioActive` via `page.evaluate()`, widget checks every 100ms.

See [`docs/browser_widget.md`](browser_widget.md#3-voice-recording-indicator) for implementation.

### Microphone Fallback

**Code:** [`RecordingControls.tsx:129`](../src/components/RecordingControls.tsx:129)

```typescript
// Validate selected device exists before requesting stream
if (selectedMicrophoneId) {
  const devices = await navigator.mediaDevices.enumerateDevices()
  const deviceExists = devices.some(d => d.deviceId === selectedMicrophoneId)

  if (!deviceExists) {
    setAudioError('Selected microphone not available, using default')
    setSelectedMicrophoneId(undefined)
    await window.electronAPI.updateMicrophoneSettings({ selectedMicrophoneId: undefined })
  }
}

// Try selected device, fallback on failure
try {
  stream = await getUserMedia({ deviceId: { exact: selectedMicrophoneId } })
} catch (error) {
  if (selectedMicrophoneId) {
    stream = await getUserMedia({ audio: defaultConstraints })
  } else {
    setAudioError(error.message)
    return
  }
}
```

---

## State Management

**File:** [`src/stores/recordingStore.ts`](../src/stores/recordingStore.ts)

Global Zustand store:

```typescript
interface RecordingState {
  // Recording
  status: RecordingStatus
  actions: RecordedAction[]
  transcriptSegments: TranscriptSegment[]
  transcriptText: string
  startTime: number | null

  // Settings
  startUrl: string
  outputPath: string
  notes: string
  isVoiceEnabled: boolean
  selectedMicrophoneId: string | undefined

  // Audio
  audioStatus: AudioStatus
  audioChunksCount: number
  audioError: string | null

  // UI
  sessionSaved: boolean
  isTranscriptViewOpen: boolean
  highlightedActionId: string | null

  // Actions: setStatus, addAction, setSelectedMicrophoneId, etc.
}
```

**RecordingStatus:** `'idle' | 'recording' | 'paused' | 'processing' | 'saving'`

**AudioStatus:** `'idle' | 'recording' | 'processing' | 'complete' | 'error'`

**Access pattern:**
```typescript
const { status, actions, setStatus } = useRecordingStore(
  useShallow((state) => ({
    status: state.status,
    actions: state.actions,
    setStatus: state.setStatus,
  }))
)
```

Benefits: No prop drilling, efficient re-renders (only when selected state changes).
