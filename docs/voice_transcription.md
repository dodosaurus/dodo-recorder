# Voice Transcription

Local voice transcription using OpenAI's Whisper model (via whisper.cpp) with intelligent action association and sentence-level narrative generation.

**Pipeline:** Audio Capture → Whisper Transcription → Voice Distribution → Transcript Generation

**Key features:** 100% local (no cloud), optimized early speech detection, 4s lookback/2s lookahead temporal windows, sentence-level action placement.

---

## Pipeline Architecture

```
Recording Complete
  ↓
Stage 1: Audio Transcription (Whisper.cpp)
  • MediaRecorder captures WebM audio (16kHz)
  • FFmpeg converts to WAV + 1.5s silence padding
  • Whisper.cpp with optimized parameters
  • JSON output → timestamped segments
  • Subtract 1500ms offset for padding
  ↓
TranscriptSegment[] (voice with timestamps)
  ↓
Stage 2: Voice Distribution (voiceDistribution.ts)
  • 4s lookback, 2s lookahead windows
  • Assign segments to nearest actions
  • Handle overlapping segments
  ↓
RecordedAction[] with voiceSegments
  ↓
Stage 3: Transcript Generation (enhancedTranscript.ts)
  • Split voice into sentences with timestamps
  • Interleave actions within sentences
  • Generate narrative with embedded action refs
  ↓
actions.json (_meta + narrative + actions)
```

---

## Stage 1: Audio Transcription

**Files:** [`electron/audio/transcriber.ts`](../electron/audio/transcriber.ts), [`src/components/RecordingControls.tsx`](../src/components/RecordingControls.tsx)

### Audio Capture

- Web Audio API `MediaRecorder` in renderer
- WebM format, Opus codec, 16kHz (Whisper native)
- Chunks collected every second
- Synchronized with browser actions via shared `startTime`

### Processing Pipeline

```
WebM Buffer → FFmpeg (16kHz mono WAV + 1.5s padding) → Whisper.cpp CLI 
  → JSON parsing → Timestamp adjustment (-1500ms) → TranscriptSegment[]
```

**FFmpeg conversion:**
```typescript
ffmpeg(inputPath)
  .audioFrequency(16000)
  .audioChannels(1)
  .audioCodec('pcm_s16le')
  .audioFilters([
    'apad=pad_dur=1.5',   // Padding technique for early speech detection
    'areverse',
    'apad=pad_dur=1.5',
    'areverse'
  ])
```

**Why 1.5s padding:** Whisper's VAD misses first few seconds without leading silence.

### Whisper.cpp Direct Integration

<function_calls>
<invoke name="write_to_file">
<parameter name="content"># Voice Transcription

Local voice transcription using OpenAI's Whisper model (via whisper.cpp) with intelligent action association and sentence-level narrative generation.

**Pipeline:** Audio Capture → Whisper Transcription → Voice Distribution → Transcript Generation

**Key features:** 100% local (no cloud), optimized early speech detection, 4s lookback/2s lookahead temporal windows, sentence-level action placement.

---

## Pipeline Architecture

```
Recording Complete
  ↓
Stage 1: Audio Transcription (Whisper.cpp)
  • MediaRecorder captures WebM audio (16kHz)
  • FFmpeg converts to WAV + 1.5s silence padding
  • Whisper.cpp with optimized parameters
  • JSON output → timestamped segments
  • Subtract 1500ms offset for padding
  ↓
TranscriptSegment[] (voice with timestamps)
  ↓
Stage 2: Voice Distribution (voiceDistribution.ts)
  • 4s lookback, 2s lookahead windows
  • Assign segments to nearest actions
  • Handle overlapping segments
  ↓
RecordedAction[] with voiceSegments
  ↓
Stage 3: Transcript Generation (enhancedTranscript.ts)
  • Split voice into sentences with timestamps
  • Interleave actions within sentences
  • Generate narrative with embedded action refs
  ↓
actions.json (_meta + narrative + actions)
```

---

## Stage 1: Audio Transcription

**Files:** [`electron/audio/transcriber.ts`](../electron/audio/transcriber.ts), [`src/components/RecordingControls.tsx`](../src/components/RecordingControls.tsx)

### Audio Capture

- Web Audio API `MediaRecorder` in renderer
- WebM format, Opus codec, 16kHz (Whisper native)
- Chunks collected every second
- Synchronized with browser actions via shared `startTime`

### Processing Pipeline

```
WebM Buffer → FFmpeg (16kHz mono WAV + 1.5s padding) → Whisper.cpp CLI 
  → JSON parsing → Timestamp adjustment (-1500ms) → TranscriptSegment[]
```

