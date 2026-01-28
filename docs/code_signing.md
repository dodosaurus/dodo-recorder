# macOS Code Signing

> **Maintainer-only documentation.** Contributors don't need code signing to develop or test.

Code signing prevents macOS Gatekeeper warnings. Requires Apple Developer account and certificate.

> **CI/CD builds:** See [`docs/ci_cd.md`](ci_cd.md) for automated builds.

---

## Setup

### Prerequisites

- Apple Developer account
- Developer ID Application certificate (.p12 file)
- App-specific password from [appleid.apple.com](https://appleid.apple.com/)

### Configuration

**Check certificates:**
```bash
security find-identity -v -p codesigning
```

Expected: `"Developer ID Application: Your Name (TEAM_ID)"`

If UUID names (e.g., `"edd56797-..."`), get proper Developer ID Application certificate from Apple Developer portal.

**Create `.env` file:**
```bash
cp .env.example .env
```

**Required credentials:**
```bash
# Notarization (uploads app to Apple for security scanning)
APPLE_ID="your-apple-id@example.com"
APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
APPLE_TEAM_ID="L7PUGF6Q28"

# Optional: Only if auto-discovery fails
# CSC_LINK="./certificate.p12"
# CSC_KEY_PASSWORD="your-password"
# CSC_NAME="FF34B069A03716C6084F892B0958E1323565D23D"
```

**Important:** Certificate must be installed in macOS Keychain Access. electron-builder auto-discovers it.

### Building

**Unsigned (testing):**
```bash
npm run build
```

**Signed + notarized (distribution):**
```bash
npm run build:prod
```

Takes 3-15 minutes for Apple's notarization servers. Requires internet connection.

---

## Troubleshooting

### Error: "cannot find valid 'Developer ID Application' identity"

**Cause:** Certificate has UUID name instead of proper format.

**Solutions:**
1. Get proper Developer ID Application certificate from Apple Developer portal
2. Specify identity in `.env`: `CSC_NAME="2D44BC67184AC867749B23D6DB985498CAC4C0E8"`
3. Verify: `security find-identity -v -p codesigning`

### Build fails after setting CSC_NAME

- Ensure certificate in Keychain Access (not just .p12 file)
- Double-check Team ID matches account
- Try `CSC_IDENTITY_AUTO_DISCOVERY=false` in `.env`

---

## Verification

```bash
# Check signature
codesign -dv --verbose=4 release/mac-arm64/Dodo\ Recorder.app

# Check notarization
spctl -a -vv -t install release/mac-arm64/Dodo\ Recorder.app
# Expected: "accepted" + "source=Notarized Developer ID"

# Check ticket
stapler validate release/mac-arm64/Dodo\ Recorder.app
# Expected: "The validate action worked!"
```

---

## Technical Details

**electron-builder.json config:**
```json
"mac": {
  "type": "distribution",        // Developer ID Application certs
  "hardenedRuntime": true,       // Required for notarization
  "gatekeeperAssess": false,
  "notarize": {
    "teamId": "L7PUGF6Q28"
  }
}
```

**Environment variable priority:**
1. `CSC_NAME` - Explicit certificate (highest priority)
2. `CSC_LINK` + `CSC_KEY_PASSWORD` - Certificate file
3. Auto-discovery in Keychain

If none found, build continues unsigned.

---

## Security

- Never commit `.env`, `certificate.p12`, or credentials
- Backup certificate and passwords securely
- Files already gitignored

---

## References

- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- Configuration: [`electron-builder.json`](../electron-builder.json)
