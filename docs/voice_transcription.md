# Voice Transcription System

## Overview

Dodo Recorder uses OpenAI's Whisper model (via whisper.cpp) to transcribe voice commentary during browser recording sessions. The transcription runs locally for privacy and produces timestamped segments that are intelligently distributed across recorded actions.

## How It Works

### 1. Audio Capture
- Uses Web Audio API via `MediaRecorder` in the renderer process
- Records in WebM format with Opus codec at 16kHz (Whisper's native sample rate)
- Audio chunks collected every second during recording
- Synchronized with browser action timestamps using a shared `startTime` reference

### 2. Audio Processing Pipeline

When recording stops, the audio goes through this pipeline:

```
WebM Audio Buffer
    ↓
FFmpeg Conversion (16kHz mono WAV + 1.5s silence padding)
    ↓
Whisper.cpp Transcription (direct CLI call with optimized parameters)
    ↓
JSON Output Parsing
    ↓
Timestamp Offset Correction (-1500ms to account for padding)
    ↓
Timestamped Transcript Segments
```

### 3. Voice Distribution Algorithm

Transcript segments are intelligently associated with browser actions:
- **Lookback window**: 10 seconds before each action
- **Lookahead window**: 5 seconds after each action
- **Overlap handling**: Long commentary spanning multiple actions is distributed appropriately
- **Pre-action capture**: Speech before the first action is preserved

## Key Implementation Details

### Direct Whisper.cpp Integration

**Problem Solved**: The `whisper-node` npm package only supports 6 parameters and silently ignores all others (like `beam_size`, `entropy_threshold`, etc.). This was causing poor transcription quality.

**Solution**: We bypass whisper-node and call whisper.cpp directly with full parameter control:

```typescript
// Direct command execution with all parameters
const command = [
  whisperMainPath,
  '-m', modelPath,
  '-f', audioPath,
  '-l', 'en',
  '-oj',              // Output JSON
  '-ml', '0',         // No max length
  '-sow',             // Split on word boundaries
  '-bo', '5',         // Best of 5 candidates
  '-bs', '5',         // Beam size 5
  '-et', '2.0',       // Entropy threshold (critical for early detection)
  '-lpt', '-1.0',     // Log probability threshold
  '--prompt', '"..."' // Context priming
].join(' ')
```

### Silence Padding Technique

**Why**: Whisper's Voice Activity Detection (VAD) tends to miss the first few seconds of audio, especially when speech starts immediately.

**Solution**: Add 1.5 seconds of silence at the beginning using FFmpeg filters:

```typescript
.audioFilters([
  'apad=pad_dur=1.5',  // Add padding at end
  'areverse',           // Reverse audio
  'apad=pad_dur=1.5',  // Add padding (now at beginning after reverse)
  'areverse'            // Reverse back to original
])
```

Then subtract 1500ms from all Whisper timestamps to realign with actual recording timeline.

### Critical Whisper Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `-et` (entropy_threshold) | `2.0` | **Most important** - Lower value = more aggressive speech detection at beginning |
| `-bo` (best_of) | `5` | Use best of 5 beam search candidates |
| `-bs` (beam_size) | `5` | Beam search width for better accuracy |
| `-ml` (max_len) | `0` | No length limit on segments |
| `-sow` (split_on_word) | flag | Split on word boundaries, not tokens |
| `--prompt` | context string | Prime model with expected vocabulary |

## Whisper Model Selection

### Default: small.en (Recommended)

```bash
npm run whisper:download  # Downloads small.en (466 MB)
```

**Characteristics:**
- Size: 466 MB disk, ~1.0 GB RAM
- Quality: Better accuracy, especially for technical terms
- Speed: Medium (acceptable for real-time use)
- **Best for**: Production use, captures early speech reliably

### Alternative Models

| Model | Size | RAM | Quality | Speed | Use Case |
|-------|------|-----|---------|-------|----------|
| tiny.en | 75 MB | ~390 MB | Basic | Fastest | Quick tests only |
| base.en | 142 MB | ~500 MB | Good | Fast | Previous default |
| **small.en** | **466 MB** | **~1.0 GB** | **Better** | **Medium** | **Current default** ✓ |
| medium.en | 1.5 GB | ~2.6 GB | Best | Slower | Maximum accuracy needed |

### Changing Models

Update in settings file or app UI:
```json
{
  "whisper": {
    "modelName": "small.en"
  }
}
```

## Output Formats

### 1. transcript.json (Structured)
```json
{
  "segments": [
    {
      "id": "t1",
      "startTime": 1200,
      "endTime": 3400,
      "text": "Now I'm clicking the submit button"
    }
  ]
}
```

### 2. transcript.txt (Human-Readable)
```
# Voice Commentary Transcript

[00:01] Now I'm clicking the submit button
[00:05] Verifying the form was submitted successfully
```

### 3. transcript-enhanced.txt (LLM-Optimized)
```
Now I'm clicking the submit button [action:c5922be3:click] and verifying 
the form was submitted [action:72e42724:assert] successfully.
```

### 4. transcript-detailed.md (Comprehensive)
Includes narrative + action reference table for easy lookup.

## Troubleshooting

### Issue: Missing Beginning of Recording

**Symptoms**: First 5-15 seconds of speech not transcribed

**Causes & Solutions**:
1. **Entropy threshold too high** → Lowered to 2.0 (from default 2.4)
2. **No silence padding** → Added 1.5s padding before audio
3. **Using whisper-node wrapper** → Switched to direct whisper.cpp calls

### Issue: Poor Recognition of Technical Terms

**Symptoms**: "LinkedIn" transcribed as "link a theme", "GitHub" as "get hub"

**Solutions**:
1. **Upgraded model** → Changed from base.en to small.en
2. **Added initial prompt** → Primes model with expected vocabulary:
   ```
   "This is a recording session with browser interactions, clicking, 
   navigation, menu items, LinkedIn, GitHub, scrolling."
   ```

### Issue: Transcription Takes Too Long

**Solutions**:
1. Use smaller model (base.en or tiny.en)
2. Reduce audio quality (already optimized at 16kHz mono)
3. Check CPU usage - Whisper is CPU-intensive

### Issue: No Transcription Output

**Check**:
1. Model file exists: `node_modules/whisper-node/lib/whisper.cpp/models/ggml-small.en.bin`
2. FFmpeg is working: Check logs for conversion errors
3. Microphone permissions granted
4. Audio chunks were recorded (check console logs)

## Performance Characteristics

### Transcription Speed
- **small.en**: ~2-3x real-time (10 second audio → 3-5 seconds to transcribe)
- **base.en**: ~1-2x real-time
- **medium.en**: ~4-6x real-time

### Memory Usage
- **Idle**: ~200 MB
- **Recording**: +100 MB (audio buffering)
- **Transcribing (small.en)**: +1.0 GB (model loaded)
- **Peak**: ~1.5 GB total

### Disk Space
- Model: 466 MB (small.en)
- Per session: ~100-500 KB audio (depends on duration)
- Temporary files: Cleaned up automatically

## Architecture

### File Structure
```
electron/audio/
├── transcriber.ts          # Main transcription logic
electron/utils/
├── voiceDistribution.ts    # Algorithm for associating voice with actions
├── enhancedTranscript.ts   # Enhanced transcript generation
src/components/
├── RecordingControls.tsx   # Audio capture in renderer
```

### Key Classes

**Transcriber** (`electron/audio/transcriber.ts`)
- Initializes Whisper model
- Converts audio formats (WebM → WAV)
- Executes whisper.cpp with optimized parameters
- Parses JSON output and adjusts timestamps

**Voice Distribution** (`electron/utils/voiceDistribution.ts`)
- Temporal proximity algorithm
- Handles overlapping segments
- Preserves pre-action commentary

## Privacy & Security

- **100% Local Processing**: No audio sent to cloud services
- **No API Keys Required**: Whisper runs entirely on your machine
- **Offline Capable**: Works without internet connection
- **Data Retention**: Audio files deleted after transcription (only text kept)

## Future Enhancements

Potential improvements:
1. **Real-time transcription**: Stream transcription during recording
2. **Speaker diarization**: Identify multiple speakers
3. **Custom vocabulary**: User-defined technical terms
4. **Multi-language support**: Beyond English
5. **GPU acceleration**: Faster transcription with CUDA/Metal
6. **Confidence scores**: Show transcription confidence per segment

## References

- [Whisper.cpp GitHub](https://github.com/ggerganov/whisper.cpp)
- [OpenAI Whisper Paper](https://arxiv.org/abs/2212.04356)
- [Whisper Model Cards](https://github.com/openai/whisper/blob/main/model-card.md)
- [GGML Format Documentation](https://github.com/ggerganov/ggml)

## Files Modified

- [`electron/audio/transcriber.ts`](../electron/audio/transcriber.ts) - Core transcription with direct whisper.cpp calls
- [`electron/utils/voiceDistribution.ts`](../electron/utils/voiceDistribution.ts) - Voice-to-action association
- [`src/components/RecordingControls.tsx`](../src/components/RecordingControls.tsx) - Audio capture
