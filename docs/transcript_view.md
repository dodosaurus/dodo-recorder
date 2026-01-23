# Transcript View

## Overview

The Transcript View is a UI component that displays voice commentary with embedded, clickable action references. It provides a narrative reading experience of the recording session where users can click on action badges to highlight and scroll to the corresponding action in the Actions List.

**Key Features:**
- **Natural narrative flow** - Voice commentary text rendered as readable prose
- **Clickable action badges** - Interactive references that link to actions
- **Screenshot badges** - Visual indicators for captured screenshots
- **Auto-scroll synchronization** - Clicking badges scrolls to actions in ActionsList
- **Responsive layout** - Shares screen space equally with ActionsList (50/50 split)

---

## User Experience

### Opening Transcript View

After recording completes and voice is transcribed:
1. A "View transcript" button appears in the Actions List header
2. Clicking it opens a split-pane layout
3. Actions List moves to the left (taking 50% of available space)
4. Transcript View appears on the right (taking remaining 50%)

### Reading the Transcript

The transcript displays:
- Voice commentary as flowing text in a readable font
- Action references as colored, clickable badges with icons
- Screenshot references as visual badges

**Example visual:**
```
So this is the example of the test recording. Now I'm inserting the 
username in this form, then I'm inserting the password, and I'm clicking 
[43d16488:click] I should be redirected to the page where all the products 
are listed. [f4ec95da:click] [2bba1996:fill] ...
```

### Interacting with Actions

Clicking an action badge:
1. Highlights the corresponding action in ActionsList (blue glow)
2. Auto-scrolls to the action in ActionsList for easy reference
3. Provides visual feedback of the connection

---

## Implementation Details

### File Location

[`src/components/TranscriptView.tsx`](../src/components/TranscriptView.tsx)

### Component Architecture

**State Management:**
```typescript
const { 
  transcriptText,      // Full transcript text from store
  actions,             // All recorded actions (for ID matching)
  setHighlightedActionId,    // Highlight action in ActionsList
  setTranscriptViewOpen      // Close transcript view
} = useRecordingStore()
```

**Data Source:**
- `transcriptText` is generated after recording stops
- Comes from [`electron/utils/enhancedTranscript.ts`](../electron/utils/enhancedTranscript.ts) via IPC call
- Contains full transcript with header, narrative, and reference table

### Parsing Pipeline

#### Step 1: Extract Narrative Section

The transcript text contains multiple sections (header, instructions, narrative, reference table). We extract only the narrative:

```typescript
const extractNarrative = (text: string): string => {
  const narrativeMatch = text.match(/## Narrative\s*\n\s*([\s\S]*?)(?:\n\n## Action Reference|$)/)
  if (narrativeMatch && narrativeMatch[1]) {
    return narrativeMatch[1].trim()
  }
  return text
}
```

**Why:** The narrative section contains the actual voice commentary with embedded action/screenshot references.

#### Step 2: Parse into Structured Parts

The narrative is parsed into three types of parts:

```typescript
interface TranscriptPart {
  type: 'text' | 'action' | 'screenshot'
  content: string
  actionId?: string           // For action parts
  actionType?: ActionType     // For action parts
  screenshotFilename?: string // For screenshot parts
}
```

**Parsing Logic:**
```typescript
const parseTranscript = (text: string): TranscriptPart[] => {
  const parts: TranscriptPart[] = []
  const regex = /\[(action|screenshot):([^\]]+)\]/g
  
  // Find all [action:ID:TYPE] and [screenshot:FILENAME] references
  // Extract text between references
  // Build structured array of parts
}
```

**Example Input:**
```
Now clicking [action:43d16488:click] and then filling [action:2bba1996:fill]
```

**Parsed Output:**
```typescript
[
  { type: 'text', content: 'Now clicking ' },
  { type: 'action', content: '[action:43d16488:click]', actionId: '43d16488', actionType: 'click' },
  { type: 'text', content: ' and then filling ' },
  { type: 'action', content: '[action:2bba1996:fill]', actionId: '2bba1996', actionType: 'fill' }
]
```

### Rendering

#### Text Parts
```tsx
<span className="text-foreground/95 text-base leading-relaxed">
  {part.content}
</span>
```

