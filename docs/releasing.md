# Release Checklist

**For Maintainers Only** - Quick reference for creating GitHub releases.

---

## Pre-Release Checklist

### 1. Version & Documentation
- [ ] Update version in [`package.json`](../package.json)
- [ ] Update [`CHANGELOG.md`](../CHANGELOG.md) with release notes
- [ ] Verify [`README.md`](../README.md) platform support is accurate
- [ ] Commit changes: `git commit -m "chore: prepare vX.X.X release"`

### 2. Testing
- [ ] Test in development: `npm run dev`
- [ ] Test production build: `npm run build:prod`
- [ ] Verify DMG opens and installs correctly
- [ ] Test recording session end-to-end
- [ ] Verify Whisper model detection (if missing, shows error)

### 3. Build Verification
- [ ] Check `release/` folder for build artifacts
- [ ] Verify DMG is signed: `codesign -dv --verbose=4 release/mac-arm64/Dodo\ Recorder.app`
- [ ] Verify notarization: `spctl -a -vv -t install release/mac-arm64/Dodo\ Recorder.app`
- [ ] Expected: "accepted" and "source=Notarized Developer ID"

---

## Create Release

### 1. Create Git Tag
```bash
# Create annotated tag with message
git tag -a vX.X.X -m "Release vX.X.X - Brief description

Core features:
- Feature 1
- Feature 2

See CHANGELOG.md for full details."

# Verify tag
git tag -l -n9 vX.X.X
```

### 2. Push to GitHub
```bash
# Push commits
git push origin main

# Push tag
git push origin vX.X.X
```

### 3. Create GitHub Release

**Via Web Interface** (recommended):
1. Go to: https://github.com/dodosaurus/dodo-recorder/releases
2. Click "Draft a new release"
3. Fill in:
   - **Tag:** `vX.X.X` (select existing)
   - **Title:** `vX.X.X - Release Name`
   - **Description:** Copy from CHANGELOG.md (see template below)
4. Upload artifacts:
   - `release/Dodo.Recorder-X.X.X-arm64.dmg`
   - DO NOT upload `.blockmap` files
5. Check boxes:
   - ✅ "Set as a pre-release" (if v0.x.x)
   - ✅ "Set as the latest release"
6. Click "Publish release"

**Via GitHub CLI** (alternative):
```bash
gh release create vX.X.X \
  --title "vX.X.X - Release Name" \
  --notes-file CHANGELOG.md \
  --prerelease \
  release/*.dmg
```

### Release Notes Template

```markdown
# 🦕 Dodo Recorder vX.X.X

Brief one-line description of this release.

## ✨ What's New

**New Features:**
- Feature description with brief explanation

**Improvements:**
- Improvement description

**Bug Fixes:**
- Bug fix description

## 📥 Installation

### macOS Apple Silicon (M1–M4)

1. Download `Dodo.Recorder-X.X.X-arm64.dmg`
2. Open the DMG and drag to Applications
3. **Download Whisper Model** (required, one-time):
   ```bash
   cd /Applications/Dodo\ Recorder.app/Contents/Resources/models
   curl -L -o ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin
   ```

### Other Platforms
Intel Mac, Windows, and Linux users: Build from source (see README.md)

## ⚠️ Known Limitations
- Whisper model (466 MB) must be downloaded manually
- Release builds only for macOS Apple Silicon
- English-only transcription

## 📚 Documentation
- [User Guide](https://github.com/dodosaurus/dodo-recorder/blob/main/docs/user_guide.md)
- [Architecture](https://github.com/dodosaurus/dodo-recorder/blob/main/docs/architecture.md)

**Full Changelog**: https://github.com/dodosaurus/dodo-recorder/compare/vPREV...vX.X.X
```

---

## Post-Release

### 1. Update README Badges (Optional)
Add release badge if not present:
```markdown
[![Latest Release](https://img.shields.io/github/v/release/dodosaurus/dodo-recorder)](https://github.com/dodosaurus/dodo-recorder/releases)
[![Downloads](https://img.shields.io/github/downloads/dodosaurus/dodo-recorder/total)](https://github.com/dodosaurus/dodo-recorder/releases)
```

### 2. Update CHANGELOG
Add [Unreleased] section for next release:
```markdown
## [Unreleased]

### Added

### Changed

### Fixed

## [X.X.X] - YYYY-MM-DD
...
```

### 3. Announce Release
- Twitter/X
- LinkedIn
- Reddit (r/softwaretesting, r/QualityAssurance)
- Dev.to or Hacker News

---

## Quick Reference

### Semantic Versioning
- `0.1.0` → `0.1.1` = Bug fixes (patch)
- `0.1.0` → `0.2.0` = New features (minor)
- `0.9.0` → `1.0.0` = Breaking changes or stable (major)

### Version Update
```bash
# Update version in package.json
npm version 0.2.0 --no-git-tag-version
```

### Build Commands
```bash
# Development
npm run dev

# Unsigned build (testing)
npm run build

# Signed + notarized (release)
npm run build:prod
```

### Verification Commands
```bash
# Check signature
codesign -dv --verbose=4 release/mac-arm64/Dodo\ Recorder.app

# Check notarization
spctl -a -vv -t install release/mac-arm64/Dodo\ Recorder.app

# Validate stapled ticket
stapler validate release/mac-arm64/Dodo\ Recorder.app
```

### Git Workflow
```bash
# 1. Version bump
npm version X.X.X --no-git-tag-version

# 2. Update CHANGELOG.md

# 3. Commit
git add package.json CHANGELOG.md
git commit -m "chore: prepare vX.X.X release"

# 4. Tag
git tag -a vX.X.X -m "Release vX.X.X"

# 5. Push
git push origin main
git push origin vX.X.X

# 6. Build
npm run build:prod

# 7. Create GitHub Release (upload DMG)
```

---

## Troubleshooting

### Build Fails - Code Signing Error
**Check:** Certificate is installed in Keychain Access
**Fix:** See [`docs/code_signing.md`](code_signing.md)

### Notarization Fails
**Check:** APPLE_ID and APPLE_APP_SPECIFIC_PASSWORD in `.env`
**Fix:** Regenerate app-specific password at appleid.apple.com

### DMG Opens with "Damaged" Warning
**Cause:** Not signed or notarized properly
**Fix:** Run `npm run build:prod` (not `npm run build`)

---

## First-Time Release Notes

For v0.1.0 (or first public release):
- Emphasize "Initial Release" in title
- Set as pre-release (v0.x.x)
- Include "Known Limitations" section
- Mention this is early software
- Link to CONTRIBUTING.md for feedback

---

## References

- **Code Signing:** [`docs/code_signing.md`](code_signing.md)
- **CHANGELOG Format:** https://keepachangelog.com/
- **Semantic Versioning:** https://semver.org/
- **GitHub Releases:** https://docs.github.com/en/repositories/releasing-projects-on-github
