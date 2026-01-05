# Dodo Recorder

A desktop application for recording browser interactions and voice commentary, producing session bundles for AI-assisted Playwright test generation.

## Features

- **Browser Recording**: Launch and record interactions in a controlled Chromium browser
- **Rich Locator Extraction**: Captures multiple selector strategies (testId, role, text, CSS, XPath)
- **Voice Commentary**: Record and transcribe voice notes using local Whisper model
- **Live Actions Widget**: View and manage recorded actions in real-time
- **Session Export**: Generates structured JSON bundles ready for AI consumption

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- macOS/Linux: `make` and C++ compiler (Xcode CLI tools or build-essential)
- Windows: [Install make](https://gnuwin32.sourceforge.net/packages/make.htm)

### Installation

```bash
npm install
```

This will automatically compile whisper.cpp. Then download the Whisper model:

```bash
npm run whisper:download
```

Or manually download `ggml-base.en.bin` from [HuggingFace](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin) and place it in:
```
node_modules/whisper-node/lib/whisper.cpp/models/
```

### Verify Whisper Setup

```bash
npm run whisper:test
```

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
├── actions.json      # All recorded browser interactions with locator info + voice segments
├── timeline.json     # Unified timeline merging actions + voice segments
├── transcript.json   # Voice commentary transcription (structured segments)
├── transcript.txt    # Full transcript in readable format with timestamps
├── metadata.json     # Session info (URL, duration, timestamps)
└── notes.md          # Optional user notes
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

## Available Whisper Models

| Model     | Disk   | RAM     | Quality |
|-----------|--------|---------|---------|
| tiny.en   |  75 MB | ~390 MB | Fast, basic |
| base.en   | 142 MB | ~500 MB | Good balance (default) |
| small.en  | 466 MB | ~1.0 GB | Better quality |
| medium.en | 1.5 GB | ~2.6 GB | High quality |

Download from: https://huggingface.co/ggerganov/whisper.cpp/tree/main

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
