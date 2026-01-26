# CI/CD Build Workflow

This document describes the GitHub Actions workflow for building Dodo Recorder across multiple platforms.

## Workflow Trigger

The workflow runs on:
- **Manual trigger only** - Build specific platforms on demand via workflow dispatch

**Note:** The workflow does NOT automatically run on release creation. You must manually trigger it via GitHub Actions UI.

## Building Manually (Platform Selection)

To build specific platforms:

1. Go to **Actions** tab in your repository
2. Select **Build Dodo Recorder** workflow
3. Click **Run workflow** button
4. Select branch (usually `main`)
5. Choose platforms from dropdown:
6. Click **Run workflow**

This is useful for:
- Testing builds for specific platforms
- Building only what you need to save minutes
- Pre-release testing before creating an official release

## Workflow Jobs

The workflow consists of 4 separate build jobs and 1 optional upload job:

### Build Jobs (run conditionally based on platform selection)

1. **build-macos-arm64** - Runs on macOS-latest (Apple Silicon ARM64)
2. **build-macos-x64** - Runs on macOS-latest (Intel x64)
3. **build-windows** - Runs on Windows-latest
4. **build-linux** - Runs on Ubuntu-latest

Each job only runs if its platform is included in the `platforms` input. For example, if you select only "windows", only the `build-windows` job will run.

**Each build job:**
- Checks out the code (optionally at a specific tag)
- Sets up Node.js 18
- Caches npm dependencies and Playwright browsers
- Installs dependencies with `npm ci`
- Downloads the Whisper model
- Builds the application with `npm run build:prod`
- Uploads build artifacts (retained for 30 days)

### Upload to Release Job (optional)

The `upload-to-release` job only runs when you provide a `release_tag` input:
- Depends on all 4 build jobs (runs even if some are skipped)
- Downloads all available artifacts
- Uploads them to the specified GitHub release

## Setup Instructions

### 1. Required GitHub Secrets

For **macOS code signing** (optional but recommended for distribution):

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `APPLE_ID` | Your Apple ID email | Your Apple account |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password | Generate at appleid.apple.com |
| `APPLE_TEAM_ID` | Your Apple Developer Team ID | In Apple Developer portal |

**Note:** Without these secrets, macOS builds will be unsigned (for testing only).

### 2. Setting Up Secrets

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each secret above

#### Exporting macOS Certificate

```bash
# Export your certificate to .p12 format
security export certificate -t pkcs12 -k ~/Library/Keychains/login.keychain-db \
  -C "Developer ID Application: Your Name (TEAM_ID)" \
  -P "your_password" \
  -o certificate.p12

# Base64 encode it
base64 -i certificate.p12 | pbcopy
```

Paste the output as the `MACOS_CERTIFICATE` secret.

#### Generating App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Go to **Security** → **App-Specific Passwords**
4. Click **Generate Password** → Label it "Dodo Recorder CI"
5. Copy the password for `APPLE_APP_SPECIFIC_PASSWORD`

### 3. No Secrets Needed For

- **Windows builds** - Will be unsigned (for testing)
- **Linux builds** - No code signing required
- **Development testing** - Unsigned builds work fine

## Build Artifacts

After each build, artifacts are available in the Actions tab:

| Platform | Artifact Name | Contents |
|----------|---------------|----------|
| macOS ARM64 | `dodo-recorder-macos-arm64` | `.dmg`, `.zip` |
| macOS x64 | `dodo-recorder-macos-x64` | `.dmg`, `.zip` |
| Windows | `dodo-recorder-windows` | `.exe` (installer + portable) |
| Linux | `dodo-recorder-linux` | `.AppImage`, `.deb` |

Artifacts are retained for 30 days.

## Release Process

To create a release with signed builds:

1. **Manually trigger the workflow** with a release tag:
   - Go to **Actions** tab → **Build Dodo Recorder** workflow
   - Click **Run workflow**
   - Enter the release tag in the `release_tag` field (e.g., `v1.0.0`)
   - Select platforms to build (default: all platforms)
   - Click **Run workflow**

2. **Wait for builds to complete:**
   - Monitor the workflow progress
   - Artifacts will be automatically uploaded to the specified release tag

3. **Create or update the GitHub release:**
   - Go to **Releases** → Create/edit release for your tag
   - Add release notes
   - The workflow will have already attached the build artifacts

**Platform Selection:**
- To build all platforms: Select "macos-arm64,macos-x64,windows,linux"
- To build specific platforms: Choose the appropriate option (e.g., "windows" only)

**Important:** The workflow does NOT automatically run when you create a release. You must manually trigger it via the Actions tab.

## Local Testing

Before pushing, test the build locally:

```bash
# Install dependencies
npm install

# Download Whisper model
curl -L -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin

# Install Playwright browsers
./build/install-playwright-browsers.sh

# Build
npm run build
```

## Troubleshooting

### "Whisper model not found"

The workflow downloads the model automatically. If it fails:
1. Check the Hugging Face URL is accessible
2. Verify network connectivity in the runner

### "Playwright browser not installed"

The workflow runs `install-playwright-browsers.sh`. On Windows, it uses Git Bash. If it fails:
1. Verify the script is executable
2. Check Playwright installation logs

### macOS Code Signing Fails

1. Verify all secrets are set correctly
2. Check that `APPLE_TEAM_ID` matches your certificate
3. Ensure the certificate hasn't expired
4. Verify the certificate includes "Developer ID Application" capability

### Build Timeout

The workflow has a default timeout. If builds are slow:
1. Increase the timeout in the workflow file
2. Check if caching is working properly
3. Verify the Whisper model download isn't timing out

## Caching

The workflow caches:
- **npm dependencies** - Based on `package-lock.json`
- **Playwright browsers** - Based on OS and `package-lock.json`

This speeds up subsequent builds significantly.

## Security Notes

- Never commit secrets to the repository
- Use different certificates for development and production
- Rotate app-specific passwords periodically
- Review access to secrets in repository settings

## Platform-Specific Notes

### macOS
- ARM64 builds run on M1-M4 Macs
- x64 builds run on Intel Macs
- Both are built on macOS-latest runners (ARM64 by default)

### Windows
- Builds use `nsis` (installer) and `portable` (exe) targets
- No code signing by default
- Requires Git Bash for shell scripts

### Linux
- Builds `AppImage` and `deb` packages
- No code signing required
- Tested on Ubuntu, should work on most distros

## Future Improvements

Potential enhancements:
- Add Windows code signing (requires certificate)
- Add Linux AppImage signing
- Automated version bumping
- Slack/Discord notifications on build success/failure
- Smoke tests on built artifacts
