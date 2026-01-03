export interface ElectronAPI {
  selectOutputFolder: () => Promise<string | null>
  startRecording: (startUrl: string, outputPath: string) => Promise<{ success: boolean; error?: string }>
  stopRecording: () => Promise<{ success: boolean; actions?: unknown[]; error?: string }>
  saveSession: (sessionData: unknown) => Promise<{ success: boolean; path?: string; error?: string }>
  transcribeAudio: (audioBuffer: ArrayBuffer) => Promise<{ success: boolean; segments?: unknown[]; error?: string }>
  onActionRecorded: (callback: (action: unknown) => void) => () => void
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
