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
│  Header (logo + StatusBar)                      │
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
      <section className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0"><ActionsList /></div>
        <TranscriptView />
      </section>
    ) : (
      <section className="flex-1 flex-col"><ActionsList /></section>
    )}
  </main>
</div>
```

- **Sidebar:** 320px fixed, settings top + controls bottom
- **Main content:** Conditional split view (50/50) or full-width ActionsList
- **Both transcript panels:** Use `flex-1` for equal split

---

## Core Components

### TitleBar
**File:** [`src/components/TitleBar.tsx`](../src/components/TitleBar.tsx)

Custom window controls for frameless Electron window (minimize, maximize/restore, close) with macOS-style positioning and IPC communication.

### Header
**Location:** [`App.tsx:30`](../src/App.tsx:30)

Contains app logo, title, and StatusBar component.

### StatusBar
**File:** [`src/components/StatusBar.tsx`](../src/components/StatusBar.tsx)

Displays recording status (idle/recording/processing/saving), action count, and log file access buttons.

**Status indicators:** Gray (idle), red pulsing (recording), yellow (processing), blue (saving)

---

## Settings Panel

**File:** [`src/components/SettingsPanel.tsx`](../src/components/SettingsPanel.tsx)

### Input Fields

**1. Start URL** ([`SettingsPanel.tsx:100`](../src/components/SettingsPanel.tsx:100))
```tsx
<Input
  placeholder="https://example.com"
  value={startUrl}
  onChange={(e) => handleStartUrlChange(e.target.value)}
  disabled={isDisabled}
/>
```
Auto-saved to persistent settings, validated before recording, disabled during recording.

**2. Output Folder** ([`SettingsPanel.tsx:113`](../src/components/SettingsPanel.tsx:113))
```tsx
<div className="flex gap-2">
  <Input value={outputPath} readOnly disabled={isDisabled} />
  <Button onClick={handleSelectFolder} disabled={isDisabled}>
    <Folder className="h-4 w-4" />
  </Button>
</div>
```
Read-only input + button opens native folder picker. Auto-saved.

**3. Voice Recording Toggle** ([`SettingsPanel.tsx:136`](../src/components/SettingsPanel.tsx:136))
```tsx
<Switch
  checked={isVoiceEnabled}
  onCheckedChange={setVoiceEnabled}
  disabled={isDisabled}
/>
```
Enables/disables audio transcription. When enabled, shows microphone selector.

**4. Microphone Selector** ([`src/components/MicrophoneSelector.tsx`](../src/components/MicrophoneSelector.tsx))

Visible only when voice recording enabled. Features dropdown (select device), refresh button (re-enumerate), test button (verify working), auto-detection (devicechange event).

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

**Device Usage** ([`RecordingControls.tsx:121`](../src/components/RecordingControls.tsx:121)):
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

**Load on mount** ([`SettingsPanel.tsx:28`](../src/components/SettingsPanel.tsx:28)):
```typescript
useEffect(() => {
  const loadPreferences = async () => {
    const result = await window.electronAPI.getUserPreferences()
    if (result.success && result.preferences) {
      setStartUrl(result.preferences.startUrl)
      setOutputPath(result.preferences.outputPath)
    }
    const micResult = await window.electronAPI.getMicrophoneSettings()
    if (micResult.success && micResult.settings) {
      setSelectedMicrophoneId(micResult.settings.selectedMicrophoneId)
    }
  }
  loadPreferences()
}, [])
```

**Saved immediately via IPC:** URL, output path, microphone selection

---

## Recording Controls

**File:** [`src/components/RecordingControls.tsx`](../src/components/RecordingControls.tsx)

### Buttons

**1. Start Recording** ([`RecordingControls.tsx:459`](../src/components/RecordingControls.tsx:459))

Shown when: `status === 'idle' && actions.length === 0`  
Enabled when: `startUrl && outputPath && status === 'idle'`

**Process:**
1. Validates URL and output path
2. Requests microphone permission (if voice enabled)
3. Starts audio recording (if voice enabled)
4. Launches Playwright browser
5. Navigates to start URL
6. Injects recording widget
7. Sets status to 'recording'

**2. Stop Recording** ([`RecordingControls.tsx:471`](../src/components/RecordingControls.tsx:471))

Shown when: `status === 'recording'`

**Process:**
1. Stops browser recording, closes browser
2. Stops audio recording (if enabled)
3. Transcribes audio via Whisper
4. Distributes voice segments to actions
5. Generates transcript text
6. Sets status to 'idle'

**3. Save Session** ([`RecordingControls.tsx:497`](../src/components/RecordingControls.tsx:497))

Shown when: `status === 'idle' && actions.length > 0`

Writes session bundle to output folder (INSTRUCTIONS.md, actions.json, screenshots/). Shows success state, disables to prevent duplicate saves.

**4. Reset** ([`RecordingControls.tsx:517`](../src/components/RecordingControls.tsx:517))

Shown when: `status === 'idle' && actions.length > 0`

Clears actions, transcript, audio state. Preserves settings (URL, path, voice toggle, microphone).

### Audio Status Display

**Recording** ([`RecordingControls.tsx:404`](../src/components/RecordingControls.tsx:404)):
```tsx
<div className="space-y-2">
  <AudioLevelMeter stream={audioStreamRef.current || undefined} />
  <div className="bg-red-500/10 text-red-400">
    <Mic className="animate-pulse" />
    Recording audio {audioChunksCount}s
  </div>
</div>
```

**Processing:** Spinner + "Transcribing audio..." (yellow)  
**Complete:** Segment count display (green)  
**Error:** Error message (red)

---

## Actions List

**File:** [`src/components/ActionsList.tsx`](../src/components/ActionsList.tsx)

Displays recorded browser actions in real-time.

**Header:** Shows title, status message, "View transcript" button (when `status === 'idle' && actions.length > 0 && transcriptText`)

**Action items:** Type icon, timestamp (MM:SS), target, expandable details (locators, confidence, bounding box, voice segments)

**Highlighting** ([`ActionsList.tsx`](../src/components/ActionsList.tsx)):
```tsx
<div className={cn(
  highlightedActionId === action.id
    ? 'bg-blue-500/20 border-l-4 border-l-blue-400'
    : 'hover:bg-card'
)}>
```
Triggered by clicking action reference in transcript or programmatic selection.

---

## Transcript View

**File:** [`src/components/TranscriptView.tsx`](../src/components/TranscriptView.tsx)

See [`docs/transcript_view.md`](transcript_view.md) for details.

**Summary:** Voice commentary with embedded, clickable action references. Split-pane layout (50/50 with ActionsList). Natural reading flow with sentence-level action placement.

---

## Audio Features

### Voice Recording Indicator (Browser Widget)

Pulsing red dot (10px) in browser widget when voice recording active. Main process sets `window.__dodoAudioActive` via `page.evaluate()`, widget checks every 100ms.

See [`docs/browser_widget.md`](browser_widget.md#3-voice-recording-indicator) for implementation.

### Microphone Fallback

**Code:** [`RecordingControls.tsx:97`](../src/components/RecordingControls.tsx:97)

```typescript
// Validate device exists
if (selectedMicrophoneId) {
  const devices = await navigator.mediaDevices.enumerateDevices()
  const deviceExists = devices.some(d => d.deviceId === selectedMicrophoneId)
  if (!deviceExists) {
    console.warn('Selected microphone not found, falling back to default')
    setAudioError('Selected microphone not available, using default')
    setSelectedMicrophoneId(undefined)
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
