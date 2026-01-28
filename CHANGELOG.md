# Changelog

All notable changes to Dodo Recorder will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

## [0.2.0] - 2026-01-28

### Added

**New Features:**
- 🎯 Hover highlighter - visual feedback when hovering over elements in recorded browser
- 🎤 Microphone selector - choose specific audio recording device
- 🔍 Debug info widget - displays build information and system details
- 📝 New output format - improved session bundle structure with better AI parsing

**Technical Enhancements:**
- Build info generation - automatic build metadata generation
- Narrative builder - improved voice commentary to action synchronization
- Production logging - comprehensive logging with electron-log integration
- Validation utilities - input validation patterns for IPC handlers
- Enhanced transcript processing - better silence filtering and voice segmentation

**Platform Support:**
- Windows Whisper.cpp binaries - full set of Whisper binaries for Windows platform

**Documentation:**
- Application UI documentation - comprehensive UI component documentation
- Architecture documentation - updated and reorganized
- CI/CD documentation - GitHub Actions workflow documentation
- Code signing documentation - macOS code signing and notarization guide
- Hover highlighting documentation - feature documentation
- Logs and debugging guide - comprehensive debugging documentation
- User guide improvements - enhanced user documentation

### Changed

**UI/UX Improvements:**
- Recording widget UI adjustments - better layout and visual feedback
- Recording indicator - simplified and more visible recording status
- Header rework - improved header component with build info widget
- Transcript view enhancements - better text selection and copy functionality
- Actions list improvements - refined action display and organization
- Better voice + actions combining - improved synchronization algorithm
- Icons regenerated - refined application icons for all platforms
- Better macOS icons - improved icon quality and appearance

**Audio Improvements:**
- Better filtering out silence in transcript - improved voice detection
- Audio visualizer in browser widget - real-time audio feedback in recording widget

**Hotkeys:**
- Simplified hotkeys - streamlined keyboard shortcuts for common actions

**Documentation Reorganization:**
- Restructured docs - better organized documentation hierarchy
- Removed outdated docs - cleaned up obsolete documentation files
- Updated AGENTS.md - current development guidelines

### Fixed

**Bug Fixes:**
- Fix bug with duplicated navigation actions - prevents duplicate navigation entries
- Fix not copyable text from transcript view - enables text selection and copying
- Fix bug when no actions were recorded - handles empty action sessions gracefully
- Fix not working playwright browsers in production - resolved bundling issues
- Fix recording widget - resolved widget display and interaction issues
- Fix mic dropdown UI - corrected microphone selector display
- Fix installation steps on Windows - updated Windows installation documentation
- Fix omit signature on Windows - resolved Windows build signing issues
- Fix build script notarization issue - macOS notarization process corrected
- Fix GitHub build - resolved CI/CD workflow issues

**Build System:**
- Fix build script for Windows - Windows build process improvements
- Fix build script for macOS - macOS build process improvements
- Fix the issue with no bundled browser - resolved Playwright browser bundling
- Multiple build script fixes - improved reliability across platforms

**Platform-Specific:**
- macOS code signing and notarization - proper macOS distribution support
- Windows build fixes - improved Windows build reliability

### Technical Details

**Dependencies:**
- Added electron-log for production logging
- Updated build scripts for better cross-platform support

**Build System:**
- GitHub Actions CI/CD workflow for automated builds
- Improved build scripts with better error handling
- Build info generation for release tracking
- Playwright browser bundling improvements

[Unreleased]: https://github.com/dodosaurus/dodo-recorder/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/dodosaurus/dodo-recorder/releases/tag/v0.2.0
[0.1.0]: https://github.com/dodosaurus/dodo-recorder/releases/tag/v0.1.0
