<h1 align="center">🦕 Dodo Recorder</h1>

<p align="center">
  <strong>AI-Ready Browser Interaction Recording for Automated Test Generation</strong>
</p>

<p align="center">
  A desktop application for recording browser interactions and voice commentary, producing session bundles optimized for AI-assisted Playwright test generation.
</p>

---

## 🎯 Overview

Dodo Recorder transforms manual browser testing into AI-ready session bundles. Record your interactions, speak your test intentions, and let the app generate comprehensive documentation that AI agents can use to write Playwright tests automatically.

**What makes Dodo Recorder special:**

- 🎙️ **Voice Sync**: Speak naturally while testing—your commentary is automatically transcribed and synced with your actions
- 🎭 **Framework-Agnostic Output**: Works with Playwright, Cypress, Selenium, Puppeteer, or any testing framework
- 🤖 **AI-Optimized**: Session bundles include complete instructions for AI agents—no external documentation needed
- 📸 **Smart Locators**: Multiple locator strategies (testId, text, role, css, xpath) with confidence levels
- ✅ **Assertion Mode**: Record visual assertions with Alt/Option + Click
- 🪟 **Non-Intrusive Widget**: Floating controls that never interfere with your recording

---

## ✨ Key Features

### 🎬 Recording Capabilities

- **🖱️ Interaction Capture**: Automatically records clicks, typing, navigation, and form interactions
- **📸 Screenshot Management**: Take screenshots manually or automatically at key moments
- **🎤 Voice Commentary**: Local transcription using Whisper.cpp (fully offline, no cloud services)
- **✅ Assertion Recording**: Toggle assertion mode to verify element existence
- **🔍 Multi-Locator Strategy**: Each action includes multiple ways to locate elements with confidence scores

### 📦 Session Output

Each recording produces a framework-agnostic session bundle:

```
session-YYYY-MM-DD-HHMMSS/
├── README.md          # Quick start for AI agents
├── transcript.txt     # Comprehensive narrative with action references
├── actions.json       # Clean action data with metadata
└── screenshots/       # Visual captures
```

**Action Reference Format**: Actions are referenced in the transcript as `[action:SHORT_ID:TYPE]` where:
- `SHORT_ID` = First 8 characters of the UUID in actions.json
- Example: `[action:8c61934e:click]` maps to `"id": "8c61934e-4cd3-4793-bdb5-5c1c6d696f37"`

### 🎮 Recording Controls

**Floating Widget** (appears in browser top-right corner):
- 📸 Take screenshots
- ✅ Toggle assertion mode (auto-disables after recording an assertion)
- 🎯 Drag to reposition
- 👻 Never recorded in your interactions

**Keyboard Shortcuts:**

| Shortcut | Action |
|----------|--------|
| **Cmd+Shift+S** (Mac)<br>**Ctrl+Shift+S** (Windows/Linux) | Take Screenshot |
| **Alt/Option + Click** | Record Assertion |

### 🔐 Privacy & Local Processing

- **No Cloud Dependencies**: All transcription happens locally using Whisper.cpp
- **Offline First**: No internet required after initial setup
- **Your Data Stays Local**: Session bundles remain on your machine

---

## 🚀 Quick Start

### Installation

Download the latest release for your platform:
- **macOS**: `.dmg` or `.zip`
- **Windows**: `.exe` installer or portable
- **Linux**: AppImage or `.deb`

### First Recording

1. Launch Dodo Recorder
2. Enter the URL you want to test
3. Click "Start Recording"
4. A browser window opens with a floating widget
5. Perform your test actions and speak your intentions
6. Click "Stop Recording" when done
7. Find your session bundle in the configured output directory

> 💡 **Pro Tip**: Speak continuously while testing. Say things like "Now I'll click the login button to verify authentication works" for better AI test generation.

---

## 🛠️ Developer Setup

### Prerequisites

- **Node.js 18+** and npm
- **Git**

### Installation Steps

#### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd dodo-recorder
npm install
```

#### 2. Download Whisper Model (REQUIRED)

The Whisper model file (466 MB) is not in the repository. Download it once:

```bash
curl -L -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin
```

> ℹ️ The whisper.cpp binary is already included in the repository.

#### 3. Verify Setup

```bash
ls -lh models/ggml-small.en.bin
```

Expected output: `-rw-r--r--  models/ggml-small.en.bin` (~466M file size)

### Running the App

**Development Mode:**
```bash
npm run dev
```

**Production Build:**
```bash
npm run electron:build
```

Distributable apps are created in the `release/` folder.

### Project Structure

```
dodo-recorder/
├── models/                          # Whisper components
│   ├── whisper                     # Whisper.cpp binary (committed)
│   └── ggml-small.en.bin          # AI model (download manually)
├── electron/                        # Electron main process
│   ├── main.ts                     # Entry point
│   ├── browser/                    # Playwright recording
│   ├── audio/                      # Audio & transcription
│   └── session/                    # Session management
├── src/                             # React renderer process
│   ├── components/                 # UI components
│   ├── stores/                     # Zustand state management
│   └── types/                      # TypeScript types
└── docs/                            # Documentation
```

---

## 🔧 Troubleshooting

### "Whisper model not found" Error

**Problem:** App can't find `models/ggml-small.en.bin`

**Solution:**
```bash
curl -L -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin
```

Or download manually from [Hugging Face](https://huggingface.co/ggerganov/whisper.cpp/tree/main) and place in `models/ggml-small.en.bin`

### "Whisper binary not found" Error

**Problem:** Binary not found at `models/whisper`

**Solution:** The binary should be committed to git. Pull the latest code:
```bash
git pull origin main
```

### Windows/Linux Binary

The committed binary is for macOS. On Windows or Linux, build whisper.cpp manually:

```bash
# Clone and build whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git /tmp/whisper
cd /tmp/whisper
git checkout v1.5.4
make main

# Copy to your project
cp main /path/to/dodo-recorder/models/whisper
chmod +x /path/to/dodo-recorder/models/whisper
```

---

## ❓ FAQ

**Q: Why is the model not in git?**  
A: It's 466 MB—too large for git repositories. Download it once manually.

**Q: Why is the binary in git?**  
A: It's only 1 MB and simplifies setup significantly.

**Q: Can I use a different Whisper model?**  
A: The app is hard-coded to use `small.en` for consistency and performance.

**Q: Do I need to download the model for every clone?**  
A: Yes, but only once per machine. The file persists across npm installs.

**Q: What if I'm not on macOS?**  
A: Build the whisper.cpp binary for your platform (see troubleshooting section).

**Q: Does this work with frameworks other than Playwright?**  
A: Yes! The session output is framework-agnostic. AI agents can generate tests for Playwright, Cypress, Selenium, Puppeteer, or any other framework.

**Q: Is my voice data sent to the cloud?**  
A: No. All transcription happens locally using Whisper.cpp. Your voice recordings never leave your machine.

---

## 📚 Documentation

- **[User Guide](docs/user_guide.md)**: Complete feature documentation, keyboard shortcuts, and output format details
- **[Architecture](docs/architecture.md)**: System design, data flow, and technical implementation
- **[Voice Transcription](docs/voice_transcription.md)**: Deep dive into the local transcription system
- **[Output Format](docs/output_format.md)**: Detailed explanation of session bundle structure
- **[Initial Vision](docs/special/initial_vision.md)**: Original project goals and design principles

---

## 📄 License

MIT
