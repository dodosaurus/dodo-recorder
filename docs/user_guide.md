# User Guide

## Features

- **Browser Recording:** Chromium browser automation via Playwright
- **Pause/Resume:** Pause and resume recording from app or browser widget
- **Rich Locator Extraction:** testId, role, text, CSS, XPath with confidence levels
- **Voice Transcription:** Local Whisper.cpp with optimized early speech detection
- **Screenshot Capture:** Cmd+Shift+S (Mac) / Ctrl+Shift+S (Windows) or widget button
- **Recording Widget:** Floating browser widget with pause/resume, screenshots, and assertion mode
- **Assertion Mode:** Cmd+Click (Mac) / Ctrl+Click (Windows) or widget button
- **Enhanced Transcripts:** AI-friendly narrative with embedded action references
- **Smart Voice Distribution:** 4s lookback, 2s lookahead temporal association
- **Session Export:** Framework-agnostic JSON bundles (INSTRUCTIONS.md + actions.json + screenshots/)

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Cmd+Click** (Mac) / **Ctrl+Click** (Windows) | Record assertion (not click) |
| **Cmd+Shift+S** (Mac) / **Ctrl+Shift+S** (Windows) | Take screenshot |

---

## Recording Widget

Floating widget in browser (top-right by default, draggable):

**Pause/Resume button:** Pause or resume recording (pause icon ⏸ or play icon ▶)
**Screenshot button:** Capture screenshot (camera icon, disabled while paused)
**Assertion button:** Toggle assertion mode (eye icon, turns blue when active, disabled while paused)
**Voice indicator:** Red pulsing dot when voice recording active (hidden while paused)

**While paused:**
- All action recording is stopped (clicks, inputs, navigation, etc.)
- Screenshot and assertion buttons are disabled
- Elapsed time freezes
- Audio recording is paused

---

## Session Output

```
session-YYYY-MM-DD-HHMMSS/
├── INSTRUCTIONS.md    # Reusable AI instructions (framework-agnostic)
├── actions.json       # _meta + narrative + actions
└── screenshots/       # PNG files
```

### actions.json Structure

```json
{
  "_meta": {
    "formatVersion": "2.0",
    "sessionId": "session-2026-01-23-102150",
    "startTime": 1737628910000,
    "startTimeISO": "2026-01-23T10:21:50.000Z",
    "duration": "8s",
    "startUrl": "https://example.com",
    "totalActions": 10,
    "actionTypes": { "click": 3, "fill": 2, "assert": 4, "navigate": 1 }
  },
  "narrative": {
    "text": "Voice commentary [action:e6c3069a:click] more text...",
    "note": "Match SHORT_ID (first 8 chars) with action.id in actions array."
  },
  "actions": [
    {
      "id": "e6c3069a-1b2c-4d5e-6f7g-8h9i0j1k2l3m",
      "timestamp": 1234,
      "type": "click",
      "target": {
        "selector": "button:has-text('Submit')",
        "locators": [
          { "strategy": "testId", "value": "submit-btn", "confidence": "high" },
          { "strategy": "text", "value": "Submit", "confidence": "high" }
        ],
        "role": "button",
        "name": "Submit",
        "testId": "submit-btn"
      }
    }
  ]
}
```

---

## AI Usage

**AI workflow:**
1. Read INSTRUCTIONS.md once (framework detection, locator strategies, code patterns)
2. Process actions.json (metadata, narrative, actions)
3. Parse action references: `[action:SHORT_ID:TYPE]` → match with full UUID in actions array
4. Choose locators by confidence (high > medium > low)
5. Generate framework-specific test code

**Supported frameworks:** Playwright, Cypress, Selenium, Puppeteer, any framework

---

## References

- **Output Format:** [`output_format.md`](output_format.md) - Detailed bundle specification
- **Voice Transcription:** [`voice_transcription.md`](voice_transcription.md) - Transcription pipeline
- **Application UI:** [`application_ui.md`](application_ui.md) - UI components and workflows
