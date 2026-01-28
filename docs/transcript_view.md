# Transcript View

UI component displaying voice commentary with embedded, clickable action references.

**Features:** Natural narrative flow, clickable action badges, auto-scroll synchronization, responsive 50/50 split with ActionsList.

---

## Implementation

**File:** [`src/components/TranscriptView.tsx`](../src/components/TranscriptView.tsx)

### State Management

```typescript
const { 
  transcriptText,           // From store (generated after recording stops)
  actions,                  // For ID matching
  setHighlightedActionId,   // Highlight in ActionsList
  setTranscriptViewOpen     // Close view
} = useRecordingStore()
```

**Data source:** [`electron/utils/enhancedTranscript.ts`](../electron/utils/enhancedTranscript.ts) via IPC

---

## Parsing Pipeline

### Step 1: Extract Narrative

```typescript
const extractNarrative = (text: string): string => {
  const match = text.match(/## Narrative\s*\n\s*([\s\S]*?)(?:\n\n## Action Reference|$)/)
  return match?.[1]?.trim() || text
}
```

Extracts only narrative section (voice + action references), ignoring header and reference table.

### Step 2: Parse into Structured Parts

```typescript
interface TranscriptPart {
  type: 'text' | 'action' | 'screenshot'
  content: string
  actionId?: string           // For action parts
  actionType?: ActionType     // For action parts
  screenshotFilename?: string // For screenshot parts
}

const parseTranscript = (text: string): TranscriptPart[] => {
  const regex = /\[(action|screenshot):([^\]]+)\]/g
  // Find all [action:ID:TYPE] and [screenshot:FILENAME] references
  // Extract text between references
  // Build structured array
}
```

**Example:**
```
Input: "Now clicking [action:43d16488:click] and filling [action:2bba1996:fill]"

Output: [
  { type: 'text', content: 'Now clicking ' },
  { type: 'action', content: '[action:43d16488:click]', actionId: '43d16488', actionType: 'click' },
  { type: 'text', content: ' and filling ' },
  { type: 'action', content: '[action:2bba1996:fill]', actionId: '2bba1996', actionType: 'fill' }
]
```

---

## Rendering

### Text Parts
```tsx
<span className="text-foreground/95 text-base leading-relaxed">
  {part.content}
</span>
```

### Action Parts (Clickable Badges)
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
  <span className="text-xs font-mono font-medium">{part.actionId}:{part.actionType}</span>
</button>
```

**Colors by type:** Click (blue), Fill (green), Navigate (purple), Assert (pink), Screenshot (indigo)

### Screenshot Parts
```tsx
<span className="inline-flex items-center gap-1.5 px-2 py-1 mx-0.5 rounded-md bg-indigo-500/10 text-indigo-400">
  <Camera className="w-3.5 h-3.5" />
  <span className="text-xs font-mono">{part.screenshotFilename}</span>
</span>
```

---

## Action Highlighting

```typescript
const handleActionClick = (shortId: string) => {
  // Match 8-char prefix to full UUID
  const action = actions.find(a => a.id.startsWith(shortId))
  if (action) {
    setHighlightedActionId(action.id)
    
    // Auto-scroll to action in ActionsList
    setTimeout(() => {
      const element = document.querySelector(`[data-action-id="${action.id}"]`)
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }
}
```

---

## Layout Integration

### Before Opening
```
┌─────────────────┬───────────────────────────────┐
│  SettingsPanel  │      ActionsList (full)       │
│   (320px fixed) │      (flex-1, 100%)           │
└─────────────────┴───────────────────────────────┘
```

### After Opening
```
┌─────────────────┬────────────────┬────────────────┐
│  SettingsPanel  │  ActionsList   │ TranscriptView │
│   (320px fixed) │ (flex-1, 50%)  │ (flex-1, 50%)  │
└─────────────────┴────────────────┴────────────────┘
```

**Implementation ([`App.tsx:48`](../src/App.tsx:48)):**
```tsx
{isTranscriptViewOpen ? (
  <section className="flex-1 flex overflow-hidden">
    <div className="flex-1 min-w-0 border-r"><ActionsList /></div>
    <TranscriptView />  {/* Also flex-1 */}
  </section>
) : (
  <section className="flex-1 flex-col"><ActionsList /></section>
)}
```

Both use `flex-1` for equal split, scale proportionally on window resize.

---

## Data Flow

**Timeline:**
1. Recording stops
2. Audio transcribed → Whisper segments
3. Voice distributed → Actions with voiceSegments
4. Transcript generated → `window.electronAPI.generateTranscriptWithReferences()`
5. Store updated → `transcriptText` becomes non-empty
6. "View transcript" button appears
7. User clicks → Split view renders

**Generation ([`RecordingControls.tsx:120`](../src/components/RecordingControls.tsx:120)):**
```typescript
// After transcription completes
if (result.success && result.segments) {
  const distributionResult = await window.electronAPI.distributeVoiceSegments(...)
  if (distributionResult.success && distributionResult.actions) {
    const transcriptResult = await window.electronAPI.generateTranscriptWithReferences(
      actionsWithVoice, sessionId, startTime, startUrl
    )
    if (transcriptResult.success && transcriptResult.transcript) {
      setTranscriptText(transcriptResult.transcript)
      useRecordingStore.setState({ actions: actionsWithVoice })
    }
  }
}
```

---

## Styling

**Container:** `flex: 1` (50% of parent), flexbox column, overflow hidden

**Content area:**
```css
.transcript-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.transcript-text-wrapper {
  max-width: 48rem;      /* 768px optimal line length */
  margin: 0 auto;
  font-size: 1rem;       /* 16px */
  line-height: 1.625;    /* Relaxed reading */
}
```

**Typography:** `text-foreground/95`, `text-base`, `leading-relaxed`, `space-y-1`

---

## Integration with ActionsList

### Bidirectional Communication

**Transcript → ActionsList:**
```
Click badge → setHighlightedActionId() → ActionsList applies highlight → Auto-scrolls
```

**ActionsList → Transcript:**
```
Shows voice segments when expanded (same data in transcript narrative)
```

### Shared State

```typescript
// In ActionsList.tsx
const highlightedActionId = useRecordingStore((state) => state.highlightedActionId)

<div className={cn(
  highlightedActionId === action.id
    ? 'bg-blue-500/20 border-l-4 border-l-blue-400'
    : 'hover:bg-card'
)}>
```

---

## References

**Implementation files:**
- Component: [`src/components/TranscriptView.tsx`](../src/components/TranscriptView.tsx)
- Layout: [`src/App.tsx`](../src/App.tsx:48)
- State: [`src/stores/recordingStore.ts`](../src/stores/recordingStore.ts)
- Generation: [`electron/utils/enhancedTranscript.ts`](../electron/utils/enhancedTranscript.ts)

**Related docs:**
- [`output_format.md`](output_format.md) - actions.json format
- [`voice_transcription.md`](voice_transcription.md) - Transcription pipeline
