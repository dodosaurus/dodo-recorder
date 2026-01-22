# Logging and Debugging in Dodo Recorder

This guide explains how to access and use logs for debugging Dodo Recorder, especially for production builds where issues are harder to diagnose.

## Quick Access to Logs

### In-App Log Access (Easiest)

The app now includes built-in buttons to access logs:

1. **View Logs button** - Opens the log file in your default text editor
2. **Folder icon** - Opens the logs folder in Finder/Explorer

These buttons are located in the **bottom-right of the status bar** (bottom of the app window).

### Manual Log File Locations

If you need to access logs manually, they are stored in standard OS locations:

**macOS:**
```
~/Library/Logs/dodo-recorder/main.log
```

**Windows:**
```
%USERPROFILE%\AppData\Roaming\dodo-recorder\logs\main.log
```

**Linux:**
```
~/.config/dodo-recorder/logs/main.log
```

### Opening Logs Manually

**macOS:**
```bash
# View logs in terminal
tail -f ~/Library/Logs/dodo-recorder/main.log

# Open in default text editor
open ~/Library/Logs/dodo-recorder/main.log

# Open logs folder in Finder
open ~/Library/Logs/dodo-recorder/
```

**Windows (PowerShell):**
```powershell
# View logs
Get-Content "$env:USERPROFILE\AppData\Roaming\dodo-recorder\logs\main.log" -Tail 50 -Wait

# Open in Notepad
notepad "$env:USERPROFILE\AppData\Roaming\dodo-recorder\logs\main.log"
```

**Linux:**
```bash
# View logs
tail -f ~/.config/dodo-recorder/logs/main.log

# Open logs folder
xdg-open ~/.config/dodo-recorder/logs/
```

## Understanding Log Output

### Log Levels

The app uses four log levels:

- **ERROR** - Critical errors that prevent functionality
- **WARN** - Warnings about potential issues
- **INFO** - Normal operational messages (production default)
- **DEBUG** - Detailed debugging information (development only)

### Log Format

```
[YYYY-MM-DD HH:MM:SS.mmm] [LEVEL] Message
```

Example:
```
[2026-01-16 11:30:15.234] [INFO] Dodo Recorder Starting
[2026-01-16 11:30:15.245] [INFO] App Version: 0.1.0
[2026-01-16 11:30:20.567] [ERROR] Failed to start recording: URL validation failed
```

### Key Log Sections

#### 1. Startup Information
```
================================================================================
Dodo Recorder Starting
================================================================================
App Version: 0.1.0
Electron: 28.x.x
Chrome: 120.x.x
Node: 18.x.x
Platform: darwin arm64
Environment: production
Log File: /Users/xxx/Library/Logs/dodo-recorder/main.log
================================================================================
```

#### 2. Recording Lifecycle
```
[INFO] 🎬 startRecording() called
[INFO]   startUrl: https://example.com
[INFO]   outputPath: /Users/xxx/sessions
[INFO]   isVoiceEnabled: true
[INFO] 🎤 Voice recording enabled - checking microphone permission...
[INFO] 🎤 Microphone permission result: {"granted":true}
[INFO] 🌐 Starting browser recording...
[INFO] ✅ Recording started successfully
```

#### 3. Error Messages
```
[ERROR] ❌ Cannot start recording - preconditions not met
[ERROR]   canStart: false
[ERROR]   electronAPI available: true
[ERROR] Failed to start recording: Browser launch failed
```

## Debugging "Start Recording" Does Nothing

If clicking "Start Recording" does nothing, check the logs for:

### 1. Precondition Failures

Look for:
```
❌ Cannot start recording - preconditions not met
```

**Common causes:**
- URL not entered
- Output folder not selected
- Status not 'idle'

**Solution:** Ensure you've entered a valid URL and selected an output folder.

### 2. Browser Launch Failures

Look for:
```
Failed to start recording: Browser launch failed
```

**Common causes:**
- Playwright browser not properly installed
- Permissions issues on macOS
- Missing Chromium dependencies

**Solutions:**
```bash
# Reinstall dependencies
npm install

# Check Playwright browsers
npx playwright install chromium
```

### 3. Microphone Permission Issues

Look for:
```
❌ Microphone permission denied
```

**Solution on macOS:**
1. Open **System Settings** > **Privacy & Security** > **Microphone**
2. Enable microphone access for **Dodo Recorder**
3. Restart the app

### 4. IPC Communication Failures

Look for:
```
❌ Exception during startRecording IPC call
```

**This indicates a serious issue with the Electron IPC bridge.**

**Solutions:**
- Try quitting and restarting the app completely
- Check if you're running the latest version
- Report as a bug with full log file

## Debugging Whisper/Transcription Issues

### Missing Model File

Look for:
```
❌ Whisper model not found at: /path/to/models/ggml-small.en.bin
```

**Solution:**
```bash
curl -L -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin
```

### Transcription Failures

