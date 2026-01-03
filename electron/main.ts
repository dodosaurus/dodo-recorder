import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { BrowserRecorder } from './browser/recorder'
import { SessionWriter } from './session/writer'
import { Transcriber } from './audio/transcriber'

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

ipcMain.on('window-minimize', () => {
  mainWindow?.minimize()
})

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.on('window-close', () => {
  mainWindow?.close()
})

ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Output Folder for Sessions',
  })
  
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('start-recording', async (_, startUrl: string, outputPath: string) => {
  try {
    browserRecorder = new BrowserRecorder()
    sessionWriter = new SessionWriter(outputPath)
    transcriber = new Transcriber()
    
    browserRecorder.on('action', (action) => {
      mainWindow?.webContents.send('action-recorded', action)
    })
    
    await browserRecorder.start(startUrl)
    await transcriber.initialize()
    
    return { success: true }
  } catch (error) {
    console.error('Failed to start recording:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('stop-recording', async () => {
  try {
    const actions = browserRecorder?.getActions() || []
    await browserRecorder?.stop()
    browserRecorder = null
    
    return { success: true, actions }
  } catch (error) {
    console.error('Failed to stop recording:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('save-session', async (_, sessionData) => {
  try {
    if (!sessionWriter) {
      throw new Error('Session writer not initialized')
    }
    
    const sessionPath = await sessionWriter.write(sessionData)
    return { success: true, path: sessionPath }
  } catch (error) {
    console.error('Failed to save session:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('transcribe-audio', async (_, audioBuffer: ArrayBuffer) => {
  try {
    if (!transcriber) {
      transcriber = new Transcriber()
      await transcriber.initialize()
    }
    
    const segments = await transcriber.transcribe(Buffer.from(audioBuffer))
    return { success: true, segments }
  } catch (error) {
    console.error('Failed to transcribe audio:', error)
    return { success: false, error: String(error) }
  }
})
