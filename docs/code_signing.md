# Code Signing for macOS Distribution

> **Note:** This is maintainer-only documentation. Contributors don't need code signing to develop or test the app.

## Overview

Code signing prevents macOS Gatekeeper warnings ("app is damaged") when users install the app. Requires an Apple Developer account and certificate.

## Quick Setup (Maintainer Only)

### 1. Prerequisites

- Apple Developer account
- Developer ID Application certificate (.p12 file)
- App-specific password from [appleid.apple.com](https://appleid.apple.com/)

### 2. Configuration

Create `.env` file in project root:

```bash
cp .env.example .env
```

Fill in credentials:

```bash
APPLE_ID="your-apple-id@example.com"
APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
APPLE_TEAM_ID="L7PUGF6Q28"
CSC_LINK="./certificate.p12"
CSC_KEY_PASSWORD="your-certificate-password"
```

Place `certificate.p12` in project root (already in `.gitignore`).

### 3. Building

**Unsigned build** (for testing):
```bash
npm run electron:build
```

**Signed build** (for release):
```bash
npm run electron:build:signed
```

Output in `release/` directory.

## Security

- **Never commit:** `.env`, `certificate.p12`, or any credentials
- Backup certificate and passwords securely
- Certificate and .env files are already gitignored

## Verification

Check signature on built app:
```bash
codesign -dv --verbose /path/to/Dodo\ Recorder.app
```

## References

- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [Apple Notarization](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution) (future enhancement)
- Configuration: [`electron-builder.json`](../electron-builder.json)
