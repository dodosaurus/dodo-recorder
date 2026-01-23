# Dodo Recorder - User Guide

## Features

- **Browser Recording**: Launch and record interactions in a controlled Chromium browser
- **Rich Locator Extraction**: Captures multiple selector strategies (testId, role, text, CSS, XPath)
- **Voice Transcription**: Local speech-to-text using Whisper.cpp with optimized early speech detection
- **Screenshot Capture**: Manual screenshot capture via keyboard shortcut (Cmd+Shift+S / Ctrl+Shift+S) or widget button
- **Recording Widget**: Floating UI widget in the browser for quick access to recording controls
- **Enhanced Transcripts**: AI-friendly narrative format with embedded action IDs
- **Smart Voice Distribution**: Intelligently associates voice commentary with browser actions
- **Session Export**: Generates structured JSON bundles ready for AI consumption

## Recording Widget

When you start a recording session, a floating widget appears in the browser window (top-right corner by default). This widget provides quick access to recording controls:

### Widget Features

**Screenshot Button**
- Click to capture a screenshot of the current browser state
- Same as pressing Cmd+Shift+S (Mac) or Ctrl+Shift+S (Windows/Linux)
- Shows visual feedback when screenshot is captured

**Assertion Mode Toggle**
- Click to enable/disable assertion mode
- When active (highlighted in blue), all clicks become assertions
- Alternative to holding Cmd (macOS) or Ctrl (Windows/Linux) while clicking
- Click again to return to normal clicking mode

## Keyboard Shortcuts

During browser recording, use these keyboard shortcuts to control your session:

| Shortcut | Action | Description |
|----------|--------|-------------|
| **Cmd + Click** (Mac)<br>**Ctrl + Click** (Windows/Linux) | **Assertion Mode** | Records an assertion instead of a click. Use this to verify element presence without triggering the click action. |
| **Cmd+Shift+S** (Mac)<br>**Ctrl+Shift+S** (Windows/Linux) | **Take Screenshot** | Captures a screenshot of the current browser state. The screenshot is saved to the session's `screenshots/` folder and referenced in the enhanced transcript. |

### Usage Examples

**Recording Assertions:**
```
1. Hold Cmd (Mac) or Ctrl (Windows/Linux)
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
1. Use the recording widget or click normally to interact with the page
2. Click the button in widget to enable assertion mode, or use Cmd+Click (Mac) / Ctrl+Click (Windows/Linux) on elements you want to verify
3. Click the button in widget or press Cmd+Shift+S (Mac) / Ctrl+Shift+S (Windows/Linux) to capture screenshots
4. Speak your commentary to explain what you're testing
```

## Session Output Format

Each recording session produces a compact, framework-agnostic folder with three essential components:

```
session-YYYY-MM-DD-HHMMSS/
├── INSTRUCTIONS.md             # General AI instructions (reusable)
├── actions.json                # Complete session data (all-in-one)
└── screenshots/                # Screenshots captured during session
    ├── screenshot-14227.png
    ├── screenshot-21725.png
    └── ...
```

### File Details

**INSTRUCTIONS.md** - Framework-agnostic and framework-specific instructions:
- Reusable across all recording sessions
- How to process session bundles (parsing, locators, action types)
- Framework detection logic (Playwright, Cypress)
- Framework-specific implementation guides with code examples
- Best practices for test generation
- Written once per output directory, not per session

**actions.json** - All session data in one file with three main sections:
```json
{
  "_meta": {
    "formatVersion": "2.0",
    "generatedBy": "Dodo Recorder",
    "sessionId": "session-2026-01-23-102150",
    "startTime": 1737628910000,
    "startTimeISO": "2026-01-23T10:21:50.000Z",
    "duration": "8s",
    "startUrl": "https://example.com",
    "totalActions": 10,
    "actionTypes": {
      "click": 3,
      "fill": 2,
      "assert": 4,
      "navigate": 1
    }
  },
  "narrative": {
    "text": "This is my test... [action:e6c3069a:click] clicking the button...",
    "note": "Voice commentary with embedded action references. Match SHORT_ID (first 8 chars) with action.id in actions array."
  },
  "actions": [
    {
      "id": "e6c3069a-1b2c-4d5e-6f7g-8h9i0j1k2l3m",
      "timestamp": 1234,
      "type": "click",
      "target": {
        "selector": "button:has-text('Submit')",
        "locators": [
          {
            "strategy": "testId",
            "value": "submit-btn",
            "confidence": "high"
          },
          {
            "strategy": "text",
            "value": "Submit",
            "confidence": "high"
          }
        ],
        "role": "button",
        "name": "Submit",
        "testId": "submit-btn"
      }
    }
  ]
}
```

**screenshots/** - Visual captures referenced in actions array

### Format Benefits

This format provides:
1. **Token Efficiency**: Fewer tokens per session (INSTRUCTIONS.md is reused)
2. **Single Source**: All session data in one JSON file
3. **Framework Detection**: Automatic Playwright/Cypress project identification
4. **AI-Ready**: Complete instructions embedded, no external documentation needed
5. **Human Readable**: Clear structure that engineers can quickly understand
6. **Framework-Agnostic**: Works with Playwright, Cypress, Selenium, Puppeteer, any framework

### How AI Agents Use This

1. **Read INSTRUCTIONS.md once** - Get complete parsing and implementation guidance
2. **Process actions.json** - Extract metadata, narrative, and action data
3. **Parse action references** - Match `[action:SHORT_ID:TYPE]` with full action data
4. **Choose locators** - Use confidence levels (high > medium > low) to select best selectors
5. **Generate tests** - Create framework-specific test code with proper structure and assertions