**FFmpeg conversion:**
```typescript
ffmpeg(inputPath)
  .audioFrequency(16000)
  .audioChannels(1)
  .audioCodec('pcm_s16le')
  .audioFilters([
    'apad=pad_dur=1.5',   // Padding for early speech detection
    'areverse',
    'apad=pad_dur=1.5',
    'areverse'
  ])
```

**Why 1.5s padding:** Whisper's VAD misses first few seconds without leading silence.

### Whisper.cpp Command

```typescript
const command = [
  whisperMainPath,
  '-m', modelPath,
  '-f', audioPath,
  '-l', 'en',
  '-oj',              // Output JSON
  '-ml', '50',        // Max 50 chars per segment (1-2s phrases)
  '-sow',             // Split on word boundaries
  '-bo', '5',         // Best of 5 candidates
  '-bs', '5',         // Beam size 5
  '-et', '2.0',       // Entropy threshold (critical for early detection)
  '-lpt', '-1.0',     // Log probability threshold
  '--prompt', '"..."' // Context priming
].join(' ')
```

**Critical parameters:**

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `-et` | `2.0` | Lower = aggressive early speech detection |
| `-bo` | `5` | Beam search candidates |
| `-ml` | `50` | Max chars per segment (phrase-level) |
| `--prompt` | context | Prime with expected vocabulary |

### Anti-Hallucination Filtering

**Problem:** Whisper generates fabricated text when given silence.

**Solution:** Two-phase post-processing ([`transcriber.ts:309`](../electron/audio/transcriber.ts:309)):

**Phase 1: Detect repetitions**
```typescript
const textCounts = new Map<string, number>()
result.forEach(segment => {
  const text = segment.speech.trim()
  textCounts.set(text, (textCounts.get(text) || 0) + 1)
})

const hallucinatedTexts = new Set<string>()
textCounts.forEach((count, text) => {
  if (count >= 2) {
    hallucinatedTexts.add(text)
  }
})
```

**Phase 2: Filter all hallucination types**
```typescript
const validSegments = result.filter(segment => {
  const text = segment.speech.trim()
  const isValid = text.length > 0 &&
    text !== WHISPER_PROMPT &&           // Remove prompt text
    !hallucinatedTexts.has(text) &&     // Remove repetitions
    !text.match(/^\[.*\]$/) &&          // Remove [BLANK_AUDIO]
    !text.match(/^\(.*\)$/) &&          // Remove (noise)
    text !== '...' &&
    text.length > 2
  return isValid
})
```

**Filters:** Prompt text, repetitive phrases (2+ occurrences), bracketed markers, very short segments.

**Why post-processing:** Cross-version compatible, reliable, debuggable, flexible, ~95% effective.

### Output

```typescript
interface TranscriptSegment {
  id: string        // "t1", "t2", "t3"
  startTime: number // ms from recording start
  endTime: number   // ms from recording start
  text: string      // transcribed text
}
```

---

## Stage 2: Voice Distribution

**File:** [`electron/utils/voiceDistribution.ts`](../electron/utils/voiceDistribution.ts)

### Algorithm

```typescript
function distributeVoiceSegments(
  actions: RecordedAction[],
  segments: TranscriptSegment[],
  sessionStartTime: number
): RecordedAction[]
```

**Time windows (Jan 2026 - tightened 60%):**
- Lookback: 4 seconds (speech precedes action)
- Lookahead: 2 seconds (confirmations)
- Long segment threshold: 2 seconds

**Process:**
1. Sort inputs chronologically
2. Handle pre-action segments → assign to first action
3. For each segment:
   - Find actions within window (timestamp ± 4s/2s)
   - No actions → assign to closest
   - 1 action → assign to that action
   - Multiple actions:
     - Long segment (>2s) spanning actions → assign to ALL
     - Short segment → assign to closest by midpoint

**Features:** Overlap handling, multi-action assignment, pre-action capture, closest-action fallback.

### Output

```typescript
interface RecordedAction {
  id: string
  timestamp: number
  type: ActionType
  voiceSegments?: TranscriptSegment[]  // ← Added
  // ... other fields
}
```

---

## Stage 3: Transcript Generation

**File:** [`electron/utils/enhancedTranscript.ts`](../electron/utils/enhancedTranscript.ts)

### Sentence-Level Distribution

**Key improvement:** Places action references exactly where mentioned in narrative (surgical precision).

**Before (segment-level):**
```
"Clicking login then filling username and password. 
[action:abc:click] [action:def:fill] [action:ghi:fill]"
```
❌ All actions clustered at end

