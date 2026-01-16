# Installation Guide

## macOS Installation

### Quick Start

1. **Download** the latest release from [GitHub Releases](https://github.com/dodosaurus/dodo-recorder/releases)
2. **Open** the `.dmg` file and drag **Dodo Recorder** to Applications
3. **Remove quarantine flag** (required for first launch):
   ```bash
   xattr -cr /Applications/Dodo\ Recorder.app
   ```
4. **Launch** the app from Applications

---

## Detailed Installation Steps

### Step 1: Download the App

Visit the [Releases page](https://github.com/dodosaurus/dodo-recorder/releases) and download the appropriate file:

- **Recommended**: `dodo-recorder-x.x.x-mac.dmg` (Disk Image)
- **Alternative**: `dodo-recorder-x.x.x-mac.zip` (Compressed Archive)

### Step 2: Install the App

**For .dmg files:**
1. Double-click the downloaded `.dmg` file
2. A window opens showing **Dodo Recorder** and the **Applications** folder
3. Drag **Dodo Recorder** to the **Applications** folder
4. Eject the disk image (right-click → Eject)

**For .zip files:**
1. Double-click the downloaded `.zip` file to extract
2. Move **Dodo Recorder.app** to your **Applications** folder

### Step 3: Fix "App is Damaged" Error

When you first try to launch Dodo Recorder, macOS will likely show one of these errors:

> **"Dodo Recorder" is damaged and can't be opened. You should move it to the Trash.**

or

> **"Dodo Recorder" cannot be opened because the developer cannot be verified.**

This is **not** a real problem with the app—it's macOS Gatekeeper blocking unsigned applications.

**Choose one of the solutions below:**

#### Solution A: Remove Quarantine Flag (Recommended) ⭐

Open **Terminal** (Applications → Utilities → Terminal) and run:

```bash
xattr -cr /Applications/Dodo\ Recorder.app
```

This removes the quarantine flag that macOS adds to downloaded apps. You only need to do this **once**.

**What this command does:**
- `xattr` - manages extended file attributes
- `-c` - clears all attributes
- `-r` - applies recursively to all files in the app bundle
- No system changes, only affects this app

#### Solution B: Override Gatekeeper (Alternative)

1. Locate **Dodo Recorder** in your Applications folder
2. **Right-click** (or Control+click) on the app
3. Hold the **Option (⌥)** key
4. Click **Open**
5. In the dialog that appears, click **Open** again

This creates a permanent Gatekeeper exception for the app.

#### Solution C: System Preferences (If Above Don't Work)

1. Try to open the app normally (it will be blocked)
2. Open **System Preferences** → **Security & Privacy**
3. Click the **General** tab
4. You'll see a message: _"Dodo Recorder was blocked from use because it is not from an identified developer"_
5. Click **Open Anyway**
6. Confirm by clicking **Open**

---

## Why Is This Necessary?

### The Short Answer

Dodo Recorder is currently **unsigned** because code signing requires an Apple Developer account, which costs $99/year. As an open-source project in its early stages, we haven't secured funding for this yet.

### The Long Answer

**What is code signing?**
- Apple's way of verifying that apps come from trusted developers
- Requires purchasing an Apple Developer membership ($99/year)
- Necessary for distributing apps outside the Mac App Store

**Is it safe to bypass this warning?**
- **Yes**, if you download from the official GitHub repository
- The source code is public and can be audited
- Many successful open-source projects start unsigned (Hyper Terminal, VSCodium, etc.)

**What about in the future?**
- We're exploring community funding options (GitHub Sponsors)
- Considering Homebrew Cask distribution (no signing required)
- Once the project is more established, we plan to provide signed releases

---

## Troubleshooting

### "Operation not permitted" when running xattr command

**Cause:** Terminal doesn't have permission to modify the Applications folder.

**Solution:**
1. Open **System Preferences** → **Security & Privacy** → **Privacy** tab
2. Select **Full Disk Access** from the left sidebar
3. Click the lock icon to make changes (enter your password)
4. Click **+** and add **Terminal**
5. Try the `xattr` command again

### App still won't open after removing quarantine flag

**Try these steps:**

1. **Verify the command worked:**
   ```bash
   xattr /Applications/Dodo\ Recorder.app
   ```
   Should return nothing (no attributes).

2. **Restart your Mac** and try opening the app again

3. **Check file permissions:**
   ```bash
   ls -la@ /Applications/Dodo\ Recorder.app
   ```

4. **Re-download** the app (file might be corrupted):
   - Delete the current version
   - Clear browser cache
   - Download fresh from GitHub Releases

### "Whisper model not found" error after installation

**Cause:** The Whisper model file wasn't included in the release build (this shouldn't happen, but if it does):

1. Check if the model file exists:
   ```bash
   ls -lh /Applications/Dodo\ Recorder.app/Contents/Resources/models/
   ```

2. If `ggml-small.en.bin` is missing, download it manually:
   ```bash
   curl -L -o ~/Downloads/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin
   ```

3. Copy to the app bundle:
   ```bash
   cp ~/Downloads/ggml-small.en.bin /Applications/Dodo\ Recorder.app/Contents/Resources/models/
   ```

### App crashes on launch

1. **Check Console logs:**
   - Open **Console.app** (Applications → Utilities)
   - Filter for "Dodo Recorder"
   - Look for error messages

2. **Verify macOS version:**
   - Dodo Recorder requires **macOS 10.15 (Catalina) or later**
   - Check: Apple menu →  About This Mac

3. **Check for conflicts:**
   - Antivirus software might block the app
   - Try temporarily disabling security software

4. **Report the issue:**
   - Open an issue on [GitHub Issues](https://github.com/dodosaurus/dodo-recorder/issues)
   - Include Console.app logs and your macOS version

---

## Verification

After installation, verify the app is working:

1. **Launch** Dodo Recorder from Applications
2. You should see the **main window** with recording controls
3. **Test**: Enter a URL (e.g., `https://example.com`) and click **Start Recording**
4. A browser window should open

If everything works, you're ready to start recording! 🎉

---

### Building from Source

If you prefer to build from source:

1. **Prerequisites:**
   - Node.js 18+
   - Git

2. **Clone and build:**
   ```bash
   git clone https://github.com/dodosaurus/dodo-recorder.git
   cd dodo-recorder
   npm install
   
   # Download Whisper model (required)
   curl -L -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin
   
   # Run in development mode
   npm run dev
   
   # Or build for production
   npm run electron:build
   ```

3. Built app will be in the `release/` folder

See [`README.md`](../README.md) for full development setup instructions.

---

## Windows & Linux (Coming Soon)

> **Note:** The current release (v0.1.0) supports **macOS only**.

Windows and Linux builds are planned for a future release. The codebase is designed to be cross-platform compatible.

**Expected future installers:**
- **Windows**: `.exe` installer or portable executable
- **Linux**: AppImage or `.deb` package

Track progress: Check the [project roadmap](https://github.com/dodosaurus/dodo-recorder/issues) for updates.

---

## Need Help?

- **Documentation**: Check the [User Guide](user_guide.md) for features and usage
- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/dodosaurus/dodo-recorder/issues)
- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/dodosaurus/dodo-recorder/discussions)

---

## Privacy & Security

**Is it safe to run an unsigned app?**

Dodo Recorder is:
- ✅ **Open source** - All code is public on GitHub
- ✅ **No telemetry** - No data collection or tracking
- ✅ **Local processing** - Voice transcription runs entirely on your machine
- ✅ **No network requirements** - Works completely offline after installation

You can audit the source code yourself or build from source if you prefer.

**Best practices:**
- Always download from the [official GitHub repository](https://github.com/dodosaurus/dodo-recorder)
- Verify download checksums when available
- Review the source code if you have concerns

---

## System Requirements

- **macOS**: 10.15 (Catalina) or later
- **RAM**: 2 GB minimum (4 GB recommended for transcription)
- **Disk Space**: 1 GB for app + model files
- **Microphone**: Required for voice commentary feature
- **Internet**: Required only for initial download

---

## License

Dodo Recorder is open-source software licensed under the MIT License.

See [`LICENSE`](../LICENSE) for full license text.
