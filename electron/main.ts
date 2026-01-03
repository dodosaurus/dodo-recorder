import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { BrowserRecorder } from './browser/recorder'
import { SessionWriter } from './session/writer'
import { Transcriber } from './audio/transcriber'
import { handleIpc, ipcError, ipcSuccess } from './utils/ipc'
import { validateUrl, validateOutputPath, validateAudioBuffer } from './utils/validation'
import type { SessionBundle } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let browserRecorder: BrowserRecorder | null = null
let transcriber: Transcriber | null = null
let sessionWriter: SessionWriter | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const isMac = process.platform === 'darwin'

async function createWindow() {
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
  if (!sessionWriter) {
    return ipcError('Session writer not initialized')
  }

  if (!sessionData?.metadata?.id) {
    return ipcError('Invalid session data: missing metadata.id')
  }

  return handleIpc(async () => {
    const sessionPath = await sessionWriter!.write(sessionData)
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
