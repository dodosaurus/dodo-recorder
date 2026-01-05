import { app, BrowserWindow, ipcMain, dialog, systemPreferences, session } from 'electron'
import path from 'path'
import { BrowserRecorder } from './browser/recorder'
import { SessionWriter } from './session/writer'
import { Transcriber } from './audio/transcriber'
import { handleIpc, ipcError, ipcSuccess } from './utils/ipc'
import { validateUrl, validateOutputPath, validateAudioBuffer } from './utils/validation'
import { distributeVoiceSegments, generateFullTranscript } from './utils/voiceDistribution'
import type { SessionBundle, RecordedAction, TranscriptSegment } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let browserRecorder: BrowserRecorder | null = null
let transcriber: Transcriber | null = null
let sessionWriter: SessionWriter | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const isMac = process.platform === 'darwin'
const ALLOWED_PERMISSIONS = ['media', 'microphone', 'audioCapture'] as const

async function requestMicrophonePermission(): Promise<boolean> {
  if (isMac) {
    const status = systemPreferences.getMediaAccessStatus('microphone')
    if (status === 'granted') return true
    if (status === 'denied') {
      console.error('Microphone access denied. Please enable it in System Preferences > Privacy & Security > Microphone')
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
}

app.whenReady().then(createWindow)

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

ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Output Folder for Sessions',
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('start-recording', async (_, startUrl: string, outputPath: string) => {
  const urlValidation = validateUrl(startUrl)
  if (!urlValidation.valid) {
    return ipcError(urlValidation.error, 'URL validation failed')
  }

  const pathValidation = validateOutputPath(outputPath)
  if (!pathValidation.valid) {
    return ipcError(pathValidation.error, 'Path validation failed')
  }

  return handleIpc(async () => {
    browserRecorder = new BrowserRecorder()
    sessionWriter = new SessionWriter(outputPath)
    transcriber = new Transcriber()

    browserRecorder.on('action', (action) => {
      mainWindow?.webContents.send('action-recorded', action)
    })

    await browserRecorder.start(startUrl)
    await transcriber.initialize()

    return {}
  }, 'Failed to start recording')
})

ipcMain.handle('stop-recording', async () => {
  return handleIpc(async () => {
    const actions = browserRecorder?.getActions() || []
    await browserRecorder?.stop()
    browserRecorder = null
    return { actions }
  }, 'Failed to stop recording')
})

ipcMain.handle('save-session', async (_, sessionData: SessionBundle) => {
  console.log('[IPC] Saving session...')
  
  if (!sessionWriter) {
    console.error('[IPC] Session writer not initialized')
    return ipcError('Session writer not initialized')
  }

  if (!sessionData?.metadata?.id) {
    console.error('[IPC] Invalid session data: missing metadata.id')
    return ipcError('Invalid session data: missing metadata.id')
  }

  console.log(`[IPC] Session has ${sessionData.actions.length} actions, ${sessionData.transcript.length} transcript segments`)
  
  return handleIpc(async () => {
    const sessionPath = await sessionWriter!.write(sessionData)
    console.log('[IPC] Session saved to:', sessionPath)
    return { path: sessionPath }
  }, 'Failed to save session')
})

ipcMain.handle('transcribe-audio', async (_, audioBuffer: ArrayBuffer) => {
  const bufferValidation = validateAudioBuffer(audioBuffer)
  if (!bufferValidation.valid) {
    return ipcError(bufferValidation.error, 'Audio validation failed')
  }

  return handleIpc(async () => {
    if (!transcriber) {
      transcriber = new Transcriber()
      await transcriber.initialize()
    }
    const segments = await transcriber.transcribe(Buffer.from(audioBuffer))
    return { segments }
  }, 'Failed to transcribe audio')
})

ipcMain.handle('distribute-voice-segments', async (
  _,
  actions: RecordedAction[],
  segments: TranscriptSegment[],
  startTime: number
) => {
  console.log(`[IPC] Distributing ${segments.length} voice segments across ${actions.length} actions`)
  return handleIpc(async () => {
    const actionsWithVoice = distributeVoiceSegments(actions, segments, startTime)
    console.log(`[IPC] Distribution complete, ${actionsWithVoice.length} actions with voice`)
    return { actions: actionsWithVoice }
  }, 'Failed to distribute voice segments')
})

ipcMain.handle('generate-full-transcript', async (_, segments: TranscriptSegment[]) => {
  return handleIpc(async () => {
    const transcript = generateFullTranscript(segments)
    return { transcript }
  }, 'Failed to generate transcript')
})
