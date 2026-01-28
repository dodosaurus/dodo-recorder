# CI/CD Build Workflow

GitHub Actions workflow for building Dodo Recorder across multiple platforms.

---

## Workflow Trigger

**Manual trigger only** via GitHub Actions UI (does NOT auto-run on release creation).

**To build:**
1. Go to **Actions** → **Build Dodo Recorder** workflow
2. Click **Run workflow**
3. Select branch (usually `main`)
4. Choose platforms from dropdown
5. Optional: Enter `release_tag` (e.g., `v1.0.0`) to upload to release
6. Click **Run workflow**

---

## Build Jobs

4 platform-specific jobs (run conditionally based on selection):
- **build-macos-arm64** - Apple Silicon
- **build-macos-x64** - Intel Macs
- **build-windows** - Windows installer + portable
- **build-linux** - AppImage + deb

**Each job:**
- Sets up Node.js 18
- Caches npm dependencies and Playwright browsers
- Installs dependencies (`npm ci`)
- Downloads Whisper model
- Builds app (`npm run build:prod`)
- Uploads artifacts (30-day retention)

**Upload job:** Runs when `release_tag` provided, attaches artifacts to GitHub release.

---

## GitHub Secrets (macOS Code Signing)

Required for signed + notarized builds:

| Secret | Description |
|--------|-------------|
| `MACOS_CERTIFICATE` | Base64-encoded Developer ID Application certificate (.p12) |
| `MACOS_CERTIFICATE_PASSWORD` | Password for the .p12 certificate |
| `APPLE_ID` | Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | Generate at appleid.apple.com |
| `APPLE_TEAM_ID` | From Apple Developer portal |

**Setup:** Settings → Secrets and variables → Actions → New repository secret

**Without secrets:** macOS builds unsigned (testing only).

### Export Certificate to Base64

To set up the `MACOS_CERTIFICATE` secret:

1. Export your Developer ID Application certificate from Keychain Access:
   - Open Keychain Access
   - Select "login" keychain
   - Find your "Developer ID Application" certificate
   - Right-click → Export → Save as .p12 file
   - Set a password (you'll need this for `MACOS_CERTIFICATE_PASSWORD`)

2. Convert the .p12 file to base64:
   ```bash
   base64 -i certificate.p12 | pbcopy
   ```

3. Add the base64 string to GitHub Secrets as `MACOS_CERTIFICATE`
4. Add the certificate password to GitHub Secrets as `MACOS_CERTIFICATE_PASSWORD`

### Generate App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Security → App-Specific Passwords
3. Generate → Label "Dodo Recorder CI"
4. Copy password for secret

---

## Build Artifacts

| Platform | Artifact | Contents |
|----------|----------|----------|
| macOS ARM64 | `dodo-recorder-macos-arm64` | .dmg, .zip |
| macOS x64 | `dodo-recorder-macos-x64` | .dmg, .zip |
| Windows | `dodo-recorder-windows` | .exe (installer + portable) |
| Linux | `dodo-recorder-linux` | .AppImage, .deb |

Retained 30 days in Actions tab.

---

## Local Testing

```bash
npm install
curl -L -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin
./build/install-playwright-browsers.sh
npm run build
```

---

## Troubleshooting

**Whisper model not found:**
- Check Hugging Face URL accessible
- Verify network connectivity

**Playwright browser not installed:**
- Verify script executable
- Check Playwright installation logs

**macOS code signing fails:**
- Verify all secrets are set correctly
- Check `APPLE_TEAM_ID` matches certificate
- Ensure certificate includes "Developer ID Application"
- Verify `MACOS_CERTIFICATE` is valid base64-encoded .p12 content
- Verify `MACOS_CERTIFICATE_PASSWORD` matches the password used when exporting the certificate

**Error: "not a file" during build:**
- This indicates `MACOS_CERTIFICATE` secret is not set or is invalid
- Ensure you exported the certificate as .p12 and converted to base64
- Check the secret value doesn't have extra whitespace or newlines

**Build timeout:**
- Increase timeout in workflow file
- Check caching working
- Verify Whisper download not timing out

---

## Platform Notes

**macOS:** ARM64 builds for M1-M4, x64 for Intel (both built on macOS-latest runners)

**Windows:** NSIS installer + portable exe, no code signing, requires Git Bash for scripts

**Linux:** AppImage + deb, no code signing
