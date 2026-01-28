# Session Output Format

Framework-agnostic session bundles optimized for AI-assisted test generation.

---

## Bundle Structure

```
session-YYYY-MM-DD-HHMMSS/
├── INSTRUCTIONS.md    # Reusable AI instructions (framework-agnostic)
├── actions.json       # Session data: _meta + narrative + actions
└── screenshots/       # PNG files (screenshot-{timestamp}.png)
```

**Key characteristics:**
- **Compact:** Only 3 essential components
- **Single source:** All session data in actions.json
- **Reusable instructions:** INSTRUCTIONS.md shared across all sessions
- **Framework-agnostic:** Playwright, Cypress, Selenium, Puppeteer, etc.
- **Token-optimized:** Efficient for LLM processing

---

## File Specifications

### 1. INSTRUCTIONS.md

**Format:** Markdown  
**Size:** ~150 lines (~2,000 tokens)  
**Reusability:** ✅ Shared across all sessions in same output directory

**Content:**
1. Overview - What are session bundles, framework-agnostic nature
2. Bundle structure - Files and purposes
3. Processing instructions:
   - Read actions.json
   - Parse action references (`[action:SHORT_ID:TYPE]`)
   - Choose locator strategies (confidence-based)
   - Interpret action types
   - Use voice commentary
4. Framework-specific implementation:
   - Detecting framework (Playwright/Cypress)
   - Playwright guide (structure, locators, best practices)
   - Cypress guide (structure, locators, best practices)
   - Empty repository handling
5. Format version

**Purpose:** Reusable instructions AI reads once, applies to all subsequent sessions.

---

### 2. actions.json

**Format:** JSON (pretty-printed, 2-space indent)  
**Encoding:** UTF-8  
**Size:** ~3,850 tokens for typical 29-action session

**Structure:**
```typescript
interface ActionsJson {
  _meta: {
    formatVersion: "2.0"
    generatedBy: string
    sessionId: string           // session-YYYY-MM-DD-HHMMSS
    startTime: number            // Unix timestamp ms
    startTimeISO: string         // ISO 8601
    duration: string             // e.g., "3m 45s"
    startUrl?: string
    totalActions: number
    actionTypes: Record<string, number>  // { "click": 5, "fill": 2 }
  }
  narrative: {
    text: string  // Voice commentary with [action:SHORT_ID:TYPE] embedded
    note: string  // Fixed explanation of reference format
  }
  actions: RecordedAction[]  // Array without voiceSegments
}
```

**Example:**
```json
{
  "_meta": {
    "formatVersion": "2.0",
    "generatedBy": "Dodo Recorder",
    "sessionId": "session-2026-01-23-102150",
    "startTime": 1737628910000,
    "startTimeISO": "2026-01-23T10:21:50.000Z",
    "duration": "8s",
    "startUrl": "https://github.com/pricing",
    "totalActions": 10,
    "actionTypes": { "assert": 4, "screenshot": 2, "click": 1, "navigate": 3 }
  },
  "narrative": {
    "text": "This is the recording... [action:c8d39f77:assert] [action:aa42301c:assert]...",
    "note": "Voice commentary with embedded action references. Match SHORT_ID (first 8 chars) with action.id in actions array."
  },
  "actions": [
    {
      "id": "c8d39f77-176a-4b5a-9209-9558c2f4dbf8",
      "timestamp": 4958,
      "type": "assert",
      "target": {
        "selector": "getByText('\\bOpen\\b \\bSource\\b')",
        "locators": [
          { "strategy": "text", "value": "getByText('\\bOpen\\b \\bSource\\b')", "confidence": "medium" },
          { "strategy": "css", "value": "ul > li:nth-of-type(4) > div > button", "confidence": "low" }
        ],
        "role": "button",
        "name": "Open Source",
        "text": "Open Source",
        "tagName": "button",
        "boundingBox": { "x": 402, "y": 16, "width": 134, "height": 40 }
      }
    }
  ]
}
```

**Validation rules:**
1. Action references in narrative must exist in actions array
2. SHORT_ID must match first 8 chars of action.id
3. Action types must match
4. Duration = last.timestamp - first.timestamp
5. actionTypes must sum to totalActions

