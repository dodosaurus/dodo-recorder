# Application UI Documentation

**Last Updated**: January 2026  
**Status**: ✅ Production

---

## Table of Contents

1. [Overview](#overview)
2. [Application Layout](#application-layout)
3. [UI Components](#ui-components)
4. [Settings Panel](#settings-panel)
5. [Recording Controls](#recording-controls)
6. [Actions List](#actions-list)
7. [Transcript View](#transcript-view)
8. [Audio Features](#audio-features)
9. [State Management](#state-management)
10. [User Workflows](#user-workflows)

---

## Overview

Dodo Recorder features a clean, functional desktop interface built with React, TypeScript, and Tailwind CSS. The UI is designed for efficient browser test recording with real-time feedback and intuitive controls.

**Tech Stack:**
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS (dark mode only)
- **State**: Zustand for global state management
- **UI Components**: Custom components following shadcn/ui patterns
- **Icons**: Lucide React

**Design Principles:**
- Dark theme optimized for long recording sessions
- Minimal chrome to maximize content area
- Real-time feedback for all operations
- Persistent settings across sessions
- Responsive layout with fixed and flexible sections

---

## Application Layout

**File**: [`src/App.tsx`](../src/App.tsx)

### Main Structure

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
│  ┌─────────┐│                                   │
│  │Recording││                                   │
│  │Controls ││                                   │
│  └─────────┘│                                   │
└──────────────┴──────────────────────────────────┘
```

### Layout Code

**Container** ([`App.tsx:27`](../src/App.tsx:27)):
```tsx
<div className="h-screen flex flex-col overflow-hidden select-none">
  <TitleBar />
  <header>...</header>
  <main className="flex-1 flex overflow-hidden">
    <aside>...</aside>
    <section>...</section>
  </main>
</div>
```

**Sidebar** ([`App.tsx:41`](../src/App.tsx:41)):
```tsx
<aside className="w-80 border-r border-border bg-card flex flex-col flex-shrink-0">
  <SettingsPanel />
  <RecordingControls />
</aside>
```
- Fixed width: 320px (`w-80`)
- Contains settings at top, controls at bottom
- Non-scrollable (children manage their own scroll)

**Main Content** ([`App.tsx:46`](../src/App.tsx:46)):
```tsx
{isTranscriptViewOpen ? (
  <section className="flex-1 flex overflow-hidden">
    <div className="flex-1 min-w-0 ...">
      <ActionsList />
    </div>
    <TranscriptView />
  </section>
) : (
  <section className="flex-1 flex flex-col overflow-hidden">
    <ActionsList />
  </section>
)}
```
- Conditionally renders split view or full-width actions list
- Both panels use `flex-1` for equal 50/50 split

---

## UI Components

### 1. TitleBar

**File**: [`src/components/TitleBar.tsx`](../src/components/TitleBar.tsx)

Custom window controls for frameless Electron window:
- **Minimize** - Collapses window to dock/taskbar
- **Maximize/Restore** - Toggle fullscreen
- **Close** - Quit application

**Features:**
- macOS-style traffic light positioning (left side)
- Hover states for visual feedback
- IPC communication with main process

### 2. Header

**Location**: [`App.tsx:30`](../src/App.tsx:30)

```tsx
<header className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <img src={saurusIcon} alt="Dodo Recorder" className="w-8 h-8 rounded-lg" />
      <h1 className="text-sm font-semibold text-foreground">Dodo Recorder</h1>
    </div>
    <StatusBar />
  </div>
</header>
```

**Contains:**
- App logo (Saurus icon)
- App title
- StatusBar component (right side)

### 3. StatusBar

**File**: [`src/components/StatusBar.tsx`](../src/components/StatusBar.tsx)

Displays:
- Recording status indicator (idle, recording, processing, saving)
- Action count
- Log file access buttons

**Status Colors:**
- **Idle**: Gray circle
- **Recording**: Red pulsing circle
- **Processing**: Yellow circle
- **Saving**: Blue circle

---

## Settings Panel

**File**: [`src/components/SettingsPanel.tsx`](../src/components/SettingsPanel.tsx)

Located in left sidebar, contains all session configuration options.

### Fields

#### 1. Start URL

**Code**: [`SettingsPanel.tsx:100`](../src/components/SettingsPanel.tsx:100)

```tsx
<Input
  placeholder="https://example.com"
  value={startUrl}
  onChange={(e) => handleStartUrlChange(e.target.value)}
  disabled={isDisabled}
  className="bg-background"
/>
```

**Functionality:**
- Text input for the URL to record
- Auto-saved to persistent settings on change
- Validates URL format before recording starts
- Disabled during recording/processing

#### 2. Output Folder

**Code**: [`SettingsPanel.tsx:113`](../src/components/SettingsPanel.tsx:113)

```tsx
<div className="flex gap-2">
  <Input
    placeholder="Select a folder..."
    value={outputPath}
    readOnly
    disabled={isDisabled}
    className="bg-background flex-1"
  />
  <Button
    variant="secondary"
    size="icon"
    onClick={handleSelectFolder}
    disabled={isDisabled}
  >
    <Folder className="h-4 w-4" />
  </Button>
</div>
```

**Functionality:**
- Read-only input showing selected path
- Folder icon button opens native folder picker
- Auto-saved to persistent settings
- Session files will be written to this location

#### 3. Voice Recording Toggle

**Code**: [`SettingsPanel.tsx:136`](../src/components/SettingsPanel.tsx:136)

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

**Functionality:**
- Enables/disables audio transcription
- When enabled, shows microphone selector
- State persists across sessions
- Disabled during recording/processing

#### 4. Microphone Selector (NEW ✨)

**Component**: [`src/components/MicrophoneSelector.tsx`](../src/components/MicrophoneSelector.tsx)  
**Integration**: [`SettingsPanel.tsx:148`](../src/components/SettingsPanel.tsx:148)

Only visible when voice recording is enabled.

**Features:**
- **Dropdown**: Select specific microphone device
- **Refresh button**: Re-enumerate devices (detects new/removed devices)
- **Test button**: Verify microphone is working
- **Auto-detection**: Listens for device changes via `devicechange` event

**Code**:
```tsx
{isVoiceEnabled && (
  <>
    <MicrophoneSelector
      disabled={isDisabled}
      selectedDeviceId={selectedMicrophoneId}
      onDeviceChange={handleMicrophoneChange}
    />
    <p className="text-xs text-muted-foreground text-center">
      Speak your observations during recording. Audio will be transcribed locally using Whisper.
    </p>
  </>
)}
```

**Dropdown Options:**
- "Default Microphone" (uses system default)
- List of available audio input devices (e.g., "MacBook Pro Microphone", "USB Microphone")

**Workflow:**
1. User enables voice recording
2. Microphone selector appears
3. User selects specific device (or leaves as default)
4. Settings auto-saved to electron-store
5. Selected device used during recording
6. If device unavailable, app falls back to system default with notification

**Implementation Details:**

**Device Enumeration** ([`src/lib/audioDevices.ts`](../src/lib/audioDevices.ts)):
```typescript
export async function enumerateAudioDevices(): Promise<AudioDevice[]> {
  // Request permission first to get device labels
  await requestMicrophonePermission()
  
  const devices = await navigator.mediaDevices.enumerateDevices()
  const audioInputDevices = devices
    .filter(device => device.kind === 'audioinput')
    .map(device => ({
      deviceId: device.deviceId,
      label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
      groupId: device.groupId,
    }))
  
  return audioInputDevices
}
```

**Device Persistence** ([`electron/settings/store.ts`](../electron/settings/store.ts)):
```typescript
interface AppSettings {
  // ... other settings
  audio: {
    selectedMicrophoneId?: string
  }
}
```

**Device Usage** ([`src/components/RecordingControls.tsx:121`](../src/components/RecordingControls.tsx:121)):
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

**Fallback Mechanism** ([`RecordingControls.tsx:131`](../src/components/RecordingControls.tsx:131)):
```typescript
try {
  stream = await getUserMedia({ deviceId: { exact: selectedMicrophoneId } })
} catch (getUserMediaError) {
  // Fallback to default device
  if (selectedMicrophoneId) {
    stream = await getUserMedia({ audio: defaultConstraints })
    setAudioError(null)
  } else {
    setAudioError(error.message)
    return
  }
}
```

### Settings Persistence

**Load on Mount** ([`SettingsPanel.tsx:28`](../src/components/SettingsPanel.tsx:28)):
```typescript
useEffect(() => {
  const loadPreferences = async () => {
    // Load URL and output path
    const result = await window.electronAPI.getUserPreferences()
    if (result.success && result.preferences) {
      setStartUrl(result.preferences.startUrl)
      setOutputPath(result.preferences.outputPath)
    }
    
    // Load microphone settings
    const micResult = await window.electronAPI.getMicrophoneSettings()
    if (micResult.success && micResult.settings) {
      setSelectedMicrophoneId(micResult.settings.selectedMicrophoneId)
    }
  }
  loadPreferences()
}, [])
```

**Save on Change**:
- URL: [`SettingsPanel.tsx:72`](../src/components/SettingsPanel.tsx:72)
- Output Path: [`SettingsPanel.tsx:85`](../src/components/SettingsPanel.tsx:85)
- Microphone: [`SettingsPanel.tsx:94`](../src/components/SettingsPanel.tsx:94)

---

## Recording Controls

**File**: [`src/components/RecordingControls.tsx`](../src/components/RecordingControls.tsx)

Located at bottom of left sidebar. Contains primary recording actions.

### Buttons

#### 1. Start Recording

**Code**: [`RecordingControls.tsx:459`](../src/components/RecordingControls.tsx:459)

```tsx
<Button
  className="w-full"
  size="lg"
  onClick={startRecording}
  disabled={!canStart}
>
  <Play className="h-4 w-4 mr-2" />
  Start Recording
</Button>
```

**Shown when**: `status === 'idle' && actions.length === 0`

**Enabled when**: `startUrl && outputPath && status === 'idle'`

**Actions**:
1. Validates URL and output path
2. Requests microphone permission (if voice enabled)
3. Starts audio recording (if voice enabled)
4. Launches browser via Playwright
5. Navigates to start URL
6. Injects recording widget
7. Changes status to 'recording'

#### 2. Stop Recording

**Code**: [`RecordingControls.tsx:471`](../src/components/RecordingControls.tsx:471)

```tsx
<Button
  className="w-full"
  size="lg"
  variant="destructive"
  onClick={stopRecording}
>
  <Square className="h-4 w-4 mr-2" />
  Stop Recording
</Button>
```

**Shown when**: `status === 'recording'`

**Actions**:
1. Stops browser recording
2. Closes browser window
3. Stops audio recording (if voice enabled)
4. Transcribes audio via Whisper (if voice enabled)
5. Distributes voice segments to actions
6. Generates transcript text
7. Changes status to 'idle'

#### 3. Save Session

**Code**: [`RecordingControls.tsx:497`](../src/components/RecordingControls.tsx:497)

```tsx
<Button
  className="w-full"
  size="lg"
  variant={sessionSaved ? "outline" : "success"}
  onClick={saveSession}
  disabled={sessionSaved}
>
  {sessionSaved ? (
    <>
      <CheckCircle className="h-4 w-4 mr-2" />
      Session Saved
    </>
  ) : (
    <>
      <Save className="h-4 w-4 mr-2" />
      Save Session
    </>
  )}
</Button>
```

**Shown when**: `status === 'idle' && actions.length > 0`

**Actions**:
1. Creates session bundle with actions and metadata
2. Writes files to output folder:
   - `README.md`
   - `transcript.txt`
   - `actions.json`
   - `screenshots/` folder
3. Shows success state (green checkmark)
4. Disables button to prevent duplicate saves

#### 4. Reset

**Code**: [`RecordingControls.tsx:517`](../src/components/RecordingControls.tsx:517)

```tsx
<Button
  className="w-full"
  size="lg"
  variant="outline"
  onClick={resetSession}
>
  <RotateCcw className="h-4 w-4 mr-2" />
  Reset
</Button>
```

**Shown when**: `status === 'idle' && actions.length > 0`

**Actions**:
1. Clears all recorded actions
2. Clears transcript segments
3. Resets audio state
4. Preserves settings (URL, output path, voice toggle, microphone)
5. Returns to initial state

### Audio Status Display

**Code**: [`RecordingControls.tsx:401`](../src/components/RecordingControls.tsx:401)

Shows different states during recording lifecycle:

**Recording** ([`RecordingControls.tsx:404`](../src/components/RecordingControls.tsx:404)):
```tsx
<div className="space-y-2">
  <AudioLevelMeter stream={audioStreamRef.current || undefined} />
  <div className="flex items-center justify-center text-xs bg-red-500/10 text-red-400 px-3 py-2 rounded-md">
    <Mic className="h-3.5 w-3.5 animate-pulse" />
    <span>Recording audio</span>
    <span className="font-mono">{audioChunksCount}s</span>
  </div>
</div>
```
- Shows real-time audio level visualization
- Displays recording duration
- Red pulsing microphone icon

**Processing** ([`RecordingControls.tsx:419`](../src/components/RecordingControls.tsx:419)):
```tsx
<div className="flex items-center justify-center text-xs bg-amber-500/10 text-amber-400 px-3 py-2 rounded-md">
  <Loader2 className="h-3.5 w-3.5 animate-spin" />
  <span>Transcribing audio...</span>
</div>
```
- Shows spinner during Whisper transcription
- Yellow color indicates processing state

**Complete** ([`RecordingControls.tsx:430`](../src/components/RecordingControls.tsx:430)):
```tsx
<div className="flex items-center justify-center text-xs bg-emerald-500/10 text-emerald-400 px-3 py-2 rounded-md">
  <Mic className="h-3.5 w-3.5" />
  <span>{transcriptSegments.length} voice segment{transcriptSegments.length !== 1 ? 's' : ''} transcribed</span>
</div>
```
- Green color indicates success
- Shows count of transcribed segments

**Error** ([`RecordingControls.tsx:441`](../src/components/RecordingControls.tsx:441)):
```tsx
<div className="flex items-center justify-center text-xs bg-red-500/10 text-red-400 px-3 py-2 rounded-md">
  <MicOff className="h-3.5 w-3.5" />
  <span>{audioError || 'Audio error'}</span>
</div>
```
- Red color indicates error
- Shows specific error message

---

## Actions List

**File**: [`src/components/ActionsList.tsx`](../src/components/ActionsList.tsx)

Displays all recorded browser actions in real-time.

### Header

**Code** ([`App.tsx:63`](../src/App.tsx:63) when transcript closed):
```tsx
<div className="flex-shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
  <div>
    <h2 className="text-sm font-medium text-foreground">Recorded Actions</h2>
    <p className="text-xs text-muted-foreground mt-0.5">
      {status === 'recording' ? 'Recording in progress...' : 'Actions will appear here during recording'}
    </p>
  </div>
  {canViewTranscript && (
    <Button
      variant="default"
      size="sm"
      onClick={() => setTranscriptViewOpen(true)}
      className="gap-2"
    >
      <FileText className="h-4 w-4" />
      View transcript
    </Button>
  )}
</div>
```

**View Transcript Button**:
- Only visible when: `status === 'idle' && actions.length > 0 && transcriptText`
- Opens split view with transcript on right side

### Action Items

Each action displays:
- **Type icon** - Visual indicator (click, fill, navigate, etc.)
- **Timestamp** - Relative time (MM:SS)
- **Target** - Element selector or URL
- **Expandable details**:
  - Multiple locator strategies
  - Confidence levels
  - Bounding box
  - Voice segments (if any)

### Highlighting

**Code** ([`ActionsList.tsx`](../src/components/ActionsList.tsx)):
```tsx
<div className={cn(
  highlightedActionId === action.id
    ? 'bg-blue-500/20 border-l-4 border-l-blue-400'
    : 'hover:bg-card'
)}>
```

Actions can be highlighted by:
- Clicking action reference in transcript
- Programmatic selection via `setHighlightedActionId()`

---

## Transcript View

**File**: [`src/components/TranscriptView.tsx`](../src/components/TranscriptView.tsx)

See [`docs/transcript_view.md`](transcript_view.md) for complete documentation.

**Quick Summary**:
- Displays voice commentary with embedded action references
- Clickable action badges that highlight corresponding actions
- Split-pane layout (50/50 with ActionsList)
- Natural reading flow with sentence-level action placement

---

## Audio Features

### 1. Audio Level Meter (DEPRECATED - Moved to Browser Widget)

**Previous Location**: [`RecordingControls.tsx`](../src/components/RecordingControls.tsx)  
**New Location**: Browser widget (see [`docs/browser_widget.md`](browser_widget.md))

Real-time audio level visualization has been moved to the browser widget for better visibility during recording. The recording controls now show only a simple recording indicator.

**Recording Indicator** ([`RecordingControls.tsx:433`](../src/components/RecordingControls.tsx:433)):
- Pulsing microphone icon
- Recording duration counter
- Red background to indicate active recording

### 2. Device Selection

See [Settings Panel - Microphone Selector](#4-microphone-selector-new-) above.

### 3. Fallback Mechanism

**Code**: [`RecordingControls.tsx:97`](../src/components/RecordingControls.tsx:97)

Automatic fallback if selected device fails:

```typescript
// 1. Validate selected device exists
if (selectedMicrophoneId) {
  const devices = await navigator.mediaDevices.enumerateDevices()
  const deviceExists = devices.some(d => d.deviceId === selectedMicrophoneId)
  
  if (!deviceExists) {
    console.warn('Selected microphone not found, falling back to default')
    setAudioError('Selected microphone not available, using default')
    setSelectedMicrophoneId(undefined)
  }
}

// 2. Try selected device, fallback on failure
try {
  stream = await getUserMedia({ deviceId: { exact: selectedMicrophoneId } })
} catch (error) {
  if (selectedMicrophoneId) {
    // Try default device
    stream = await getUserMedia({ audio: defaultConstraints })
  } else {
    // Show error
    setAudioError(error.message)
    return
  }
}
```

**User Experience**:
- If USB mic unplugged → app falls back to built-in mic
- User sees notification: "Selected microphone not available, using default"
- Recording continues without interruption

### 4. Audio Level Visualization in Browser Widget (NEW)

During recording, the browser widget displays a compact 5-bar equalizer showing real-time audio levels.

**Features:**
- **Compact design**: 5-bar equalizer (~55px wide) fits alongside screenshot/assertion buttons
- **Color-coded levels**:
  - Green (0-50%): Normal speech
  - Yellow (50-75%): Loud speech
  - Red (75-100%): Very loud/potential clipping
- **Animated bars**: Wave pattern creates engaging visual feedback
- **Auto-hide**: Only visible during active voice recording

**Data Flow**:
1. RecordingControls analyzes MediaStream audio with AudioContext
2. Sends level data (0-100) to main process via IPC every frame
3. Main process updates browser page via Playwright's `page.evaluate()`
4. Widget reads `window.__dodoAudioLevel` and animates equalizer bars

See [`docs/browser_widget.md`](browser_widget.md) for complete implementation details.

---

## State Management

**File**: [`src/stores/recordingStore.ts`](../src/stores/recordingStore.ts)

Global state managed with Zustand:

```typescript
interface RecordingState {
  // Recording state
  status: RecordingStatus              // 'idle' | 'recording' | 'processing' | 'saving'
  actions: RecordedAction[]            // All recorded actions
  transcriptSegments: TranscriptSegment[]  // Voice segments from Whisper
  transcriptText: string               // Full transcript with action references
  startTime: number | null             // Recording start timestamp
  
  // Settings
  startUrl: string                     // URL to record
  outputPath: string                   // Where to save session
  notes: string                        // Optional user notes
  isVoiceEnabled: boolean              // Voice recording toggle
  selectedMicrophoneId: string | undefined  // Selected audio device
  
  // Audio state
  audioStatus: AudioStatus             // 'idle' | 'recording' | 'processing' | 'complete' | 'error'
  audioChunksCount: number             // Audio duration counter
  audioError: string | null            // Audio error message
  
  // UI state
  sessionSaved: boolean                // Whether session has been saved
  isTranscriptViewOpen: boolean        // Split view toggle
  highlightedActionId: string | null   // Action to highlight
  
  // Actions
  setStatus: (status: RecordingStatus) => void
  addAction: (action: RecordedAction) => void
  setSelectedMicrophoneId: (deviceId: string | undefined) => void
  // ... many more actions
}
```

**Access Pattern**:
```typescript
const { status, actions, setStatus } = useRecordingStore(
  useShallow((state) => ({
    status: state.status,
    actions: state.actions,
    setStatus: state.setStatus,
  }))
)
```

**Benefits**:
- No prop drilling
- Efficient re-renders (only when selected state changes)
- DevTools integration for debugging

---

## User Workflows

### Basic Recording Workflow

1. **Setup**:
   - Enter start URL
   - Select output folder
   - (Optional) Enable voice recording
   - (Optional) Select specific microphone
   - (Optional) Test microphone

2. **Record**:
   - Click "Start Recording"
   - Browser window opens
   - Interact with website
   - (Optional) Speak commentary
   - (Optional) Take screenshots (Cmd+Shift+S)
   - (Optional) Record assertions (Cmd+Click)

3. **Stop**:
   - Click "Stop Recording"
   - Browser closes
   - Audio transcription runs (if voice enabled)
   - Actions appear in list

4. **Review**:
   - Click "View transcript" (if voice enabled)
   - Review actions and commentary
   - Click action badges in transcript to highlight actions

5. **Save**:
   - Click "Save Session"
   - Session files written to output folder
   - Button shows "Session Saved" checkmark

6. **Reset** (optional):
   - Click "Reset" to start new recording
   - Settings preserved

### Microphone Setup Workflow (NEW)

1. **Initial Setup**:
   - Enable "Voice Recording" toggle
   - Microphone selector appears
   - Click refresh button to enumerate devices
   - Select your preferred microphone from dropdown

2. **Test Microphone**:
   - Click test button (microphone icon)
   - Speak into microphone
   - Observe result:
     - ✓ Green checkmark = working
     - ✗ Red X = failed

3. **Verify During Recording**:
   - Start recording
   - Observe audio equalizer in the browser widget
   - Speak normally
   - Levels should show green bars (0-50%)
   - If no movement → microphone not working

4. **Troubleshoot**:
   - If test fails:
     - Try different microphone from dropdown
     - Check system microphone permissions
     - Check hardware mute switch
   - If fallback occurs:
     - "Selected microphone not available" message shows
     - App uses system default automatically
     - Re-select device after reconnecting

### Settings Persistence Workflow

All settings automatically save and restore:

**On App Launch**:
- Last used URL loads
- Last used output path loads
- Voice recording preference loads
- Selected microphone loads

**On Change**:
- URL → saved immediately via IPC
- Output path → saved immediately via IPC
- Microphone → saved immediately via IPC
- Voice toggle → stored in Zustand only

**On Reset**:
- Actions cleared
- Transcript cleared
- Audio state cleared
- **Settings preserved** (URL, path, voice, microphone)

---

## Summary

The Dodo Recorder UI provides a streamlined recording experience with key features:

**Core Functionality**:
- ✅ Simple 3-field setup (URL, folder, voice toggle)
- ✅ One-click recording start/stop
- ✅ Real-time action capture and display
- ✅ Session save with comprehensive output format

**Audio Features** (NEW):
- ✅ Microphone device selection with dropdown
- ✅ Device enumeration with refresh button
- ✅ Microphone test functionality
- ✅ Real-time audio level visualization in browser widget
- ✅ Automatic fallback to default device
- ✅ Device change detection (auto-refresh)
- ✅ Persistent device selection across sessions

**Advanced Features**:
- ✅ Voice transcription with Whisper
- ✅ Transcript view with clickable action references
- ✅ Settings persistence across sessions
- ✅ Split-pane layout for reviewing
- ✅ Highlight synchronization between transcript and actions

**Design Strengths**:
- Clean, focused interface
- Minimal cognitive load
- Real-time feedback at every step
- Intuitive visual hierarchy
- Responsive layout
- Dark theme optimized for extended use

The UI successfully balances simplicity for basic recording with power features for advanced users, all while maintaining a consistent, professional appearance.
