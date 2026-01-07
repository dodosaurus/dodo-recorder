import { contextBridge, ipcRenderer } from 'electron'
import type { RecordedAction, SessionBundle, TranscriptSegment, IpcResult } from '../shared/types'

export interface UserPreferences {
  startUrl: string
  outputPath: string
}

/**
 * Validates that data conforms to RecordedAction interface
 */
function isValidRecordedAction(data: unknown): data is RecordedAction {
  if (!data || typeof data !== 'object') return false
  
  const action = data as Partial<RecordedAction>
  
  return (
    typeof action.id === 'string' &&
    typeof action.timestamp === 'number' &&
    typeof action.type === 'string' &&
    ['click', 'fill', 'navigate', 'keypress', 'select', 'check', 'scroll', 'assert', 'screenshot'].includes(action.type)
  )
}

export interface ElectronAPI {
  selectOutputFolder: () => Promise<string | null>
  startRecording: (startUrl: string, outputPath: string, startTime: number) => Promise<IpcResult>
  stopRecording: () => Promise<IpcResult<{ actions: RecordedAction[] }>>
  saveSession: (sessionData: SessionBundle) => Promise<IpcResult<{ path: string }>>
  transcribeAudio: (audioBuffer: ArrayBuffer) => Promise<IpcResult<{ segments: TranscriptSegment[] }>>
  checkMicrophonePermission: () => Promise<{ granted: boolean; denied?: boolean }>
  onActionRecorded: (callback: (action: RecordedAction) => void) => () => void
  distributeVoiceSegments: (actions: RecordedAction[], segments: TranscriptSegment[], startTime: number) => Promise<IpcResult<{ actions: RecordedAction[] }>>
  generateFullTranscript: (segments: TranscriptSegment[]) => Promise<IpcResult<{ transcript: string }>>
  getUserPreferences: () => Promise<IpcResult<{ preferences: UserPreferences }>>
  updateUserPreferences: (preferences: Partial<UserPreferences>) => Promise<IpcResult<{ preferences: UserPreferences }>>
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
}

const electronAPI: ElectronAPI = {
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
  
  startRecording: (startUrl: string, outputPath: string, startTime: number) =>
    ipcRenderer.invoke('start-recording', startUrl, outputPath, startTime),
  
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  
  saveSession: (sessionData: SessionBundle) =>
    ipcRenderer.invoke('save-session', sessionData),
  
  transcribeAudio: (audioBuffer: ArrayBuffer) =>
    ipcRenderer.invoke('transcribe-audio', audioBuffer),

  checkMicrophonePermission: () =>
    ipcRenderer.invoke('check-microphone-permission'),
  
  onActionRecorded: (callback: (action: RecordedAction) => void) => {
    const handler = (_: unknown, data: unknown) => {
      if (isValidRecordedAction(data)) {
        callback(data)
      } else {
        console.error('Invalid action data received from IPC:', data)
      }
    }
    ipcRenderer.on('action-recorded', handler)
    return () => ipcRenderer.removeListener('action-recorded', handler)
  },

  distributeVoiceSegments: (actions: RecordedAction[], segments: TranscriptSegment[], startTime: number) =>
    ipcRenderer.invoke('distribute-voice-segments', actions, segments, startTime),

  generateFullTranscript: (segments: TranscriptSegment[]) =>
    ipcRenderer.invoke('generate-full-transcript', segments),

  getUserPreferences: () =>
    ipcRenderer.invoke('user-preferences-get'),

  updateUserPreferences: (preferences: Partial<UserPreferences>) =>
    ipcRenderer.invoke('user-preferences-update', preferences),

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