---

### 3. screenshots/

**Format:** PNG  
**Naming:** `screenshot-{timestamp}.png`  
**Referenced by:**
- `action.screenshot` field
- `[screenshot:filename.png]` in narrative

---

## Token Optimization

**Efficiency:**
```
session-YYYY-MM-DD-HHMMSS/
├── INSTRUCTIONS.md   ~2,000 tokens (shared, read once)
├── actions.json      ~3,850 tokens (per session)
└── screenshots/
```

**Multi-session efficiency:**
- 1 session: ~5,850 tokens
- 5 sessions: ~21,250 tokens (INSTRUCTIONS.md once + 5× actions.json)
- 10 sessions: ~40,500 tokens (INSTRUCTIONS.md once + 10× actions.json)

**Key insight:** INSTRUCTIONS.md reused across all sessions.

---

## Framework Support

### Detecting Framework

**Playwright:**
- Check `playwright.config.ts` or `playwright.config.js` in repo root
- Check `package.json` for `@playwright/test` dependency

**Cypress:**
- Check `cypress.config.ts` or `cypress.config.js` in repo root
- Check `cypress/` directory
- Check `package.json` for `cypress` dependency

**No framework:** Provide setup instructions, include locator data in comments.

### Framework Examples in INSTRUCTIONS.md

Provides test structure, locator mapping, and best practices for:
1. **Playwright** - `test.describe()`, `getByTestId()`, `getByText()`, `getByRole()`
2. **Cypress** - `describe()`, `cy.get()`, `cy.contains()`, `.should()`
3. **Other** - Adapt patterns from Playwright/Cypress

---

## Implementation

**Core files:**
- [`electron/session/writer.ts`](../electron/session/writer.ts) - SessionWriter class
- [`electron/session/instructions-template.ts`](../electron/session/instructions-template.ts) - Template
- [`electron/utils/enhancedTranscript.ts`](../electron/utils/enhancedTranscript.ts) - Narrative generation
- [`shared/types.ts`](../shared/types.ts) - TypeScript interfaces

**SessionWriter flow:**
```typescript
async write(session: SessionBundle) {
  // 1. Create session directory
  const sessionDir = createSessionDirectory(session)
  
  // 2. Ensure INSTRUCTIONS.md exists (writes once per directory)
  await ensureInstructionsFile(sessionDir)
  
  // 3. Generate narrative text
  const narrativeText = buildNarrativeWithSentenceLevelDistribution(session.actions)
  
  // 4. Build actions.json
  const actionsJson = {
    _meta: { /* metadata */ },
    narrative: { text: narrativeText, note: "..." },
    actions: stripVoiceSegments(session.actions)
  }
  
  // 5. Write actions.json
  await writeJson(path.join(sessionDir, 'actions.json'), actionsJson)
  
  return sessionDir
}
```

**Narrative generation:** [`buildNarrativeWithSentenceLevelDistribution()`](../electron/utils/enhancedTranscript.ts)
- Splits voice segments into sentences with timestamps
- Finds closest sentence for each action timestamp
- Interleaves action references within sentences
- Appends actions without voice at end

**Output:** `"Voice text [action:e6c3069a:navigate] more text [action:c5922be3:click]..."`

---

## Usage

### AI Test Generation

```
Generate browser automation tests from:
./test-context/session-2026-01-23-102150/

Follow INSTRUCTIONS.md. Use Playwright framework.
```

**AI workflow:**
1. Read INSTRUCTIONS.md (once)
2. Read actions.json
3. Parse narrative for intent
4. Cross-reference action IDs (8-char → full UUID)
5. Choose locators by confidence
6. Generate framework-specific test code

### Human Engineers

```bash
cd session-2026-01-23-102150/
cat actions.json | jq '._meta'           # View metadata
cat actions.json | jq '.narrative.text'  # View narrative
cat actions.json | jq '.actions[0]'      # View first action
cat actions.json | jq '.actions | length' # Count actions
cat actions.json | jq '.actions[] | select(.id | startswith("c8d39f77"))' # Find by ID
```
