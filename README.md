<h1 align="center">🦕 Dodo Recorder</h1>

<p align="center">
  <strong>AI-Ready Browser Interaction Recording for Automated Test Generation</strong>
</p>

<p align="center">
  A desktop application for recording browser interactions and voice commentary, producing session bundles optimized for AI-assisted test generation.
</p>

<p align="center">
  <strong>⚠️ Active Development</strong> • Open Source • Contributions Welcome
</p>

![Screenshot from Dodo Recorder](docs/images/main_screenshot.png)

---

## 🎯 Overview

Dodo Recorder transforms manual browser testing into AI-ready session bundles. Record your interactions, speak your test intentions, and let the app generate comprehensive documentation that AI agents can use to write tests automatically.

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
| **Cmd + Click** (Mac)<br>**Ctrl + Click** (Windows/Linux) | Record Assertion |

### 🔐 Privacy & Local Processing

- **No Cloud Dependencies**: All transcription happens locally using Whisper.cpp
- **Your Data Stays Local**: Session bundles remain on your machine

---

## 🛠️ Development Setup

### Prerequisites

- **Node.js 18+** and npm
- **Git**
- **macOS, Windows, or Linux**

### Installation Steps

#### 1. Clone and Install Dependencies

```bash
git clone https://github.com/dodosaurus/dodo-recorder.git
cd dodo-recorder
npm install
```

> **Note:** The `npm install` command automatically installs Playwright Chromium browser to a local `playwright-browsers/` directory via a postinstall script.
>
> If you encounter issues, you can manually install the browsers with:
> ```bash
> ./build/install-playwright-browsers.sh
> ```

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

This starts the Vite dev server and Electron in watch mode. The app will automatically reload when you make changes.

### Building

**Unsigned build** (for local testing):
```bash
npm run build
```

**Signed and notarized build** (for distribution):
```bash
npm run build:prod
```

Built apps are created in the `release/` folder for your current platform.

> **Note for Maintainers:** See [`docs/code_signing.md`](docs/code_signing.md) for code signing and notarization setup. Contributors don't need code signing for development.

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

## 🤝 Contributing

Contributions are welcome! See [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) for our community standards.

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

### Debugging

For debugging in development mode, the app provides comprehensive logging:

- **Console logs**: Visible in terminal when running `npm run dev`
- **DevTools**: Press `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux) to open browser DevTools
- **Log files** (production builds): See [`docs/logs_and_debugging.md`](docs/logs_and_debugging.md)

### Platform-Specific Issues

**macOS:**
- If you see permission errors, you may need to grant microphone access in System Preferences → Security & Privacy → Microphone

**Windows/Linux:**
- Ensure FFmpeg is installed and accessible in your PATH for audio processing

---

## ❓ FAQ

**Q: Why is the model not in git?**
A: It's 466 MB—too large for git repositories. Download it once manually.

**Q: Can I use a different Whisper model?**
A: The app is hard-coded to use `small.en` for consistency and performance.

**Q: Do I need to download the model for every clone?**
A: Yes, but only once per machine. The file persists across npm installs.

**Q: Does this work with frameworks other than Playwright?**
A: Yes! The session output is framework-agnostic. AI agents can generate tests for Playwright, Cypress, Selenium, Puppeteer, or any other framework.

**Q: Is my voice data sent to the cloud?**
A: No. All transcription happens locally using Whisper.cpp. Your voice recordings never leave your machine.

**Q: Why do I get "Playwright browser not installed" error?**
A: Run `./build/install-playwright-browsers.sh` to download the Playwright Chromium browser. The `npm install` command should do this automatically via a postinstall script.

---

## 📚 Documentation

- **[User Guide](docs/user_guide.md)**: Complete feature documentation, keyboard shortcuts, and output format details
- **[Architecture](docs/architecture.md)**: System design, data flow, and technical implementation
- **[Code Signing](docs/code_signing.md)**: macOS code signing setup and configuration
- **[Voice Transcription](docs/voice_transcription.md)**: Deep dive into the local transcription system
- **[Output Format](docs/output_format.md)**: Detailed explanation of session bundle structure
- **[Logging and Debugging](docs/logs_and_debugging.md)**: How to access logs and debug issues
- **[Agent Guidelines](AGENTS.md)**: Coding standards and guidelines for AI agents
- **[Initial Vision](docs/special/initial_vision.md)**: Original project goals and design principles

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
