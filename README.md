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

### Installation

```bash
npm install
```

### Development

```bash
npm run electron:dev
```

### Build

```bash
npm run electron:build
```

## Whisper Model Setup

For voice transcription, download the Whisper model:

1. Download `ggml-base.en.bin` from [Hugging Face](https://huggingface.co/ggerganov/whisper.cpp/tree/main)
2. Place it in the app's data folder:
   - **macOS**: `~/Library/Application Support/dodo-recorder/models/`
   - **Windows**: `%APPDATA%/dodo-recorder/models/`
   - **Linux**: `~/.config/dodo-recorder/models/`

## Session Output Format

Each recording session produces a folder with:

```
session-YYYY-MM-DD-HHMMSS/
├── actions.json      # All recorded browser interactions with locator info
├── timeline.json     # Unified timeline merging actions + voice segments
├── transcript.json   # Voice commentary transcription
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
      "url": "https://example.com"
    }
  ]
}
```

## Tech Stack

- **Electron** - Cross-platform desktop framework
- **React** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Playwright** - Browser automation
- **Whisper.cpp** - Local voice transcription
- **Zustand** - State management

## License

MIT

