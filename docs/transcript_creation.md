# Transcript Creation Pipeline

**Last Updated**: January 2026  
**Status**: ✅ Enhanced with Sentence-Level Action Distribution

---

## Table of Contents

1. [Overview](#overview)
2. [Pipeline Stages](#pipeline-stages)
3. [Stage 1: Audio Transcription](#stage-1-audio-transcription)
4. [Stage 2: Voice Distribution](#stage-2-voice-distribution)
5. [Stage 3: Transcript Generation](#stage-3-transcript-generation)
6. [Improved Algorithm: Sentence-Level Distribution](#improved-algorithm-sentence-level-distribution)
7. [Data Flow](#data-flow)
8. [Examples](#examples)
9. [Performance Considerations](#performance-considerations)
10. [References](#references)

---

## Overview

The transcript creation pipeline transforms raw audio recordings and browser actions into a human-readable, AI-friendly narrative. The process involves three main stages:

1. **Audio Transcription** - Convert voice audio to timestamped text segments using Whisper.cpp
2. **Voice Distribution** - Associate voice segments with browser actions based on temporal proximity
3. **Transcript Generation** - Interleave actions within sentences for precise, natural reading flow

**Key Improvement (January 2026)**: The transcript generation now uses **sentence-level action distribution** for surgical precision, placing action references exactly where they're mentioned in the narrative.

---

## Pipeline Stages

```
┌─────────────────────────────────────────────────────────────┐
│                    Recording Complete                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Stage 1: Audio Transcription (Whisper.cpp)                 │
│  • Convert WebM → WAV with 1.5s silence padding             │
│  • Run Whisper model with optimized parameters              │
│  • Parse JSON output into timestamped segments              │
│  • Subtract 1500ms offset to account for padding            │
└─────────────────────────────────────────────────────────────┘
                              ↓
                  [TranscriptSegment[]]
                  (Voice with timestamps)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Stage 2: Voice Distribution (voiceDistribution.ts)         │
│  • Tighter time windows (4s lookback, 2s lookahead)         │
│  • Find actions within temporal window of each segment      │
│  • Assign segments to nearest actions                       │
│  • Handle overlapping/split segments intelligently          │
└─────────────────────────────────────────────────────────────┘
                              ↓
            [RecordedAction[] with voiceSegments]
            (Actions with associated voice)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Stage 3: Transcript Generation (enhancedTranscript.ts)     │
│  • NEW: Split voice segments into sentences                 │
│  • NEW: Calculate proportional timestamps per sentence      │
│  • NEW: Interleave actions within sentences                 │
│  • Generate complete narrative with embedded action refs    │
│  • Create action reference table                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    [transcript.txt]
         (Narrative with precisely placed actions)
```

---

## Stage 1: Audio Transcription

**File**: [`electron/audio/transcriber.ts`](../electron/audio/transcriber.ts)

### Process

1. **Receive Audio Buffer** - WebM format from renderer process
2. **Convert to WAV** - Using FFmpeg with:
   - 16kHz sample rate (Whisper native)
   - Mono channel
   - PCM S16LE codec
   - **1.5s silence padding** prepended for better early speech detection
3. **Run Whisper.cpp** - Direct CLI invocation with optimized parameters:
   - Model: `small.en` (466MB)
   - Entropy threshold: `2.0` (lower = better early detection)
   - Beam search: `5` candidates
   - Split on word boundaries
   - JSON output format
4. **Parse JSON Output** - Extract timestamped segments
5. **Adjust Timestamps** - Subtract 1500ms to account for silence padding

### Output

```typescript
interface TranscriptSegment {
  id: string        // e.g., "t1", "t2", "t3"
  startTime: number // milliseconds from recording start
  endTime: number   // milliseconds from recording start
  text: string      // transcribed text
}
```

**Example:**
```typescript
[
  {
    id: "t1",
    startTime: 0,
    endTime: 3200,
    text: "Now I'm clicking the login button."
  },
  {
    id: "t2",
    startTime: 3500,
    endTime: 6800,
    text: "Then I'll fill in the username and password fields."
  }
]
```

---

## Stage 2: Voice Distribution

**File**: [`electron/utils/voiceDistribution.ts`](../electron/utils/voiceDistribution.ts)

### Improved Time Windows (January 2026)

**Previous values** (too broad):
- Lookback: 10 seconds
- Lookahead: 5 seconds
- Long segment threshold: 3 seconds

**New values** (more precise):
- Lookback: **4 seconds** (60% reduction)
- Lookahead: **2 seconds** (60% reduction)
- Long segment threshold: **2 seconds** (33% reduction)

### Algorithm

The voice distribution algorithm associates voice segments with actions using temporal proximity:

```typescript
function distributeVoiceSegments(
  actions: RecordedAction[],
  segments: TranscriptSegment[],
  sessionStartTime: number
): RecordedAction[]
```

**Steps:**

1. **Sort inputs** - Ensure chronological order
2. **Handle pre-action segments** - Assign segments before first action to first action
3. **For each segment**:
   - Find actions within temporal window (action.timestamp ± 4s/2s)
   - If no actions in window → assign to closest action
   - If 1 action in window → assign to that action
   - If multiple actions in window:
     - Check if segment is "long" (>2s) and spans actions
     - If yes → assign to ALL relevant actions
     - If no → assign to closest action by midpoint

### Example Scenario

```
Timeline (milliseconds):

Voice Segments:
[0-3000]    "Now I'll click the login button"
[3500-6000] "Then fill the username field"
[7000-9000] "And the password field"

Actions:
[2500]  Click login button
[4200]  Fill username
[8100]  Fill password

Distribution Result:
Action 1 (2500ms): ["Now I'll click the login button"]
Action 2 (4200ms): ["Then fill the username field"]
Action 3 (8100ms): ["And the password field"]
```

### Output

Actions with `voiceSegments` attached:

```typescript
interface RecordedAction {
  id: string
  timestamp: number
  type: ActionType
  target?: TargetInfo
  voiceSegments?: TranscriptSegment[]  // ← Added by distribution
  // ... other fields
}
```

---

## Stage 3: Transcript Generation

**File**: [`electron/utils/enhancedTranscript.ts`](../electron/utils/enhancedTranscript.ts)

### Overview

This stage generates the final [`transcript.txt`](../electron/utils/enhancedTranscript.ts:30) file with:
- Session metadata header
- AI usage instructions (60+ lines)
- Narrative with precisely placed action references
- Action reference table

### Main Function

```typescript
export function generateTranscriptWithReferences(
  actions: RecordedAction[],
  sessionId: string,
  startTime: number,
  startUrl?: string
): string
```

### Process

1. **Generate Header** - Session metadata and AI instructions
2. **Build Narrative** - Using improved sentence-level distribution
3. **Generate Reference Table** - Quick lookup for all actions

---

## Improved Algorithm: Sentence-Level Distribution

### Problem with Previous Approach

**Before (Segment-Level Distribution):**
```
Voice: "Now I'm clicking login then filling username and password."
Actions: [click at 2s, fill at 3s, fill at 4s]

Output:
"Now I'm clicking login then filling username and password. 
[action:abc:click] [action:def:fill] [action:ghi:fill]"
```

❌ **Issues:**
- All actions clustered at the end
- No connection to specific phrases
- Poor reading flow
- Difficult to see what action corresponds to what speech

### Solution: Sentence-Level Distribution

**After (Sentence-Level with Interleaving):**
```
Voice: "Now I'm clicking login. Then filling username. And password."
Actions: [click at 2s, fill at 3s, fill at 4s]

Output:
"Now I'm clicking login [action:abc:click]. Then filling username 
[action:def:fill]. And password [action:ghi:fill]."
```

✅ **Benefits:**
- Actions appear adjacent to relevant phrases
- Natural reading flow
- Clear action-to-speech association
- Better AI understanding of intent

### Implementation Details

#### 1. Sentence Splitting with Timestamps

**Function**: [`splitIntoSentencesWithTimestamps()`](../electron/utils/enhancedTranscript.ts:43)

Splits voice segment text into sentences and calculates proportional timestamps:

```typescript
interface SentenceWithTime {
  text: string
  startTime: number
  endTime: number
}

function splitIntoSentencesWithTimestamps(
  text: string,
  segmentStartTime: number,
  segmentEndTime: number
): SentenceWithTime[]
```

**Algorithm:**
1. Split text by sentence boundaries (`.`, `!`, `?`)
2. Calculate total segment duration
3. For each sentence:
   - Calculate its proportion of total text length
   - Assign proportional time range
   - Round to milliseconds

**Example:**
```typescript
Input:
  text: "First sentence. Second sentence. Third sentence."
  segmentStartTime: 1000
  segmentEndTime: 4000

Output:
[
  { text: "First sentence.", startTime: 1000, endTime: 2000 },
  { text: "Second sentence.", startTime: 2000, endTime: 3000 },
  { text: "Third sentence.", startTime: 3000, endTime: 4000 }
]
```

**Edge Cases Handled:**
- Text with no sentence delimiters → returns whole text with full time range
- Uneven sentence lengths → proportional based on character count
- Remaining text without delimiter → appended with remaining time

#### 2. Action Interleaving

**Function**: [`interleaveActionsInText()`](../electron/utils/enhancedTranscript.ts:113)

Places actions between sentences based on timestamp proximity:

```typescript
function interleaveActionsInText(
  sentences: SentenceWithTime[],
  actions: RecordedAction[]
): string
```

**Algorithm:**
1. Sort actions by timestamp
2. For each sentence:
   - Find all actions whose timestamp falls within sentence time range
   - Add sentence text
   - Add action references after sentence
   - Add space between sentences
3. Handle any remaining unplaced actions (edge case)

**Placement Logic:**
```typescript
// Action belongs after this sentence if:
const isInSentenceRange = 
  action.timestamp >= sentence.startTime && 
  action.timestamp <= sentence.endTime

const isBeforeNextSentence = 
  i === sentences.length - 1 || 
  action.timestamp < sentences[i + 1].startTime
```

**Example:**
```typescript
Input:
  sentences: [
    { text: "Clicking button.", startTime: 0, endTime: 2000 },
    { text: "Filling form.", startTime: 2000, endTime: 4000 }
  ]
  actions: [
    { timestamp: 1500, type: "click", id: "abc..." },
    { timestamp: 3000, type: "fill", id: "def..." }
  ]

Output:
"Clicking button. [action:abc:click] Filling form. [action:def:fill]"
```

#### 3. Narrative Building

**Function**: [`buildNarrativeWithSentenceLevelDistribution()`](../electron/utils/enhancedTranscript.ts:193)

Orchestrates the complete narrative generation:

```typescript
function buildNarrativeWithSentenceLevelDistribution(
  actions: RecordedAction[]
): string
```

**Algorithm:**
1. **Group actions by segments** - Build map of segment → actions
2. **Collect unique segments** - Chronological order, no duplicates
3. **Process each segment**:
   - If segment has no actions → add text only
   - If segment has actions:
     - Split into sentences with timestamps
     - Interleave actions within sentences
     - Add to narrative
4. **Append silent actions** - Actions without voice at the end

**Handles Edge Cases:**
- **Actions without voice** - Placed at end of narrative
- **Duplicate segments** - Tracked with Set to avoid repeats
- **Multiple actions per sentence** - All placed after sentence
- **Rapid actions** (<1s apart) - Placed in sequence within sentence range
- **Long monologues** - Distributed across sentence boundaries

---

## Data Flow

### Complete Pipeline

```typescript
// 1. Recording stops
const audioBuffer = await stopAudioRecording()
const actions = await stopBrowserRecording()

// 2. Transcribe audio → segments
const segments: TranscriptSegment[] = await transcribeAudio(audioBuffer)
// Result: [
//   { id: "t1", startTime: 0, endTime: 3000, text: "..." },
//   { id: "t2", startTime: 3500, endTime: 6000, text: "..." }
// ]

// 3. Distribute voice to actions → actions with voiceSegments
const actionsWithVoice = distributeVoiceSegments(actions, segments, startTime)
// Result: [
//   { id: "...", timestamp: 2000, type: "click", voiceSegments: [...] },
//   { id: "...", timestamp: 4500, type: "fill", voiceSegments: [...] }
// ]

// 4. Generate transcript → narrative text
const transcriptText = generateTranscriptWithReferences(
  actionsWithVoice,
  sessionId,
  startTime,
  startUrl
)
// Result: "Voice text [action:abc:click] more text [action:def:fill]..."

// 5. Save to disk
await saveSession({
  actions: actionsWithVoice,
  transcriptText,
  sessionId,
  startTime
})
```

### IPC Flow

```
Renderer Process          Main Process
─────────────────        ─────────────

stopRecording()
    ↓
transcribeAudio(buffer) ──→ Transcriber.transcribe()
    ↓                           ↓
segments ←──────────────── TranscriptSegment[]
    ↓
distributeVoiceSegments() ─→ distributeVoiceSegments()
    ↓                           ↓
actionsWithVoice ←──────── RecordedAction[]
    ↓
generateTranscript() ──────→ generateTranscriptWithReferences()
    ↓                           ↓
transcriptText ←────────── string
    ↓
saveSession() ─────────────→ SessionWriter.save()
```

---

## Examples

### Example 1: Simple Linear Flow

**Input:**
```typescript
Voice Segments:
[
  { startTime: 0, endTime: 2500, text: "Clicking the submit button." },
  { startTime: 3000, endTime: 5000, text: "Filling the email field." }
]

Actions:
[
  { timestamp: 2000, type: "click", id: "a1b2c3d4-..." },
  { timestamp: 4000, type: "fill", id: "e5f6g7h8-...", value: "test@example.com" }
]
```

**Process:**
1. Distribute voice → Action 1 gets segment 1, Action 2 gets segment 2
2. Split segment 1 → ["Clicking the submit button."] (1 sentence)
3. Split segment 2 → ["Filling the email field."] (1 sentence)
4. Interleave actions:
   - Action 1 (2000ms) falls in sentence 1 range (0-2500ms)
   - Action 2 (4000ms) falls in sentence 2 range (3000-5000ms)

**Output:**
```
Clicking the submit button. [action:a1b2c3d4:click] Filling the email 
field. [action:e5f6g7h8:fill]
```

### Example 2: Multiple Actions in One Segment

**Input:**
```typescript
Voice Segment:
{
  startTime: 0,
  endTime: 6000,
  text: "Clicking home. Then clicking about. Finally clicking contact."
}

Actions:
[
  { timestamp: 1500, type: "click", id: "home..." },
  { timestamp: 3000, type: "click", id: "about..." },
  { timestamp: 4500, type: "click", id: "contact..." }
]
```

**Process:**
1. Split into sentences:
   - S1: "Clicking home." (0-2000ms)
   - S2: "Then clicking about." (2000-4000ms)
   - S3: "Finally clicking contact." (4000-6000ms)
2. Match actions to sentences:
   - home (1500ms) → S1
   - about (3000ms) → S2
   - contact (4500ms) → S3

**Output:**
```
Clicking home. [action:home:click] Then clicking about. [action:about:click] 
Finally clicking contact. [action:contact:click]
```

### Example 3: Actions Without Voice

**Input:**
```typescript
Voice Segments: []  // Voice recording disabled

Actions:
[
  { timestamp: 1000, type: "navigate", url: "https://example.com" },
  { timestamp: 2000, type: "click", id: "button..." },
  { timestamp: 3000, type: "fill", id: "input...", value: "test" }
]
```

**Output:**
```
[action:navigate:navigate] [action:button:click] [action:input:fill]
```

All actions listed without narrative text.

---

## Performance Considerations

### Time Complexity

- **Sentence splitting**: O(n) where n = text length
- **Action interleaving**: O(s × a) where s = sentences, a = actions
- **Overall**: O(s × a) for typical sessions, highly efficient

### Memory Usage

- **Sentence array**: Minimal (few KB per segment)
- **Action references**: Already in memory
- **Generated text**: ~1-5KB per minute of recording

### Optimization Opportunities

1. **Memoization** - Cache sentence splits for identical segments
2. **Streaming** - Generate narrative incrementally (not needed for current sizes)
3. **Parallel processing** - Process segments concurrently (marginal benefit)

**Current status**: No optimizations needed for typical sessions (<1000 actions, <30 minutes recording).

---

## Configuration

### Time Windows

Configurable via settings (stored in `electron/settings/store.ts`):

```typescript
interface VoiceDistributionSettings {
  lookbackMs: number        // Default: 4000 (4 seconds)
  lookaheadMs: number       // Default: 2000 (2 seconds)
  longSegmentThresholdMs: number  // Default: 2000 (2 seconds)
}
```

Update via:
```typescript
import { updateTimeWindows } from './electron/utils/voiceDistribution'

updateTimeWindows({
  lookbackMs: 3000,    // More restrictive
  lookaheadMs: 1000,   // More restrictive
  longSegmentThresholdMs: 1500
})
```

### Sentence Splitting

Currently hard-coded to split on:
- Period (`.`)
- Exclamation mark (`!`)
- Question mark (`?`)

Future: Could add configuration for:
- Comma splitting (finer granularity)
- Custom delimiters
- Minimum sentence length

---

## Comparison: Before vs. After

### Before (Segment-Level Distribution)

```typescript
// Old algorithm in enhancedTranscript.ts
for (const action of sortedActions) {
  if (action.voiceSegments.length > 0) {
    // Add all voice text
    for (const segment of action.voiceSegments) {
      narrativeText += segment.text + ' '
    }
    // Add action reference at END
    narrativeText += formatActionReference(action) + ' '
  }
}
```

**Output:**
```
Now I'm clicking the button then filling the form and submitting. 
[action:a:click] [action:b:fill] [action:c:click]
```

### After (Sentence-Level Distribution)

```typescript
// New algorithm
for (const segment of allSegments) {
  // Split into sentences with timestamps
  const sentences = splitIntoSentencesWithTimestamps(
    segment.text,
    segment.startTime,
    segment.endTime
  )
  
  // Interleave actions within sentences
  const text = interleaveActionsInText(sentences, segmentActions)
  narrativeText += text
}
```

**Output:**
```
Now I'm clicking the button [action:a:click] then filling the form 
[action:b:fill] and submitting [action:c:click].
```

### Quantitative Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Time window precision** | 10s lookback, 5s lookahead | 4s lookback, 2s lookahead | **60% tighter** |
| **Action placement granularity** | Per segment (5-10s) | Per sentence (1-3s) | **3-5x finer** |
| **Reading flow** | Clustered at end | Distributed inline | **Significantly better** |
| **AI understanding** | Context separated | Context adjacent | **Much clearer** |

---

## References

### Implementation Files

- **Transcription**: [`electron/audio/transcriber.ts`](../electron/audio/transcriber.ts)
- **Voice Distribution**: [`electron/utils/voiceDistribution.ts`](../electron/utils/voiceDistribution.ts)
- **Transcript Generation**: [`electron/utils/enhancedTranscript.ts`](../electron/utils/enhancedTranscript.ts)
- **IPC Handlers**: [`electron/ipc/recording.ts`](../electron/ipc/recording.ts)

### Related Documentation

- **Voice Transcription**: [`docs/voice_transcription.md`](voice_transcription.md) - Whisper.cpp details
- **Output Format**: [`docs/output_format.md`](output_format.md) - Session bundle structure
- **Architecture**: [`docs/architecture.md`](architecture.md) - Overall system design

### Type Definitions

```typescript
// shared/types.ts
export interface TranscriptSegment {
  id: string
  startTime: number
  endTime: number
  text: string
}

export interface RecordedAction {
  id: string
  timestamp: number
  type: ActionType
  voiceSegments?: TranscriptSegment[]
  // ... other fields
}
```

---

## Summary

The transcript creation pipeline transforms raw audio and browser actions into a precisely formatted narrative through three key stages:

1. **Audio Transcription** - Whisper.cpp converts voice to timestamped segments with optimized early speech detection

2. **Voice Distribution** - Improved temporal windows (4s lookback, 2s lookahead) create tighter voice-to-action associations

3. **Transcript Generation** - NEW sentence-level algorithm:
   - Splits voice segments into sentences
   - Calculates proportional timestamps per sentence
   - Interleaves actions exactly where they're mentioned
   - Creates natural, precise reading flow

**Key Achievement**: Actions now appear adjacent to the specific phrases describing them, providing surgical precision in the narrative while maintaining natural readability for both humans and AI systems.
