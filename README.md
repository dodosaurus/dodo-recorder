# Dodo Recorder

A desktop application for recording browser interactions and voice commentary, producing session bundles for AI-assisted Playwright test generation.

## Features

- **Browser Recording**: Launch and record interactions in a controlled Chromium browser
- **Rich Locator Extraction**: Captures multiple selector strategies (testId, role, text, CSS, XPath)
- **Voice Transcription**: Local speech-to-text using Whisper.cpp with optimized early speech detection
- **Screenshot Capture**: Manual screenshot capture via keyboard shortcut (F9)
- **Enhanced Transcripts**: AI-friendly narrative format with embedded action IDs
- **Smart Voice Distribution**: Intelligently associates voice commentary with browser actions
- **Session Export**: Generates structured JSON bundles ready for AI consumption

## Voice Transcription

Dodo Recorder uses OpenAI's Whisper model (running locally via whisper.cpp) to transcribe voice commentary. The system is optimized for:
- **Early speech detection**: Captures speech from the very beginning of recordings
- **Technical term recognition**: Properly recognizes terms like "LinkedIn", "GitHub", "browser"
- **Privacy**: 100% local processing, no cloud services
- **Quality**: Uses `small.en` model by default for better accuracy

For detailed information about the voice transcription system, see [`docs/voice-transcription.md`](docs/voice-transcription.md).

## Keyboard Shortcuts

During browser recording, use these keyboard shortcuts to control your session:

| Shortcut | Action | Description |
|----------|--------|-------------|
| **Alt + Click** (Windows/Linux)<br>**⌥ Option + Click** (Mac) | **Assertion Mode** | Records an assertion instead of a click. Use this to verify element presence without triggering the click action. |
| **Cmd + Click** (Mac)<br>**Ctrl + Click** (Windows/Linux) | **Assertion Mode** | Alternative shortcut for assertion mode. |
| **F9** | **Take Screenshot** | Captures a screenshot of the current browser state. The screenshot is saved to the session's `screenshots/` folder and referenced in the enhanced transcript. |

### Usage Examples

**Recording Assertions:**
```
1. Hold Alt/Option or Cmd/Ctrl
2. Click on an element
3. Element is recorded as "assert" type (not clicked)
4. Release modifier key
```

**Capturing Screenshots:**
```
1. Press F9 at any point during recording
2. Screenshot is captured with timestamp
3. Reference appears in enhanced transcript as [screenshot:screenshot-TIMESTAMP.png]
```

**Typical Workflow:**
```
1. Click normally to interact with the page
2. Alt+Click on elements you want to verify (assertions)
3. Press F9 to capture important visual states
4. Speak your commentary to explain what you're testing
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- macOS/Linux: `make` and C++ compiler (Xcode CLI tools or build-essential)
- Windows: [Install make](https://gnuwin32.sourceforge.net/packages/make.htm)

### Installation

1. **Install dependencies and compile whisper.cpp:**
   ```bash
   npm install
   ```
   This automatically compiles whisper.cpp via the postinstall script.

2. **Download the Whisper model:**
   ```bash
   npm run whisper:download
   ```
   
   This downloads `ggml-small.en.bin` (466 MB, recommended for better quality).
   
   **Alternative models:**
   - For faster/smaller model: `npm run whisper:download:base` (downloads base.en, 142 MB)
   - For manual download: Get models from [HuggingFace](https://huggingface.co/ggerganov/whisper.cpp/tree/main) and place in:
     ```
     node_modules/whisper-node/lib/whisper.cpp/models/
     ```

3. **Verify Whisper setup:**
   ```bash
   npm run whisper:test
   ```

### Whisper Model Setup

The app uses Whisper models from `node_modules/whisper-node/lib/whisper.cpp/models/`. The default model is **small.en** for better transcription quality.

**Available models:**

| Model     | Size   | RAM     | Quality | Speed | Use Case |
|-----------|--------|---------|---------|-------|----------|
| tiny.en   |  75 MB | ~390 MB | Basic   | Fastest | Quick tests, may miss words |
| base.en   | 142 MB | ~500 MB | Good    | Fast | Previous default, good balance |
| **small.en** | **466 MB** | **~1.0 GB** | **Better** | **Medium** | **Current default** ✓ |
| medium.en | 1.5 GB | ~2.6 GB | Best    | Slower | Maximum accuracy |

**Why small.en?**
- Better at capturing speech at the beginning of recordings
- Improved recognition of technical terms (LinkedIn, GitHub, etc.)
- Fewer transcription errors overall
- Still fast enough for real-time use

**Changing models:**

To use a different model, download it and update settings in the app UI, or manually edit:
```
~/Library/Application Support/dodo-recorder/settings.json  # macOS
%APPDATA%/dodo-recorder/settings.json                      # Windows
~/.config/dodo-recorder/settings.json                      # Linux
```

Change `whisper.modelName` to: `"tiny.en"`, `"base.en"`, `"small.en"`, or `"medium.en"`

### Troubleshooting

**App still using old model (base.en) after upgrade:**

If you upgraded from an older version and the app is still trying to use `base.en`, delete your settings file to reset to the new defaults:

```bash
# macOS
rm ~/Library/Application\ Support/dodo-recorder/settings.json

