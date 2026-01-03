import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  selectOutputFolder: () => Promise<string | null>
  startRecording: (startUrl: string, outputPath: string) => Promise<{ success: boolean; error?: string }>
  stopRecording: () => Promise<{ success: boolean; actions?: unknown[]; error?: string }>
  saveSession: (sessionData: unknown) => Promise<{ success: boolean; path?: string; error?: string }>
  transcribeAudio: (audioBuffer: ArrayBuffer) => Promise<{ success: boolean; segments?: unknown[]; error?: string }>
  onActionRecorded: (callback: (action: unknown) => void) => () => void
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
}

const electronAPI: ElectronAPI = {
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
  
  startRecording: (startUrl: string, outputPath: string) => 
    ipcRenderer.invoke('start-recording', startUrl, outputPath),
  
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  
  saveSession: (sessionData: unknown) => 
    ipcRenderer.invoke('save-session', sessionData),
  
  transcribeAudio: (audioBuffer: ArrayBuffer) =>
    ipcRenderer.invoke('transcribe-audio', audioBuffer),
  
  onActionRecorded: (callback: (action: unknown) => void) => {
    const handler = (_: unknown, action: unknown) => callback(action)
    ipcRenderer.on('action-recorded', handler)
    return () => ipcRenderer.removeListener('action-recorded', handler)
  },

  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
