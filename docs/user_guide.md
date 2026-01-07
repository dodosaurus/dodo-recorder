# Dodo Recorder - User Guide

## Features

- **Browser Recording**: Launch and record interactions in a controlled Chromium browser
- **Rich Locator Extraction**: Captures multiple selector strategies (testId, role, text, CSS, XPath)
- **Voice Transcription**: Local speech-to-text using Whisper.cpp with optimized early speech detection
- **Screenshot Capture**: Manual screenshot capture via keyboard shortcut (F9)
- **Enhanced Transcripts**: AI-friendly narrative format with embedded action IDs
- **Smart Voice Distribution**: Intelligently associates voice commentary with browser actions
- **Session Export**: Generates structured JSON bundles ready for AI consumption

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

## Voice Transcription Settings

Dodo Recorder uses OpenAI's Whisper model (running locally via whisper.cpp).

### Available Models

| Model     | Size   | RAM     | Quality | Speed | Use Case |
|-----------|--------|---------|---------|-------|----------|
| tiny.en   |  75 MB | ~390 MB | Basic   | Fastest | Quick tests, may miss words |
| base.en   | 142 MB | ~500 MB | Good    | Fast | Previous default, good balance |
| **small.en** | **466 MB** | **~1.0 GB** | **Better** | **Medium** | **Current default** ✓ |
| medium.en | 1.5 GB | ~2.6 GB | Best    | Slower | Maximum accuracy |

### Changing Models

To use a different model, download it and update settings in the app UI, or manually edit:
```
~/Library/Application Support/dodo-recorder/settings.json  # macOS
%APPDATA%/dodo-recorder/settings.json                      # Windows
~/.config/dodo-recorder/settings.json                      # Linux
```

Change `whisper.modelName` to: `"tiny.en"`, `"base.en"`, `"small.en"`, or `"medium.en"`
