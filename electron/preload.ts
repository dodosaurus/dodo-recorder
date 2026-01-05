import { contextBridge, ipcRenderer } from 'electron'
import type { RecordedAction, SessionBundle, TranscriptSegment, IpcResult } from '../shared/types'

export interface ElectronAPI {
  selectOutputFolder: () => Promise<string | null>
  startRecording: (startUrl: string, outputPath: string) => Promise<IpcResult>
  stopRecording: () => Promise<IpcResult<{ actions: RecordedAction[] }>>
  saveSession: (sessionData: SessionBundle) => Promise<IpcResult<{ path: string }>>
  transcribeAudio: (audioBuffer: ArrayBuffer) => Promise<IpcResult<{ segments: TranscriptSegment[] }>>
  checkMicrophonePermission: () => Promise<{ granted: boolean; denied?: boolean }>
  onActionRecorded: (callback: (action: RecordedAction) => void) => () => void
  distributeVoiceSegments: (actions: RecordedAction[], segments: TranscriptSegment[], startTime: number) => Promise<IpcResult<{ actions: RecordedAction[] }>>
  generateFullTranscript: (segments: TranscriptSegment[]) => Promise<IpcResult<{ transcript: string }>>
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
}

const electronAPI: ElectronAPI = {
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
  
  startRecording: (startUrl: string, outputPath: string) =>
    ipcRenderer.invoke('start-recording', startUrl, outputPath),
  
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  
  saveSession: (sessionData: SessionBundle) =>
    ipcRenderer.invoke('save-session', sessionData),
  
  transcribeAudio: (audioBuffer: ArrayBuffer) =>
    ipcRenderer.invoke('transcribe-audio', audioBuffer),

  checkMicrophonePermission: () =>
    ipcRenderer.invoke('check-microphone-permission'),
  
  onActionRecorded: (callback: (action: RecordedAction) => void) => {
    const handler = (_: unknown, action: RecordedAction) => callback(action)
    ipcRenderer.on('action-recorded', handler)
    return () => ipcRenderer.removeListener('action-recorded', handler)
  },

  distributeVoiceSegments: (actions: RecordedAction[], segments: TranscriptSegment[], startTime: number) =>
    ipcRenderer.invoke('distribute-voice-segments', actions, segments, startTime),

  generateFullTranscript: (segments: TranscriptSegment[]) =>
    ipcRenderer.invoke('generate-full-transcript', segments),

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