#### Action Parts
```tsx
<button
  onClick={() => handleActionClick(part.actionId!)}
  className={cn(
    'inline-flex items-center gap-1.5 px-2 py-1 mx-0.5 rounded-md',
    'bg-secondary/50 hover:bg-secondary transition-colors',
    'cursor-pointer select-none align-middle',
    colorClass  // Different color per action type
  )}
>
  <Icon className="w-3.5 h-3.5" />
  <span className="text-xs font-mono font-medium">
    {part.actionId}:{part.actionType}
  </span>
</button>
```

**Action Colors:**
- Click: Blue (`text-blue-400`)
- Fill: Green (`text-green-400`)
- Navigate: Purple (`text-purple-400`)
- Assert: Pink (`text-pink-400`)
- Screenshot: Indigo (`text-indigo-400`)
- And more...

#### Screenshot Parts
```tsx
<span className="inline-flex items-center gap-1.5 px-2 py-1 mx-0.5 rounded-md bg-indigo-500/10 text-indigo-400 align-middle">
  <Camera className="w-3.5 h-3.5" />
  <span className="text-xs font-mono font-medium">
    {part.screenshotFilename}
  </span>
</span>
```

### Action Highlighting

When user clicks an action badge:

```typescript
const handleActionClick = (shortId: string) => {
  // Find full action by matching 8-character ID prefix
  const action = actions.find(a => a.id.startsWith(shortId))
  if (action) {
    // Highlight in ActionsList
    setHighlightedActionId(action.id)
    
    // Auto-scroll to action
    setTimeout(() => {
      const element = document.querySelector(`[data-action-id="${action.id}"]`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }
}
```

