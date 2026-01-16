import { app, BrowserWindow, ipcMain, dialog, systemPreferences, session } from 'electron'
import path from 'path'
import fs from 'fs'
import { cleanupOldTempFiles } from './utils/fs'
import { logger } from './utils/logger'
import { getSettingsStore } from './settings/store'
import { updateTimeWindows } from './utils/voiceDistribution'
import { registerAllHandlers } from './ipc/handlers'

let mainWindow: BrowserWindow | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const isMac = process.platform === 'darwin'
const ALLOWED_PERMISSIONS = ['media', 'microphone', 'audioCapture'] as const

async function requestMicrophonePermission(): Promise<boolean> {
  if (isMac) {
    const status = systemPreferences.getMediaAccessStatus('microphone')
    if (status === 'granted') return true
    if (status === 'denied') {
      logger.error('Microphone access denied. Please enable it in System Preferences > Privacy & Security > Microphone')
      return false
    }
    return await systemPreferences.askForMediaAccess('microphone')
  }
  return true
}

function setupPermissionHandlers() {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (ALLOWED_PERMISSIONS.includes(permission as any)) {
      callback(true)
    } else {
      callback(false)
    }
  })

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return ALLOWED_PERMISSIONS.includes(permission as any)
  })
}

/**
 * Check if Whisper components exist and show helpful error if missing
 */
function checkWhisperComponents(): boolean {
  const appPath = app.isPackaged
    ? process.resourcesPath
    : app.getAppPath()
  const modelPath = path.join(appPath, 'models', 'ggml-small.en.bin')
  const binaryPath = path.join(appPath, 'models', 'whisper')
  
  // Check binary
  if (!fs.existsSync(binaryPath)) {
    logger.error('❌ Whisper binary not found at:', binaryPath)
    
    dialog.showMessageBoxSync({
      type: 'error',
      title: 'Whisper Binary Missing',
      message: 'Whisper binary file not found',
      detail:
        'The whisper binary should be in the repository.\n\n' +
        'Binary expected at:\n' +
        binaryPath + '\n\n' +
        'This file should be committed to git. Please ensure you have the latest code.',
      buttons: ['Exit']
    })
    
    return false
  }
  
  // Check model
  if (!fs.existsSync(modelPath)) {
    logger.error('❌ Whisper model not found at:', modelPath)
    
    const downloadCommand = 'curl -L -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin'
    
    dialog.showMessageBoxSync({
      type: 'error',
      title: 'Whisper Model Missing',
      message: 'Whisper model file not found',
      detail:
        'The application requires the Whisper model to transcribe voice recordings.\n\n' +
        'Model file expected at:\n' +
        modelPath + '\n\n' +
        'To download the model, run this command in your terminal:\n\n' +
        downloadCommand + '\n\n' +
        'Or download manually from:\n' +
        'https://huggingface.co/ggerganov/whisper.cpp/tree/main',
      buttons: ['Exit']
    })
    
    return false
  }
  
  const stats = fs.statSync(modelPath)
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
  logger.info(`✅ Whisper binary and model found (model: ${sizeMB} MB)`)
  return true
}

async function createWindow() {
  setupPermissionHandlers()
  await requestMicrophonePermission()

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0b',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    titleBarOverlay: !isMac ? false : undefined,
    frame: isMac,
    trafficLightPosition: isMac ? { x: 16, y: 10 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Register all IPC handlers after window is created
  registerAllHandlers(mainWindow)
}

app.whenReady().then(async () => {
  // Check if Whisper components exist
  if (!checkWhisperComponents()) {
    app.quit()
    return
  }
  
  // Initialize settings
  const settings = getSettingsStore()
  
  // Apply voice distribution settings
  updateTimeWindows(settings.getVoiceDistributionConfig())
  
  // Clean up old temp files on startup (older than 24 hours)
  const tempDir = path.join(app.getPath('temp'), 'dodo-recorder')
  await cleanupOldTempFiles(tempDir, 24 * 60 * 60 * 1000)
  
  await createWindow()
})

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.handle('check-microphone-permission', async () => {
  if (isMac) {
    const status = systemPreferences.getMediaAccessStatus('microphone')
    if (status === 'granted') return { granted: true }
    if (status === 'denied') return { granted: false, denied: true }
    const granted = await systemPreferences.askForMediaAccess('microphone')
    return { granted }
  }
  return { granted: true }
})

ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window-close', () => mainWindow?.close())

// Simple IPC handlers that don't need extraction
ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Output Folder for Sessions',
  })
  if (result.canceled) return null
  return result.filePaths[0]
})
