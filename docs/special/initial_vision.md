# AI-Assisted Black-Box Playwright Testing — System Overview

## Purpose

Enable manual and exploratory testers to produce **high-quality, maintainable Playwright tests**
*without writing code*, while keeping **full control** in the hands of test automation engineers.

AI is used **only at generation and refactoring time**, never at test runtime.

The final output is a **standard Playwright repository**:
- deterministic
- CI-friendly
- rerunnable without AI
- understandable by engineers

---

## Core Principles

- **Black-box only**: no access to production code
- **Separation of concerns**:
  - Observation ≠ interpretation ≠ code generation
- **Human-in-the-loop**: nothing enters the repo without engineer approval
- **AI as a compiler**, not an oracle
- **One project = one application**
- **Tests are the side-effect of understanding the app**

---

## Key Roles

### 1. Primary Producer — Manual / Exploratory Tester
- Uses a **Recorder App**
- Navigates the real application in a real browser
- Speaks commentary (intent, expectations, observations)
- Does **not** write code
- Does **not** interact with AI

### 2. Gatekeeper — Test Automation Engineer / Developer
- Works in a familiar **IDE (VS Code, Cursor, CLI)**
- Reviews recorded sessions
- Invokes AI-assisted generation
- Approves, edits, and maintains the Playwright repo

### 3. Silent Third Actor — AI System
- Lives **behind the repository**
- Interprets recorded sessions
- Builds a mental model of the application
- Generates and refactors Playwright code
- Never runs in CI or production test execution

---

## System Components

### Recorder App (Electron / Desktop)

**Responsibilities**
- Launch and control a real browser
- Record browser actions with precise timestamps:
  - clicks, fills, navigation, back/forward, URLs
- Record voice commentary
- Produce a lossless, inspectable session artifact

**Explicitly out of scope**
- Test generation
- Assertions
- Playwright concepts
- AI interaction

**Output: Session Bundle**
```
session-YYYY-MM-DD-HHMMSS/
├── actions.json      # All recorded actions (clean, with unique IDs)
├── transcript.txt    # Voice commentary with embedded action references
└── screenshots/      # Screenshots captured during session
```

This bundle contains **facts only**, no interpretation.

**Key design decisions:**
- Minimal file output for simplicity
- All actions have unique IDs
- Voice commentary integrated into transcript.txt with inline references
- Format optimized for both LLM consumption and human readability
- All actions are referenced in the transcript

---

### Engineer Environment (IDE + Repo)

- Standard Playwright repository
- `.ai/` folder defines agent grounding:
  - `capabilities.md`
  - `constraints.md`
  - `context.md`
  - `memory.md`
- Engineer feeds session bundle(s) to AI via IDE, CLI, or scripted workflow
- AI interprets the session (actions.json + transcript.txt)
- AI proposes code changes
- Engineer reviews and commits

---

### AI Layer (Behind the Repo)

**Responsibilities**
- Interpret human intent from actions + commentary
- Infer application structure (pages, flows, invariants)
- Generate Page Object Models, helpers, and tests
- Refactor existing tests to remain DRY
- Accumulate black-box knowledge over time

**Constraints**
- No runtime dependency
- No auto-merge
- No hidden state outside the repo and `.ai/` memory

---

## End-to-End Flow

Manual Tester  
→ Recorder App  
→ Session Artifact  
→ Engineer IDE (Gatekeeper)  
→ Playwright Repository  
→ CI / Test Runs

---

## Outcome

Over time, each project produces:
- A growing, high-quality Playwright test suite
- A durable, black-box mental model of the application
- Reduced manual-to-automation friction
- Clear role boundaries and trust
