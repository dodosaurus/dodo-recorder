# Building Dodo Recorder

This document describes how to build Dodo Recorder for local testing and production distribution.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Mode](#development-mode)
- [Local Test Build](#local-test-build)
- [Production Build](#production-build)
- [Creating a Release Tag](#creating-a-release-tag)
- [Build Scripts](#build-scripts)
- [Build Configuration](#build-configuration)
- [Environment Variables](#environment-variables)
- [CI/CD Pipeline](#cicd-pipeline)
- [Build Artifacts](#build-artifacts)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before building Dodo Recorder, ensure you have:

- **Node.js 18+** and npm
- **Git**
- **macOS Apple Silicon** or **Windows x64**

### Required Files

The build process requires these files to be present:

| File | Purpose | Source |
|------|---------|--------|
| `models/ggml-small.en.bin` | Whisper AI model (466 MB) | Download manually (see [Whisper Model Setup](#whisper-model-setup)) |
| `models/unix/whisper` | Whisper binary (macOS) | Committed to git |
| `models/win/whisper-cli.exe` | Whisper binary (Windows) | Committed to git |
| `playwright-browsers/` | Playwright Chromium browser | Auto-installed via postinstall script |

### Whisper Model Setup

The Whisper model file (466 MB) is not in the repository. Download it once:

**macOS:**
```bash
curl -L -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin
```

**Windows (PowerShell):**
```powershell
curl.exe -L -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin
```

### Playwright Browsers

Playwright browsers are automatically installed to the `playwright-browsers/` directory during `npm install` via a postinstall script. If you need to reinstall them manually:

```bash
npm run install:browsers
```

This runs `build/install-playwright-browsers.js`, which:
- Creates the `playwright-browsers/` directory
- Installs Chromium for the current platform
- The browser is bundled with the final app via `extraResources`

---

## Quick Start

```bash
# 1. Install dependencies (auto-installs Playwright browsers)
npm install

# 2. Download Whisper model
curl -L -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin

# 3. Run in development mode
npm run dev
```

---

## Development Mode

```bash
npm run dev
```

This starts:
- **Vite dev server** for the React frontend (hot reload enabled)
- **Electron** in watch mode

Changes to source files will automatically reload the app.

---

## Local Test Build

For local testing without code signing:

```bash
npm run build
```

**What this does:**
1. Generates `build-info.json` with git commit hash and build timestamp
2. Builds the React frontend with Vite to `dist/`
3. Runs `electron-builder` with `electron-builder.test.json` configuration
4. Builds **macOS ARM64 only** (no Windows support in test build so far)
5. Creates unsigned `.dmg` and `.zip` files in `release/`

**Output location:** `release/` directory

**Platform support:** macOS ARM64 only

**Signing:** None (identity set to `null`)

---

## Production Build

> **Note:** Code signing and notarization is only relevant for the main maintainer. For contributors, use the [Local Test Build](#local-test-build) instead.

For signed and notarized production builds:

```bash
npm run build:prod
```

**What this does:**
1. Loads environment variables from `.env` file (if present)
2. Generates `build-info.json` with git commit hash and build timestamp
3. Builds the React frontend with Vite to `dist/`
4. Detects the current platform and builds accordingly:
   - **macOS ARM64**: Signed + notarized `.dmg` and `.zip`
   - **Windows x64**: NSIS installer + portable executable
5. Creates output in `release/` directory

**Output location:** `release/` directory

**Platform support:** macOS ARM64, Windows x64

**Signing:** Full code signing and notarization (macOS), no signing (Windows)

---

## Creating a Release Tag

After bumping the version in `package.json` and `CHANGELOG.md`, create a Git tag to mark the release:

```bash
# 1. Verify changes are committed
git status

# 2. Create annotated tag with version number
git tag -a v0.3.0 -m "Release v0.3.0"

# 3. Push the tag to remote repository
git push origin v0.3.0

# 4. Push all tags (alternative)
git push origin --tags
```

**Tag Naming Convention:**
- Use semantic versioning with `v` prefix: `v0.3.0`, `v1.0.0`, etc.
- Use annotated tags (`-a` flag) to include release notes
- Tag should match the version in `package.json`

**Viewing Tags:**

```bash
# List all tags
git tag

# Show tag details
git show v0.3.0

# List tags in chronological order
git tag --sort=-creatordate
```

**Deleting Tags (if needed):**

```bash
# Delete local tag
git tag -d v0.3.0

# Delete remote tag
git push origin --delete v0.3.0
```

**CI/CD Integration:**

When creating a GitHub Release:
1. Create the tag locally and push as shown above
2. Go to GitHub → Releases → "Draft a new release"
3. Select the tag you just pushed
4. Copy the changelog from `CHANGELOG.md`
5. Upload the build artifacts from `release/`
6. Publish the release

Alternatively, you can specify the `release_tag` parameter when triggering the CI/CD workflow to automatically upload artifacts to the release.

---

## Build Scripts

### `npm run dev`

Starts the development server with hot reload.

### `npm run build`

Runs `build/build.js` for local test builds.

### `npm run build:prod`

Runs `build/build-prod.js` for production builds.

### `npm run install:browsers`

Manually installs Playwright browsers to `playwright-browsers/`.

### `npm run postinstall` (automatic)

Runs automatically after `npm install`. Calls `build/install-playwright-browsers.js`.

### `npm run generate-icons`

Runs `build/generate-icons.sh` to generate app icons from source.

---

## Build Configuration

### Test Build Configuration (`electron-builder.test.json`)

Used for local testing without code signing.

**Key differences from production:**
- `hardenedRuntime: false`
- No `entitlements` or `entitlementsInherit`
- `type: "development"`
- No notarization configuration

**Targets:**
- macOS: `.dmg`, `.zip`
- Windows: `.nsis`, `.portable` (not used in test build script)

### Production Build Configuration (`electron-builder.json`)

Used for production releases with full signing and notarization.

**macOS configuration:**
```json
{
  "target": ["dmg", "zip"],
  "icon": "build/icon.icns",
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist",
  "extendInfo": {
    "NSMicrophoneUsageDescription": "Dodo Recorder needs microphone access..."
  },
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "category": "public.app-category.developer-tools",
  "type": "distribution",
  "notarize": {
    "teamId": "L7PUGF6Q28"
  }
}
```

**Windows configuration:**
```json
{
  "target": ["nsis", "portable"],
  "icon": "build/icon.ico",
  "sign": null,
  "signAndEditExecutable": false
}
```

**Extra Resources (bundled with app):**
- `models/` - Whisper binaries and AI model
- `node_modules/ffmpeg-static` - FFmpeg binaries
- `playwright-browsers/` - Playwright Chromium browser

**ASAR Unpack:**
- `**/*.node` - Native Node.js modules
- `resources/playwright-browsers/**/*` - Playwright browsers

---

## Environment Variables

> **Note:** The following environment variables are only needed for the main maintainer to sign and notarize production builds. Contributors can skip this section and use [Local Test Build](#local-test-build) instead.

Create a `.env` file in the project root (copy from `.env.example`).

### Required for macOS Notarization

| Variable | Description | Example |
|----------|-------------|---------|
| `APPLE_ID` | Your Apple ID email | `your-apple-id@example.com` |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password (generate at appleid.apple.com) | `abcd-efgh-ijkl-mnop` |
| `APPLE_TEAM_ID` | Your Apple Developer Team ID | `L7PUGF6Q28` |

### Optional for macOS Code Signing

Choose one method:

**Method 1: Explicit .p12 certificate**
```bash
CSC_LINK=./certificate.p12
CSC_KEY_PASSWORD=your-p12-password
```

**Method 2: Keychain auto-discovery (default)**
- Don't set `CSC_LINK` or `CSC_KEY_PASSWORD`
- electron-builder will auto-discover from Keychain
- Requires properly named "Developer ID Application: Your Name (TEAM_ID)"

**Method 3: Explicit certificate name**
```bash
CSC_NAME="Developer ID Application: Your Name (TEAM_ID)"
```

### Example `.env` File

```bash
# Apple Developer credentials
APPLE_ID="your-apple-id@example.com"
APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
APPLE_TEAM_ID="L7PUGF6Q28"

# Optional: Explicit certificate file
CSC_LINK=./certificate.p12
CSC_KEY_PASSWORD=your-p12-password
```

---

## CI/CD Pipeline

> **Note:** The CI/CD pipeline is managed by the main maintainer. Contributors do not need to trigger builds manually.

The GitHub Actions workflow (`.github/workflows/build.yml`) builds Dodo Recorder for macOS ARM64 and Windows x64.

### Workflow Trigger

**Manual trigger only** via GitHub Actions UI.

**To trigger a build:**
1. Go to **Actions** → **Build Dodo Recorder** workflow
2. Click **Run workflow**
3. Select branch (usually `main`)
4. Choose platforms from dropdown:
   - `macos-arm64,windows` (both)
   - `macos-arm64` (macOS only)
   - `windows` (Windows only)
5. Optional: Enter `release_tag` (e.g., `v1.0.0`) to upload to release
6. Click **Run workflow**

### Build Jobs

#### `build-macos-arm64`

Runs on `macos-latest`:

1. **Checkout code** - Checks out the specified branch or tag
2. **Setup Node.js 18** - Uses `actions/setup-node@v4`
3. **Cache npm dependencies** - Caches `~/.npm` based on `package-lock.json`
4. **Cache Playwright browsers** - Caches `playwright-browsers/` directory
5. **Install dependencies** - Runs `npm ci`
6. **Download Whisper model** - Downloads from Hugging Face to `models/`
7. **Import Code Signing Certificate** - Decodes base64 certificate from secrets and imports to keychain
8. **Build** - Runs `npm run build:prod` with environment variables
9. **Upload artifacts** - Uploads `.dmg` and `.zip` files (30-day retention)

#### `build-windows`

Runs on `windows-latest`:

1. **Checkout code** - Checks out the specified branch or tag
2. **Setup Node.js 18** - Uses `actions/setup-node@v4`
3. **Cache npm dependencies** - Caches npm based on `package-lock.json`
4. **Cache Playwright browsers** - Caches `playwright-browsers/` directory
5. **Install dependencies** - Runs `npm ci`
6. **Download Whisper model** - Downloads from Hugging Face to `models/`
7. **Build** - Runs `npm run build:prod`
8. **Upload artifacts** - Uploads `.exe` file (30-day retention)

#### `upload-to-release`

Runs on `ubuntu-latest` when `release_tag` is provided:

1. **Checkout code** - Checks out the specified tag
2. **Download all artifacts** - Downloads artifacts from previous jobs
3. **Upload to GitHub Release** - Uses `softprops/action-gh-release@v1` to attach artifacts to the release

### GitHub Secrets

Required for macOS code signing and notarization:

| Secret | Description |
|--------|-------------|
| `MACOS_CERTIFICATE` | Base64-encoded Developer ID Application certificate (.p12) |
| `MACOS_CERTIFICATE_PASSWORD` | Password for the .p12 certificate |
| `APPLE_ID` | Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

**Setup:** Settings → Secrets and variables → Actions → New repository secret

**Without secrets:** macOS builds will fail (certificate required for signing).

---

## Build Artifacts

### Local Test Build

| Platform | Artifacts | Location |
|----------|-----------|----------|
| macOS ARM64 | `Dodo Recorder-<version>-arm64.dmg`<br>`Dodo Recorder-<version>-arm64-mac.zip` | `release/` |

### Production Build

| Platform | Artifacts | Location |
|----------|-----------|----------|
| macOS ARM64 | `Dodo Recorder-<version>-arm64.dmg`<br>`Dodo Recorder-<version>-arm64-mac.zip` | `release/` |
| Windows x64 | `Dodo Recorder Setup <version>.exe`<br>`Dodo Recorder <version>.exe` (portable) | `release/` |

### CI/CD Artifacts

Artifacts are retained for 30 days in the GitHub Actions tab. If a `release_tag` is provided, they are also attached to the GitHub release.

---

## Troubleshooting

### "Whisper model not found" Error

**Problem:** App can't find `models/ggml-small.en.bin`

**Solution:**

**macOS:**
```bash
curl -L -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin
```

**Windows (PowerShell):**
```powershell
curl.exe -L -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin
```

### "Playwright browser not installed" Error

**Problem:** Playwright Chromium browser not found

**Solution:**
```bash
npm run install:browsers
```

### macOS Code Signing Fails

> **Note:** This section is only relevant for the main maintainer. Contributors using [Local Test Build](#local-test-build) do not need to worry about signing.

**Problem:** Build fails during code signing

**Common errors and solutions:**

**"cannot find valid 'Developer ID Application' identity":**
- Certificate has UUID name instead of proper "Developer ID Application: Your Name (TEAM_ID)" format
- Use `CSC_LINK=./certificate.p12` with `CSC_KEY_PASSWORD` to bypass Keychain auto-discovery
- Or specify `CSC_NAME` with the SHA-1 hash from `security find-identity -v -p codesigning`

**"not a file" during CI/CD build:**
- `MACOS_CERTIFICATE` secret is not set or invalid
- Ensure certificate is exported as .p12 and converted to base64 without extra whitespace

**General solutions:**
1. Verify all secrets are set correctly (for CI/CD)
2. Check `.env` file exists and contains correct values (for local builds)
3. Verify `APPLE_TEAM_ID` matches your certificate
4. Ensure certificate includes "Developer ID Application"

### macOS Notarization Fails

> **Note:** This section is only relevant for the main maintainer. Contributors using [Local Test Build](#local-test-build) do not need to worry about notarization.

**Problem:** Build succeeds but app is not notarized

**Common errors and solutions:**

**"HTTP status code: 403. A required agreement is missing or has expired":**
- Go to [Apple Developer portal](https://developer.apple.com/account)
- Review and accept all required agreements (updated annually)
- Wait a few minutes for changes to propagate

**"Unexpected token 'E', is not valid JSON":**
- Invalid or expired `APPLE_APP_SPECIFIC_PASSWORD`
- Generate new app-specific password at [appleid.apple.com](https://appleid.apple.com)
- Verify credentials with: `xcrun notarytool history --apple-id "..." --password "..." --team-id "..."`

**General solutions:**
1. Verify all Apple credentials are set: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
2. Check your Apple Developer account is in good standing
3. The build will warn if credentials are missing

---

### Verifying Signed & Notarized Builds

After a production build, verify the app is properly signed and notarized:

```bash
# Check signature
codesign -dv --verbose=4 release/mac-arm64/Dodo\ Recorder.app

# Check notarization
spctl -a -vv -t install release/mac-arm64/Dodo\ Recorder.app
# Expected: "accepted" + "source=Notarized Developer ID"

# Check stapled ticket
stapler validate release/mac-arm64/Dodo\ Recorder.app
# Expected: "The validate action worked!"
```

---

### Security Notes

- Never commit `.env`, `certificate.p12`, or credentials to version control
- These files are already gitignored
- Backup certificate and passwords securely

### Build Timeout

**Problem:** Build times out before completing

**Solutions:**

1. **Check caching is working** - npm and Playwright browsers should be cached
2. **Verify Whisper download not timing out** - Check network connectivity
3. **Increase timeout in workflow file** (if needed)

### Windows Build Issues

**Problem:** Windows build fails

**Solutions:**

1. **Ensure FFmpeg is installed** - The app bundles `ffmpeg-static` via npm
2. **Check Node.js version** - Must be 18+
3. **Verify Windows is x64** - ARM64 is not currently supported

### Build Output Not Found

**Problem:** Build completes but no output files in `release/`

**Solutions:**

1. **Check the console output for errors**
2. **Verify `dist/` and `dist-electron/` directories exist**
3. **Ensure Vite build completed successfully**
4. **Check `electron-builder` configuration**

---

## Build Info File

Each build generates a `build-info.json` file in the project root with:

```json
{
  "commitHash": "abc1234",
  "commitFull": "abc1234def5678...",
  "branch": "main",
  "isDirty": false,
  "buildTime": "2024-01-30T10:48:00.000Z",
  "nodeVersion": "v18.19.0"
}
```

This file is read by the Electron app to display build information in the UI.

---

## Additional Resources

- **[User Guide](docs/user_guide.md)** - Complete feature documentation
- **[Architecture](docs/architecture.md)** - System design and technical implementation
- **[Logs and Debugging](docs/logs_and_debugging.md)** - Debugging guide
