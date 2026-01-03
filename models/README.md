# Whisper Models

This folder is for reference only. The actual models should be placed in:
`node_modules/whisper-node/lib/whisper.cpp/models/`

## Setup Instructions

1. **Compile whisper.cpp** (required once after npm install):
   ```bash
   cd node_modules/whisper-node/lib/whisper.cpp
   make
   ```

2. **Download a model** from [HuggingFace ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp/tree/main):

   | Model     | Disk   | RAM     | Quality    |
   |-----------|--------|---------|------------|
   | tiny.en   |  75 MB | ~390 MB | Fast, basic|
   | base.en   | 142 MB | ~500 MB | Good balance ✓ |
   | small.en  | 466 MB | ~1.0 GB | Better quality |
   | medium.en | 1.5 GB | ~2.6 GB | High quality |

3. **Place the model** in the whisper.cpp models folder:
   ```bash
   cp ggml-base.en.bin node_modules/whisper-node/lib/whisper.cpp/models/
   ```

## Note on .en Models

We use English-only models (`.en` suffix) because:
- They're optimized for English speech
- Faster transcription
- Better accuracy for English content

The app is configured to use `base.en` by default.
