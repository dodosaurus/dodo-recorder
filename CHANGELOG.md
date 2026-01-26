# Changelog

All notable changes to Dodo Recorder will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

## [0.1.0] - 2026-01-23

### Initial Release

**Core Features:**
- 🎬 Browser interaction recording with Playwright
- 🎙️ Voice commentary with local Whisper.cpp transcription
- 📸 Screenshot capture (manual and automatic)
- ✅ Assertion mode for recording element validations
- 🪟 Non-intrusive floating widget in recorded browser
- 🎭 Framework-agnostic session output (Playwright, Cypress, Selenium, Puppeteer)

**Technical Highlights:**
- Multiple locator strategies (testId, text, role, CSS, XPath) with confidence levels
- Voice-to-action synchronization algorithm
- Offline processing (no cloud dependencies)
- Session bundles optimized for AI test generation

**Platform Support:**
- macOS (x64 and ARM64), Windows, Linux

### Known Limitations

- Whisper model (466 MB) must be downloaded manually
- Release builds only available for macOS Apple Silicon
- English-only transcription (small.en model)

[Unreleased]: https://github.com/dodosaurus/dodo-recorder/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/dodosaurus/dodo-recorder/releases/tag/v0.1.0