**After (sentence-level):**
```
"Clicking login [action:abc:click]. Filling username [action:def:fill]. 
And password [action:ghi:fill]."
```
✅ Actions adjacent to relevant phrases

### Implementation

**Sentence splitting** ([`enhancedTranscript.ts:43`](../electron/utils/enhancedTranscript.ts:43)):
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
1. Split by sentence boundaries (`.`, `!`, `?`)
2. Calculate proportional timestamps per sentence based on text length
3. Return array of sentences with time ranges

**Action interleaving** ([`enhancedTranscript.ts:113`](../electron/utils/enhancedTranscript.ts:113)):
```typescript
function interleaveActionsInText(
  sentences: SentenceWithTime[],
  actions: RecordedAction[]
): string
```

**Algorithm:**
1. Sort actions by timestamp
2. For each sentence:
   - Find actions whose timestamp falls within sentence time range
   - Add sentence text + action references after sentence
3. Handle remaining unplaced actions

**Narrative building** ([`enhancedTranscript.ts:193`](../electron/utils/enhancedTranscript.ts:193)):
```typescript
function buildNarrativeWithSentenceLevelDistribution(
  actions: RecordedAction[]
): string
```

**Process:**
1. Group actions by segments
2. Collect unique segments chronologically
3. For each segment:
   - If no actions → add text only
   - If has actions → split into sentences → interleave actions
4. Append silent actions at end

**Handles:** Actions without voice, duplicate segments, multiple actions per sentence, rapid actions, long monologues.

### Improvements

| Metric | Before | After |
|--------|--------|-------|
| Time window precision | 10s/5s | 4s/2s (60% tighter) |
| Action placement | Per segment (5-10s) | Per sentence (1-3s) (3-5x finer) |
| Reading flow | Clustered | Distributed inline |

---

## Whisper Model

### Model: small.en

**Download (required for development):**
```bash
curl -L -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin
```

**Characteristics:**
- Size: 466 MB disk, ~1.0 GB RAM
- Speed: ~2-3x real-time (10s audio → 3-5s transcription)
- Quality: Better accuracy for technical terms
- Early speech: Reliable with optimized parameters

**Location:**
```
models/
├── unix/whisper            # Binary (committed)
├── win/whisper-cli.exe     # Binary (committed)
└── ggml-small.en.bin      # Weights (download manually, gitignored)
```

---

## Output Format

### actions.json narrative Field

Voice commentary with embedded action references:

```markdown
## Narrative

The browser opened [action:e6c3069a:navigate]. Now clicking menu items
[action:c5922be3:click] [action:72e42724:click] to assert them
[action:2e185707:assert]. Taking screenshot [action:4a62c1b8:screenshot]
[screenshot:screenshot-001.png]. Clicking LinkedIn [action:ef955889:click]...

## Action Reference

| Action ID | Type | Timestamp | Target |
|-----------|------|-----------|--------|
| e6c3069a | navigate | 00:00 | https://example.com |
| c5922be3 | click | 00:03 | Home |
...
```

**Reference format:**
- Actions: `[action:SHORT_ID:TYPE]`
- SHORT_ID = first 8 chars of UUID
- Example: `[action:8c61934e:click]` → `"id": "8c61934e-4cd3-4793-bdb5-5c1c6d696f37"`

---

## Data Flow

```typescript
// 1. Recording stops
const audioBuffer = await stopAudioRecording()
const actions = await stopBrowserRecording()

// 2. Transcribe → segments
const segments: TranscriptSegment[] = await transcribeAudio(audioBuffer)

// 3. Distribute → actions with voice
const actionsWithVoice = distributeVoiceSegments(actions, segments, startTime)

// 4. Generate → narrative text
const transcriptText = generateTranscriptWithReferences(
  actionsWithVoice, sessionId, startTime, startUrl
)

// 5. Save
await saveSession({ actions: actionsWithVoice, transcriptText, sessionId, startTime })
```

### IPC Flow

```
Renderer                      Main
stopRecording()
  ↓
transcribeAudio(buffer) ────→ Transcriber.transcribe()
  ↓                             ↓
segments ←──────────────────── TranscriptSegment[]
  ↓
distributeVoiceSegments() ──→ distributeVoiceSegments()
  ↓                             ↓
actionsWithVoice ←──────────── RecordedAction[]
  ↓
generateTranscript() ────────→ generateTranscriptWithReferences()
  ↓                             ↓
transcriptText ←────────────── string
  ↓
saveSession() ───────────────→ SessionWriter.save()
```

---

## Examples

### Simple Linear Flow

