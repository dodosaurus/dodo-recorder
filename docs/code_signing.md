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

**Check available certificates:**
```bash
security find-identity -v -p codesigning
```

Expected output:
```
1) ABC123... "Developer ID Application: Your Name (TEAM_ID)"
```

If you see UUID names instead (e.g., `"edd56797-416a-4dcd-82cf-bc659108b334"`), you need to get a proper Developer ID Application certificate from Apple Developer portal.

**Create `.env` file:**
```bash
cp .env.example .env
```

**Fill in credentials:**

For code signing and notarization, the certificate **must be installed in macOS Keychain Access**. electron-builder will auto-discover it.

```bash
# Required for notarization (automatically uploads app to Apple for security scanning)
APPLE_ID="your-apple-id@example.com"
APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
APPLE_TEAM_ID="L7PUGF6Q28"

# Optional: Only needed if auto-discovery fails
# CSC_LINK="./certificate.p12"
# CSC_KEY_PASSWORD="your-certificate-password"
# CSC_NAME="FF34B069A03716C6084F892B0958E1323565D23D"
```

**Important:**
- The Developer ID Application certificate must be installed in Keychain Access
- electron-builder will auto-discover and use it
- Only specify `CSC_LINK`/`CSC_KEY_PASSWORD`/`CSC_NAME` if auto-discovery fails

### 3. Building

**Unsigned build** (for local testing):
```bash
npm run build
```
- Fast builds
- No code signing or notarization
- For development and testing only

**Signed and notarized build** (for production distribution):
```bash
npm run build:prod
```

This will:
1. Code sign the app with your Developer ID certificate
2. Upload to Apple for notarization (takes 2-10 minutes)
3. Staple the notarization ticket to the app
4. Create DMG and ZIP files in `release/` directory

**Note:** Production builds require internet connection and take additional time (3-15 minutes) for Apple's notarization servers to process.

## Security

- **Never commit:** `.env`, `certificate.p12`, or any credentials
- Backup certificate and passwords securely
- Certificate and .env files are already gitignored

## Troubleshooting

### Error: "cannot find valid 'Developer ID Application' identity"

**Symptom:**
```
skipped macOS application code signing
reason=cannot find valid "Developer ID Application" identity
allIdentities=
  1) ABC123... "edd56797-416a-4dcd-82cf-bc659108b334"
```

**Cause:** Certificate has UUID name instead of proper "Developer ID Application: Name (Team ID)" format.

**Solutions:**

1. **Get proper Developer ID Application certificate:**
   - Go to [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates/list)
   - Create a "Developer ID Application" certificate (not iOS Development or Mac Development)
   - Download and install in Keychain Access
   - Export as `.p12` file

2. **Explicitly specify identity in `.env`:**
   ```bash
   # Add this to your .env file
   CSC_NAME="2D44BC67184AC867749B23D6DB985498CAC4C0E8"
   ```
   Use the SHA-1 hash of your valid certificate from `security find-identity -v -p codesigning`

3. **Verify certificate type:**
   ```bash
   security find-identity -v -p codesigning
   ```
   Look for entries starting with "Developer ID Application:" (not iOS/Mac Development)

### Build still fails after setting CSC_NAME

- Ensure certificate is installed in Keychain Access (not just the .p12 file)
- Double-check Team ID matches your Apple Developer account
- Try `CSC_IDENTITY_AUTO_DISCOVERY=false` in `.env` to force using CSC_NAME

## Verification

**Check code signature:**
```bash
codesign -dv --verbose=4 release/mac-arm64/Dodo\ Recorder.app
```

Expected output should include:
```
Authority=Developer ID Application: Hotovo s.r.o. (L7PUGF6Q28)
TeamIdentifier=L7PUGF6Q28
```

**Check notarization status:**
```bash
spctl -a -vv -t install release/mac-arm64/Dodo\ Recorder.app
```

Expected output for notarized app:
```
accepted
source=Notarized Developer ID
```

**Check notarization ticket:**
```bash
stapler validate release/mac-arm64/Dodo\ Recorder.app
```

Expected output:
```
The validate action worked!
```

## Technical Details

### electron-builder.json Configuration

```json
"mac": {
  "type": "distribution",        // Look for Developer ID Application certs
  "hardenedRuntime": true,       // Required for notarization
  "gatekeeperAssess": false,     // Skip Gatekeeper check during build
  "notarize": {                  // Enable Apple notarization
    "teamId": "L7PUGF6Q28"       // Your Apple Developer Team ID
  }
}
```

- `"type": "distribution"` tells electron-builder to use "Developer ID Application" certificates (for distribution outside Mac App Store)
- `"notarize": { "teamId": "..." }` enables Apple notarization for zero-warning app distribution
- `"hardenedRuntime": true` is required for notarization to work
- electron-builder reads `APPLE_ID` and `APPLE_APP_SPECIFIC_PASSWORD` from `.env` file
- If certificate is in Keychain Access, electron-builder auto-discovers it
- Environment variables (`CSC_NAME`, `CSC_LINK`, `CSC_KEY_PASSWORD`) can override auto-discovery

### Environment Variables Priority

electron-builder checks for signing credentials in this order:

1. `CSC_NAME` - Explicit certificate name or SHA-1 hash (highest priority)
2. `CSC_LINK` + `CSC_KEY_PASSWORD` - Certificate file and password
3. Auto-discovery of "Developer ID Application" in Keychain

If none are found, build continues unsigned (with warning).

## References

- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- [electron-builder Notarization](https://www.electron.build/configuration/mac#notarize)
- Configuration: [`electron-builder.json`](../electron-builder.json)