# Windows
del %APPDATA%\dodo-recorder\settings.json

# Linux
rm ~/.config/dodo-recorder/settings.json
```

Then restart the app. It will create a new settings file with `small.en` as the default.

**Model not found error:**

If you see "Whisper model not found" errors, verify the model file exists:
```bash
ls -lh node_modules/whisper-node/lib/whisper.cpp/models/
```

You should see `ggml-small.en.bin` (465 MB). If not, run `npm run whisper:download`.

### Development

```bash
npm run dev
```

### Build

```bash
npm run electron:build
```

## Session Output Format

Each recording session produces a folder with:

```
session-YYYY-MM-DD-HHMMSS/
├── actions.json                # All recorded browser interactions with locator info + voice segments
├── timeline.json               # Unified timeline merging actions + voice segments
├── transcript.json             # Voice commentary transcription (structured segments)
├── transcript.txt              # Full transcript in readable format with timestamps
├── transcript-enhanced.txt     # Enhanced narrative with embedded action IDs
├── transcript-detailed.md      # Detailed transcript with action reference table
├── metadata.json               # Session info (URL, duration, timestamps)
├── notes.md                    # Optional user notes
└── screenshots/                # Screenshots captured during session
    ├── screenshot-14227.png
    ├── screenshot-21725.png
    └── ...
```

### actions.json Structure

```json
{
  "actions": [
    {
      "id": "uuid",
      "timestamp": 1234,
      "type": "click",
      "target": {
        "selector": "button:has-text('Submit')",
        "role": "button",
        "name": "Submit",
        "testId": "submit-btn",
        "xpath": "//button[@data-testid='submit-btn']"
      },
      "url": "https://example.com",
      "voiceSegments": [
        {
          "id": "t1",
          "startTime": 1200,
          "endTime": 3400,
          "text": "Now I'm going to click the submit button to send the form"
        }
      ]
    }
  ]
}
```

### Voice Segment Distribution

The app uses a sophisticated algorithm to distribute voice commentary across actions:

- **Pre-action capture**: Voice spoken before the first action is preserved and attached to it
- **Temporal proximity**: Segments are assigned based on time windows (10s lookback, 5s lookahead)
- **Overlap handling**: Long segments spanning multiple actions are intelligently distributed
- **Context preservation**: Maintains natural speech flow for AI interpretation

This ensures that LLMs processing the session have proper context about what the user was thinking/doing at each step.


## Tech Stack

- **Electron** - Cross-platform desktop framework
- **React** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Playwright** - Browser automation
- **Whisper.cpp** - Local voice transcription (via whisper-node)
- **Zustand** - State management

## License

MIT