**Input:**
```typescript
Voice: [
  { startTime: 0, endTime: 2500, text: "Clicking the submit button." },
  { startTime: 3000, endTime: 5000, text: "Filling the email field." }
]
Actions: [
  { timestamp: 2000, type: "click", id: "a1b2c3d4-..." },
  { timestamp: 4000, type: "fill", id: "e5f6g7h8-..." }
]
```

**Output:**
```
Clicking the submit button. [action:a1b2c3d4:click] Filling the email field. [action:e5f6g7h8:fill]
```

### Multiple Actions in One Segment

**Input:**
```typescript
Voice: {
  startTime: 0, endTime: 6000,
  text: "Clicking home. Then clicking about. Finally clicking contact."
}
Actions: [
  { timestamp: 1500, type: "click", id: "home..." },
  { timestamp: 3000, type: "click", id: "about..." },
  { timestamp: 4500, type: "click", id: "contact..." }
]
```

**Sentence split:**
- S1: "Clicking home." (0-2000ms) → home action (1500ms)
- S2: "Then clicking about." (2000-4000ms) → about action (3000ms)
- S3: "Finally clicking contact." (4000-6000ms) → contact action (4500ms)

**Output:**
```
Clicking home. [action:home:click] Then clicking about. [action:about:click] 
Finally clicking contact. [action:contact:click]
```

### No Voice

**Input:** `Voice: []`, `Actions: [navigate, click, fill]`

**Output:** `[action:nav:navigate] [action:btn:click] [action:inp:fill]`

---

## Configuration

### Time Windows

Configurable in [`electron/settings/store.ts`](../electron/settings/store.ts):

```typescript
interface VoiceDistributionSettings {
  lookbackMs: number        // Default: 4000
  lookaheadMs: number       // Default: 2000
  longSegmentThresholdMs: number  // Default: 2000
}
```

Update via:
```typescript
import { updateTimeWindows } from './electron/utils/voiceDistribution'
updateTimeWindows({ lookbackMs: 3000, lookaheadMs: 1000, longSegmentThresholdMs: 1500 })
```

### Sentence Splitting

Hard-coded delimiters: `.`, `!`, `?`

---

## Performance

**Transcription speed:**
- small.en: ~2-3x real-time

**Memory:**
- Idle: ~200 MB
- Recording: +100 MB
- Transcribing: +1.0 GB (model loaded)
- Peak: ~1.5 GB

**Time complexity:** O(s × a) where s = sentences, a = actions (efficient for typical sessions)

---

## Troubleshooting

### Hallucinations (Silent Recording)

**Symptoms:** Strange text when mic enabled but no speech.

**Solution:** ✅ Automatic filtering (production-ready)
- Removes prompt text matches
- Removes repetitive phrases (2+ occurrences)
- Logs filtered content for debugging

**Verification in logs:**
```
🔍 Detected repetitive text (2x): "..."
❌ Filtered out prompt hallucination: "..."
✅ Valid segments after filtering: 0
```

### Missing Early Speech

**Causes & solutions:**
- Entropy threshold too high → Lowered to 2.0
- No silence padding → Added 1.5s padding
- Using wrapper → Switched to direct CLI calls

### Poor Technical Term Recognition

**Solutions:**
- Upgraded model (base.en → small.en)
- Added prompt: `"Recording session with browser interactions, clicking, navigation, LinkedIn, GitHub..."`

### No Transcription Output

**Check:**
1. Model exists: `models/ggml-small.en.bin`
2. Binary exists: `models/win/whisper-cli.exe` or `models/unix/whisper`
3. FFmpeg working (check logs)
4. Microphone permissions granted
5. Audio chunks recorded (console logs)

### Actions Misaligned with Voice

**Solutions:**
- Adjust time windows in [`voiceDistribution.ts`](../electron/utils/voiceDistribution.ts)
- Check timestamp synchronization
- Verify 1500ms offset correct

---

## Privacy & Security

- 100% local processing (no cloud services)
- No API keys required
- Audio deleted after transcription (only text kept)
- No telemetry

---

## Implementation Files

- **Transcription:** [`electron/audio/transcriber.ts`](../electron/audio/transcriber.ts)
- **Voice Distribution:** [`electron/utils/voiceDistribution.ts`](../electron/utils/voiceDistribution.ts)
- **Transcript Generation:** [`electron/utils/enhancedTranscript.ts`](../electron/utils/enhancedTranscript.ts)
- **IPC Handlers:** [`electron/ipc/recording.ts`](../electron/ipc/recording.ts)
- **Session Writer:** [`electron/session/writer.ts`](../electron/session/writer.ts)

**Type definitions ([`shared/types.ts`](../shared/types.ts)):**
```typescript
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
