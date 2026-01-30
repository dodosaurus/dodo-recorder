# macOS Code Signing

> **Maintainer-only documentation.** Contributors don't need code signing to develop or test.

Code signing prevents macOS Gatekeeper warnings. Requires Apple Developer account and certificate.

> **CI/CD builds:** See [`docs/ci_cd.md`](ci_cd.md) for automated builds with certificate setup instructions.

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
# Then edit .env with your actual values
```

**Required credentials in `.env` file:**

```bash
# Notarization credentials (required)
APPLE_ID=your-apple-id@example.com
APPLE_APP_SPECIFIC_PASSWORD=abcd-efgh-ijkl-mnop
APPLE_TEAM_ID=L7PUGF6Q28

# Code signing: CHOOSE ONE METHOD

# METHOD 1 (RECOMMENDED): Explicit .p12 certificate file
# IMPORTANT: Use path without quotes, no comments after value
CSC_LINK=./certificate.p12
CSC_KEY_PASSWORD=your-p12-password

# METHOD 2: Explicit certificate by SHA-1 hash (from Keychain)
# CSC_NAME=2D44BC67184AC867749B23D6DB985498CAC4C0E8

# METHOD 3: Auto-discovery from Keychain (may fail if UUID-named identity)
# (Don't set CSC_LINK or CSC_NAME - electron-builder will auto-discover)
```

**Important formatting rules for `.env` file:**
- No quotes around values (unless the value itself contains spaces)
- No comments after values on the same line
- One variable per line

**Important:**
- **Method 1 (CSC_LINK)** is most reliable if you have the .p12 certificate file
- **Method 2 (CSC_NAME)** requires certificate installed in Keychain with proper "Developer ID Application" name
- **Method 3 (auto-discovery)** only works if certificate has proper name (not UUID like `edd56797-...`)

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

### Notarization fails with "HTTP status code: 403. A required agreement is missing or has expired"

**Symptoms**: `xcrun notarytool` or electron-builder notarization fails with 403 error about agreements.

**Cause**: Your Apple Developer Program agreements need to be accepted or renewed.

**Solution**:
1. Go to [Apple Developer portal](https://developer.apple.com/account)
2. Log in with your Apple ID (`APPLE_ID` from `.env`)
3. Check for banner/alert about agreements needing acceptance
4. Review and accept all required agreements (usually updated annually)
5. Wait a few minutes for changes to propagate
6. Test again: `xcrun notarytool history --apple-id "..." --password "..." --team-id "..."`

**Note**: This is **not** related to previous failed builds with unsigned binaries. It's a separate Apple Developer account administration issue.

### Notarization fails with "Unexpected token 'E', is not valid JSON"

**Symptoms**: App signs successfully but notarization fails with JSON parse error.

**Cause**: Apple's notarytool received an HTTP error instead of JSON response. Common causes:
1. Invalid or expired `APPLE_APP_SPECIFIC_PASSWORD`
2. Incorrect `APPLE_ID`
3. Expired agreements (see above - check for 403 error first)
4. Network/firewall blocking Apple's notarization servers
5. Temporary Apple service outage

**Solutions:**

1. **First check for agreement issues** (see 403 error above)

2. **Verify credentials are correct**:
   ```bash
   # Test notarization credentials manually
   xcrun notarytool history --apple-id "your-apple-id@example.com" \
     --password "your-app-specific-password" \
     --team-id "L7PUGF6Q28"
   ```
   If you get a 403 error, see above. Other errors mean invalid credentials.

3. **Check if app-specific password expired**:
   - Go to [appleid.apple.com](https://appleid.apple.com)
   - Security → App-Specific Passwords
   - Revoke old password and generate new one
   - Update `.env` file with new password

4. **Temporarily skip notarization for testing**:
   - Edit [`electron-builder.json`](../electron-builder.json:27)
   - Change `"notarize": { "teamId": "..." }` to `"notarize": false`
   - Build will complete signed but not notarized (users will see Gatekeeper warning)

5. **Check network connectivity**:
   ```bash
   # Ensure you can reach Apple's servers
   curl -I https://appstoreconnect.apple.com
   ```

### Error: "cannot find valid 'Developer ID Application' identity"

**Cause:** Certificate has UUID name (e.g., `edd56797-416a-4dcd-82cf-bc659108b334`) instead of proper "Developer ID Application: Your Name (TEAM_ID)" format.

**Solutions (choose one):**

1. **Use .p12 certificate file (RECOMMENDED):**
   ```bash
   # In .env file:
   CSC_LINK="./certificate.p12"
   CSC_KEY_PASSWORD="your-p12-password"
   ```
   This bypasses Keychain auto-discovery entirely.

2. **Use explicit certificate hash:**
   ```bash
   # Get the hash from: security find-identity -v -p codesigning
   CSC_NAME="2D44BC67184AC867749B23D6DB985498CAC4C0E8"
   ```

3. **Reinstall proper certificate:**
   - Download new Developer ID Application certificate from Apple Developer portal
   - Double-click to install in Keychain Access
   - Verify proper name: `security find-identity -v -p codesigning`
   - Should show: `"Developer ID Application: Your Name (TEAM_ID)"`

### Build skips signing with "CSC_IDENTITY_AUTO_DISCOVERY=false"

**Cause:** Setting `CSC_IDENTITY_AUTO_DISCOVERY=false` without providing explicit `CSC_LINK` or `CSC_NAME` causes electron-builder to skip signing entirely.

**Solution:** Always set explicit signing method when using `CSC_IDENTITY_AUTO_DISCOVERY=false`:
```bash
# Don't use CSC_IDENTITY_AUTO_DISCOVERY=false alone
# Instead, provide explicit certificate:
CSC_LINK="./certificate.p12"
CSC_KEY_PASSWORD="your-p12-password"
```

### Build fails after setting CSC_NAME

- Ensure certificate in Keychain Access (not just .p12 file)
- Double-check Team ID matches account
- Verify certificate is not expired: open Keychain Access and check expiration date

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
