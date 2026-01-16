# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-16

### Initial Release

#### Platform Support
- ✅ **macOS** - Fully supported
- ⏳ **Windows** - Planned for future release
- ⏳ **Linux** - Planned for future release

> **Note:** This initial release supports macOS only. The codebase is designed to be cross-platform, and Windows/Linux support will be added in a future release. All necessary abstraction layers for cross-platform compatibility are already in place.

#### Features
- 🎙️ Voice commentary recording with Whisper.cpp transcription (fully offline)
- 🎭 Browser interaction recording via Playwright
- ✅ Assertion mode for visual validation (Alt/Option + Click)
- 📸 Screenshot capture (manual keyboard shortcut and widget button)
- 🔍 Multi-locator strategy with confidence scores (testId, text, role, css, xpath)
- 🤖 AI-optimized session bundles with comprehensive transcript
- 📦 Framework-agnostic output format (works with any test framework)

[0.1.0]: https://github.com/dodosaurus/dodo-recorder/releases/tag/v0.1.0
