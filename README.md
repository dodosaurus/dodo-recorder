<p align="center">
  <img src="src/assets/saurus.png" alt="Dodo Recorder Icon" width="128" height="128">
</p>

<h1 align="center">Dodo Recorder</h1>

<p align="center">
  A desktop application for recording browser interactions and voice commentary, producing session bundles for AI-assisted Playwright test generation.
</p>


For detailed usage instructions, features, and keyboard shortcuts, see [`docs/user_guide.md`](docs/user_guide.md).

## Quick Usage

| Key | Action |
|-----|--------|
| **Cmd+Shift+S** (Mac)<br>**Ctrl+Shift+S** (Windows/Linux) | Take Screenshot |
| **Alt/Option + Click** | Record Assertion (verify element exists) |

> **Tip**: Speak your commentary while recording. The app automatically syncs your voice with your actions.

## Getting Started

### Prerequisites

- Node.js 18+
- macOS/Linux: `make` and C++ compiler (Xcode CLI tools or build-essential)
- Windows: [Install make](https://gnuwin32.sourceforge.net/packages/make.htm)

### Installation

1. **Install dependencies and compile whisper.cpp:**
   ```bash
   npm install
   ```
   This automatically compiles whisper.cpp via the postinstall script.

2. **Download the Whisper model:**
   ```bash
   npm run whisper:download
   ```
   This downloads `ggml-small.en.bin` (recommended).

3. **Verify Whisper setup:**
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

## Documentation

- **[User Guide](docs/user_guide.md)**: Features, usage, keyboard shortcuts, and output formats.
- **[Architecture](docs/architecture.md)**: System design, data flow, technical details, and project structure.
- **[Voice Transcription](docs/voice_transcription.md)**: Deep dive into the local voice transcription system.
- **[Output Format](docs/output_format.md)**: Detailed explanation of the session output format refactoring.
- **[Initial Vision](docs/initial_vision.md)**: Original project vision and design principles.

## License

MIT
