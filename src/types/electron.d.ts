import type { RecordedAction, SessionBundle, TranscriptSegment, IpcResult } from '../../shared/types'

export interface UserPreferences {
  startUrl: string
  outputPath: string
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
  minimizeWindow?: () => void
  maximizeWindow?: () => void
  closeWindow?: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