Look for:
```
❌ Transcription failed: Whisper process exited with code 1
```

**Common causes:**
- Corrupted audio data
- Whisper binary not executable
- Model file corrupted

## Development vs Production Logging

### Development Mode

When running `npm run dev`:
- **Console logging:** Full debug output in terminal
- **File logging:** All levels including DEBUG
- **Log location:** Same as production

### Production Mode

When running the built app:
- **Console logging:** Errors only (won't see in UI)
- **File logging:** INFO level and above
- **Log location:** Standard OS locations

## Console Logs (Renderer Process)

The React app (renderer process) also logs to the **browser DevTools console**.

### Accessing DevTools in Production

**Method 1:** Menu
- macOS: View > Toggle Developer Tools (if available)

**Method 2:** Keyboard shortcut
- macOS: `Cmd+Option+I`
- Windows/Linux: `Ctrl+Shift+I`

**Method 3:** Force enable in code
Edit [`electron/main.ts`](electron/main.ts:1) and add:
```typescript
mainWindow.webContents.openDevTools()
```

### Renderer Process Logs

Look for logs in DevTools console:
```
🎬 startRecording() called
  canStart: true
  startUrl: https://example.com
  outputPath: /Users/xxx/sessions
  status: idle
  isVoiceEnabled: true
  window.electronAPI: true
⏰ Recording start time set: 1705408815234
🎤 Voice recording enabled - checking microphone permission...
```

## Common Issues and Solutions

### Issue: "Nothing happens when I click Start Recording"

**Debug steps:**
1. Check console logs in DevTools (`Cmd+Option+I`)
2. Check main process logs (see [Log File Locations](#manual-log-file-locations))
3. Verify URL and output path are set
4. Check for error messages in either log

### Issue: "Browser window doesn't open"

**Check logs for:**
- Playwright launch errors
- Permission errors
- Port conflicts

**Try:**
```bash
# Clean reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Audio recording fails"

**Check logs for:**
- Microphone permission denied
- MediaRecorder not supported
- Audio device access errors

**Try:**
- Grant microphone permissions in System Settings
- Try without voice recording enabled
- Check that microphone works in other apps

## Reporting Bugs

When reporting issues, always include:

1. **App version** (from logs or About dialog)
2. **Operating system** (macOS version, Windows version, etc.)
3. **Full log file** (last 100 lines minimum)
4. **Steps to reproduce** the issue
5. **DevTools console output** (if relevant)

### Collecting Logs for Bug Report

**macOS:**
```bash
# Copy last 200 lines to clipboard
tail -n 200 ~/Library/Logs/dodo-recorder/main.log | pbcopy
```

**Or use the "View Logs" button in the app and copy relevant sections.**

## Advanced Debugging

### Enable Verbose Logging

Edit [`electron/utils/logger.ts`](electron/utils/logger.ts:1):

```typescript
// Change production log level to debug
if (isDevelopment) {
  log.transports.file.level = 'debug'
  log.transports.console.level = 'debug'
} else {
  log.transports.file.level = 'debug'  // Was 'info'
  log.transports.console.level = 'debug'  // Was 'error'
}
```

Then rebuild:
```bash
npm run build
```

### Log Rotation

Logs automatically rotate when they exceed **10 MB**. Old logs are renamed with timestamps:
```
main.log
main.old.log
```

### Clearing Old Logs

```bash
# macOS
rm ~/Library/Logs/dodo-recorder/*.log

# Windows
del "%USERPROFILE%\AppData\Roaming\dodo-recorder\logs\*.log"

# Linux
rm ~/.config/dodo-recorder/logs/*.log
```

## For Developers

### Adding More Logging

The logger is imported as:
```typescript
import { logger } from './utils/logger'
```

Usage:
```typescript
logger.debug('Detailed debugging info')  // Development only
logger.info('Normal operation')          // Always logged
logger.warn('Warning message')           // Always logged
logger.error('Error message')            // Always logged
```

### Logging Best Practices

1. **Use appropriate log levels**
   - DEBUG: Detailed variable dumps, internal state
   - INFO: User actions, successful operations
   - WARN: Recoverable errors, deprecated features
   - ERROR: Failures, exceptions

2. **Include context**
   ```typescript
   logger.info('Recording started', { url, outputPath, startTime })
   ```

3. **Use emojis for visibility** (in development)
   ```typescript
   logger.info('🎬 Starting recording...')
   logger.error('❌ Recording failed')
   ```

4. **Log state transitions**
   ```typescript
   logger.info(`Status changed: ${oldStatus} -> ${newStatus}`)
   ```

## Summary

- **Easiest access:** Use the "View Logs" button in the app's status bar
- **Log location (macOS):** `~/Library/Logs/dodo-recorder/main.log`
- **DevTools console:** `Cmd+Option+I` for renderer process logs
- **Key logs to check:** Startup info, recording lifecycle, error messages
- **For bugs:** Always include full logs and steps to reproduce