**ID Matching Logic:**
- Transcript contains short 8-character ID prefixes (e.g., `43d16488`)
- Full actions have complete UUIDs (e.g., `43d16488-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- We find actions by matching the prefix using `id.startsWith(shortId)`

---

## Layout Integration

### Before Transcript View Opens

```
┌─────────────────┬───────────────────────────────┐
│  SettingsPanel  │      ActionsList (full)       │
│   (320px fixed) │      (flex-1, 100% space)     │
└─────────────────┴───────────────────────────────┘
```

### After Transcript View Opens

```
┌─────────────────┬────────────────┬────────────────┐
│  SettingsPanel  │  ActionsList   │ TranscriptView │
│   (320px fixed) │ (flex-1, 50%)  │ (flex-1, 50%)  │
└─────────────────┴────────────────┴────────────────┘
```

**Implementation in [`App.tsx`](../src/App.tsx:48):**
```tsx
{isTranscriptViewOpen ? (
  <section className="flex-1 flex overflow-hidden">
    <div className="flex-1 min-w-0 border-r ...">
      <ActionsList />
    </div>
    <TranscriptView />  {/* Also has flex-1 */}
  </section>
) : (
  <section className="flex-1 flex-col ...">
    <ActionsList />  {/* Takes full width */}
  </section>
)}
```

Both use `flex-1` which makes them split the available space equally and scale proportionally when the window is resized.

---

## Data Flow

### 1. Recording Phase
```
[Recording starts]
  ↓
[Actions captured] → Added to store.actions
  ↓
[Audio captured] → Buffered in renderer
  ↓
[Recording stops]
```

### 2. Transcription Phase
```
[Stop button clicked]
  ↓
[Audio sent to main process] → window.electronAPI.transcribeAudio()
  ↓
[Whisper processes audio] → Returns timestamped segments
  ↓
[Segments added to store] → store.setTranscriptSegments()
```

### 3. Voice Distribution Phase
```
[Segments received]
  ↓
[Distribute voice to actions] → window.electronAPI.distributeVoiceSegments()
  ↓
[Actions updated with voiceSegments] → store.setState({ actions })
  ↓
[Generate transcript text] → window.electronAPI.generateTranscriptWithReferences()
  ↓
[Transcript text saved to store] → store.setTranscriptText()
  ↓
[View transcript button appears] → canViewTranscript = true
```

### 4. Display Phase
```
[User clicks "View transcript"]
  ↓
[store.setTranscriptViewOpen(true)]
  ↓
[TranscriptView renders]
  ↓
[Narrative extracted and parsed]
  ↓
[Parts rendered as text/action/screenshot elements]
```

---

## Transcript Generation

### Backend Process

The transcript text is generated by [`electron/utils/enhancedTranscript.ts`](../electron/utils/enhancedTranscript.ts):

```typescript
export function generateTranscriptWithReferences(
  actions: RecordedAction[],
  sessionId: string,
  startTime: number,
  startUrl?: string
): string
```

**Generation Algorithm:**
1. Sort actions by timestamp
2. Build narrative by iterating through actions
3. For each action:
   - If action has voice segments → add voice text + action reference
   - If action has no voice → add just action reference
4. Add screenshot reference for screenshot-type actions
5. Wrap in markdown format with header and reference table

**Output Structure:**
```markdown
# Recording Session Transcript

[Session metadata]
[AI instructions (60+ lines)]

---

## Narrative

[Voice text] [action:ID:TYPE] [Voice text] [action:ID:TYPE] ...

## Action Reference

| Action ID | Type | Timestamp | Target |
|-----------|------|-----------|--------|
| ...       | ...  | ...       | ...    |
```

### When Transcript is Generated

**Timeline Changed (Latest Implementation):**
- ✅ **Now**: Generated immediately after recording stops (in `stopRecording()`)
- ❌ **Before**: Generated only when "Save Session" was clicked

**Code Location:** [`src/components/RecordingControls.tsx:stopRecording()`](../src/components/RecordingControls.tsx:120)

```typescript
// After transcription completes
if (result.success && result.segments) {
  // 1. Distribute voice segments to actions
  const distributionResult = await window.electronAPI.distributeVoiceSegments(...)
  
  if (distributionResult.success && distributionResult.actions) {
    // 2. Generate transcript immediately
    const transcriptResult = await window.electronAPI.generateTranscriptWithReferences(
      actionsWithVoice,
      sessionId,
      startTime,
      startUrl
    )
    
    if (transcriptResult.success && transcriptResult.transcript) {
      // 3. Save to store for UI display
      setTranscriptText(transcriptResult.transcript)
      
      // 4. Update actions with voice segments
      useRecordingStore.setState({ actions: actionsWithVoice })
    }
  }
}
```

---

## Styling

### Container Layout

```css
.transcript-container {
  flex: 1;                    /* Takes 50% of parent */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

### Content Area

```css
.transcript-content {
  flex: 1;
  overflow-y: auto;           /* Scrollable */
  padding: 1.5rem;            /* Comfortable reading */
}

.transcript-text-wrapper {
  max-width: 48rem;           /* 768px - optimal line length */
  margin: 0 auto;             /* Center content */
  font-size: 1rem;            /* 16px */
  line-height: 1.625;         /* 26px - relaxed reading */
  gap: 0.25rem;               /* 4px vertical spacing */
}
```

### Typography

- **Commentary text**: `text-foreground/95` (slightly muted for comfort)
- **Font size**: `text-base` (16px)
- **Line height**: `leading-relaxed` (1.625)
- **Vertical spacing**: `space-y-1` between parts

### Badge Styling

**Action badges** (interactive buttons):
- Background: `bg-secondary/50` (subtle)
- Hover: `bg-secondary` (brighter)
- Padding: `px-2 py-1` (8px x 4px)
- Border radius: `rounded-md`
- Margins: `mx-0.5` (2px horizontal spacing)
- Alignment: `align-middle` (aligned with text baseline)

**Color coding by action type:**
```typescript
const actionColors: Record<ActionType, string> = {
  click: 'text-blue-400 hover:text-blue-300',
  fill: 'text-green-400 hover:text-green-300',
  navigate: 'text-purple-400 hover:text-purple-300',
  assert: 'text-pink-400 hover:text-pink-300',
  screenshot: 'text-indigo-400 hover:text-indigo-300',
  // ... more
}
```

---

## Code Structure

### Main Component

```typescript
export function TranscriptView() {
  // 1. Get state from store
  const { transcriptText, actions, ... } = useRecordingStore()
  
  // 2. Extract narrative section
  const narrativeText = extractNarrative(transcriptText)
  
  // 3. Parse into structured parts
  const parts = parseTranscript(narrativeText)
  
  // 4. Render parts
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6">
        {parts.map((part, index) => {
          if (part.type === 'text') return <span>...</span>
          if (part.type === 'action') return <button>...</button>
          if (part.type === 'screenshot') return <span>...</span>
        })}
      </div>
    </div>
  )
}
```

### Helper Functions

**extractNarrative()**
- Uses regex to find `## Narrative` section
- Extracts content between narrative header and reference table
- Returns clean voice commentary with action references

**parseTranscript()**
- Uses regex to find all `[action:ID:TYPE]` and `[screenshot:FILENAME]` references
- Splits text into parts (text, action, screenshot)
- Preserves order for sequential rendering

**handleActionClick()**
- Matches 8-character short ID to full UUID
- Sets highlighted action in store
- Scrolls to action in ActionsList after 100ms delay

---

## Integration with ActionsList

### Bidirectional Communication

**Transcript → ActionsList:**
- Click action badge in transcript
- `setHighlightedActionId(action.id)` updates store
- ActionsList sees highlighted ID change
- ActionsList applies blue highlight to matching action
- ActionsList auto-scrolls to highlighted action

**ActionsList → Transcript:**
- ActionsList shows voice segments when expanded
- Same voice data that appears in transcript narrative
- Provides detailed view with timestamps

### Shared State

Both components read from the same store:
```typescript
// In ActionsList.tsx
const highlightedActionId = useRecordingStore((state) => state.highlightedActionId)

// Render highlight
<div className={cn(
  highlightedActionId === action.id
    ? 'bg-blue-500/20 border-l-4 border-l-blue-400'
    : 'hover:bg-card'
)}>
```

---

## Responsive Layout

### Window Resize Behavior

The layout uses flexbox with `flex-1` on both ActionsList and TranscriptView:

```tsx
<section className="flex-1 flex overflow-hidden">
  <div className="flex-1 min-w-0 ...">
    <ActionsList />
  </div>
  <TranscriptView />  {/* Also has flex-1 */}
</section>
```

**How it works:**
1. Parent container has `flex-1` (takes all available space after SettingsPanel)
2. Both children have `flex-1` (each gets 50% of parent)
3. When window expands/contracts, both panels scale proportionally
4. `min-w-0` on ActionsList prevents flex shrinking issues

### Constraints

- **SettingsPanel**: Fixed at 320px
- **ActionsList**: Flexible (50% of remaining space, minimum 0px)
- **TranscriptView**: Flexible (50% of remaining space)

---

## State Lifecycle

### Transcript Generation Timing

**When transcript text becomes available:**

1. **Recording stops** → User clicks "Stop Recording"
2. **Audio transcription** → Whisper processes audio (5-30 seconds)
3. **Voice distribution** → Segments assigned to actions (~1 second)
4. **Transcript generation** → Text with references created (~1 second)
5. **Store updated** → `transcriptText` becomes non-empty
6. **Button appears** → "View transcript" button shows
7. **User opens** → Split view renders

### Persistence

- Transcript text lives in Zustand store
- Survives between "View transcript" open/close cycles
- Cleared only when "Reset" button is clicked
- NOT cleared when "Save Session" is clicked

---

## Empty States

### No Transcript Available

If `transcriptText` is empty:
```tsx
<div className="flex-1 flex items-center justify-center p-8">
  <p className="text-sm text-muted-foreground">
    No transcript available yet. Record a session first.
  </p>
</div>
```

### No Voice Commentary Recorded

If recording has no voice (voice recording disabled or no speech detected):
- Transcript will contain only action references
- No narrative text between actions
- Still functional (shows action sequence)

---

## Design Decisions

### Why Extract Only Narrative Section?

The narrative field in actions.json contains:
- Voice commentary with embedded action references
- AI instructions (60+ lines)
- Narrative section ← **What we show**
- Action reference table

**Rationale:** Users want to read the actual commentary, not the metadata or instructions. Those sections are for AI agents consuming the saved files.

### Why Short IDs (8 characters)?

Full UUIDs are 36 characters (e.g., `43d16488-xxxx-xxxx-xxxx-xxxxxxxxxxxx`):
- **Too long** for inline badges
- **Hard to read** in flowing text
- **Visually cluttered**

8-character prefixes:
- **Readable** in narrative flow
- **Unique enough** (collision probability negligible for <10,000 actions)
- **Matches** saved narrative format in actions.json

### Why Inline Badges vs. Side References?

**Considered alternatives:**
1. Footnote-style references (text with superscripts)
2. Margin notes (action IDs in sidebar)
3. Hover tooltips (only visible on hover)

**Chose inline badges because:**
- **Immediately visible** - No hover or scroll needed
- **Clickable targets** - Easy to interact with
- **Visual distinction** - Color-coded by action type
- **Natural reading flow** - Embedded in commentary

---

## Accessibility

### Keyboard Navigation

Currently not implemented. Potential enhancements:
- Tab through action badges
- Enter to activate/click
- Arrow keys to navigate between badges

### Screen Reader Support

Action badges include:
- `title` attribute with descriptive text
- Semantic `<button>` elements
- Clear text labels (ID:TYPE format)

---

## Performance Considerations

### Parsing Optimization

The parsing happens on every render when `transcriptText` changes:
- Uses single regex pass (efficient)
- Creates structured array once
- React re-renders only when text changes

### Render Optimization

Could be optimized with:
- `React.memo()` for individual parts
- `useMemo()` for parsing logic
- Virtual scrolling for very long transcripts

**Current status:** Not needed for typical session sizes (<1000 actions).

---

## Future Enhancements

### High Priority

1. **Search Functionality**
   - Find text in commentary
   - Jump to specific actions
   - Highlight matching terms

2. **Export Transcript**
   - Copy transcript to clipboard
   - Export as markdown
   - Print-friendly view

### Medium Priority

3. **Timestamp Display**
   - Show relative timestamps next to action badges
   - Sync with video playback (if added)

4. **Action Preview**
   - Hover over action badge → show tooltip with details
   - Quick preview without scrolling to ActionsList

5. **Keyboard Shortcuts**
   - Navigate between actions (J/K or arrow keys)
   - Toggle transcript view (T key)

### Low Priority

6. **Theming**
   - Adjust font size
   - Toggle between light/dark mode
   - Custom color schemes

7. **Annotations**
   - Add notes to specific parts
   - Highlight important sections
   - Tag actions with labels

---

## Related Components

| Component | Relationship | File |
|-----------|-------------|------|
| **ActionsList** | Displays detailed action data | [`src/components/ActionsList.tsx`](../src/components/ActionsList.tsx) |
| **RecordingControls** | Triggers transcript generation | [`src/components/RecordingControls.tsx`](../src/components/RecordingControls.tsx) |
| **recordingStore** | Provides state | [`src/stores/recordingStore.ts`](../src/stores/recordingStore.ts) |
| **App** | Layout container | [`src/App.tsx`](../src/App.tsx) |

---

## References

### Implementation Files
- **Component**: [`src/components/TranscriptView.tsx`](../src/components/TranscriptView.tsx)
- **Layout**: [`src/App.tsx`](../src/App.tsx:48)
- **State**: [`src/stores/recordingStore.ts`](../src/stores/recordingStore.ts)
- **Transcript Generation**: [`electron/utils/enhancedTranscript.ts`](../electron/utils/enhancedTranscript.ts)

### Related Documentation
- **Output Format**: [`docs/output_format.md`](output_format.md) - Details on transcript.txt format
- **Voice Transcription**: [`docs/voice_transcription.md`](voice_transcription.md) - How voice is captured and processed
- **Architecture**: [`docs/architecture.md`](architecture.md) - Overall system design

---

## Summary

The Transcript View provides a **narrative reading experience** that bridges voice commentary and recorded actions. Its key strengths are:

- **Natural reading flow** with inline, clickable action references
- **Bidirectional navigation** between transcript and actions list
- **Responsive layout** that scales with window size
- **Real-time generation** after recording completes
- **Color-coded visual distinction** for different action types
- **Efficient parsing and rendering** of transcript text

The component demonstrates how to build a rich, interactive reading experience from structured data while maintaining simplicity and performance.
