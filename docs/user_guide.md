# Dodo Recorder - User Guide

## Features

- **Browser Recording**: Launch and record interactions in a controlled Chromium browser
- **Rich Locator Extraction**: Captures multiple selector strategies (testId, role, text, CSS, XPath)
- **Voice Transcription**: Local speech-to-text using Whisper.cpp with optimized early speech detection
- **Screenshot Capture**: Manual screenshot capture via keyboard shortcut (Cmd+Shift+S / Ctrl+Shift+S)
- **Enhanced Transcripts**: AI-friendly narrative format with embedded action IDs
- **Smart Voice Distribution**: Intelligently associates voice commentary with browser actions
- **Session Export**: Generates structured JSON bundles ready for AI consumption

## Keyboard Shortcuts

During browser recording, use these keyboard shortcuts to control your session:

| Shortcut | Action | Description |
|----------|--------|-------------|
| **Alt + Click** (Windows/Linux)<br>**⌥ Option + Click** (Mac) | **Assertion Mode** | Records an assertion instead of a click. Use this to verify element presence without triggering the click action. |
| **Cmd + Click** (Mac)<br>**Ctrl + Click** (Windows/Linux) | **Assertion Mode** | Alternative shortcut for assertion mode. |
| **Cmd+Shift+S** (Mac)<br>**Ctrl+Shift+S** (Windows/Linux) | **Take Screenshot** | Captures a screenshot of the current browser state. The screenshot is saved to the session's `screenshots/` folder and referenced in the enhanced transcript. |

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
1. Press Cmd+Shift+S (Mac) or Ctrl+Shift+S (Windows/Linux) at any point during recording
2. Screenshot is captured with timestamp
3. Reference appears in enhanced transcript as [screenshot:screenshot-TIMESTAMP.png]
```

**Typical Workflow:**
```
1. Click normally to interact with the page
2. Alt+Click on elements you want to verify (assertions)
3. Press Cmd+Shift+S (Mac) or Ctrl+Shift+S (Windows/Linux) to capture important visual states
4. Speak your commentary to explain what you're testing
```

## Session Output Format

Each recording session produces a streamlined folder with three essential components:

```
session-YYYY-MM-DD-HHMMSS/
├── actions.json                # All recorded browser interactions (clean, no voice data)
├── transcript.txt              # Voice commentary with embedded action/screenshot references
└── screenshots/                # Screenshots captured during session
    ├── screenshot-14227.png
    ├── screenshot-21725.png
    └── ...
```

### File Details

**actions.json** - Contains all recorded actions with unique IDs:
```json
{
  "actions": [
    {
      "id": "e6c3069a-1b2c-4d5e-6f7g-8h9i0j1k2l3m",
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
      "screenshot": "screenshot-14227.png"
    }
  ]
}
```

**transcript.txt** - Narrative transcript optimized for LLM and human consumption:
- Natural voice transcription flow
- Embedded action references: `[action:e6c3069a:click]`
- Embedded screenshot references for screenshot actions: `[screenshot:screenshot-14227.png]`
- ALL actions are referenced in the narrative
- Includes an action reference table at the end

This format is designed for:
1. **LLM consumption**: Easy parsing to generate Playwright tests
2. **Human readability**: Test automation engineers can quickly understand the session
3. **Complete coverage**: Every action is documented
