import { create } from 'zustand'
import type { RecordedAction, TranscriptSegment, RecordingStatus } from '@/types/session'

export type AudioStatus = 'idle' | 'recording' | 'processing' | 'complete' | 'error'

interface RecordingState {
  status: RecordingStatus
  actions: RecordedAction[]
  transcriptSegments: TranscriptSegment[]
  transcriptText: string
  startTime: number | null
  startUrl: string
  outputPath: string
  notes: string
  isVoiceEnabled: boolean
  sessionSaved: boolean
  
  audioStatus: AudioStatus
  audioChunksCount: number
  audioError: string | null
  
  isTranscriptViewOpen: boolean
  highlightedActionId: string | null
  
  setStatus: (status: RecordingStatus) => void
  addAction: (action: RecordedAction) => void
  removeAction: (id: string) => void
  addTranscriptSegment: (segment: TranscriptSegment) => void
  setTranscriptSegments: (segments: TranscriptSegment[]) => void
  setTranscriptText: (text: string) => void
  setStartTime: (time: number) => void
  setStartUrl: (url: string) => void
  setOutputPath: (path: string) => void
  setNotes: (notes: string) => void
  setVoiceEnabled: (enabled: boolean) => void
  setSessionSaved: (saved: boolean) => void
  setAudioStatus: (status: AudioStatus) => void
  incrementAudioChunks: () => void
  setAudioError: (error: string | null) => void
  setTranscriptViewOpen: (open: boolean) => void
  setHighlightedActionId: (id: string | null) => void
  reset: () => void
}

const initialState = {
  status: 'idle' as RecordingStatus,
  actions: [] as RecordedAction[],
  transcriptSegments: [] as TranscriptSegment[],
  transcriptText: '',
  startTime: null as number | null,
  startUrl: '',
  outputPath: '',
  notes: '',
  isVoiceEnabled: true,
  sessionSaved: false,
  audioStatus: 'idle' as AudioStatus,
  audioChunksCount: 0,
  audioError: null as string | null,
  isTranscriptViewOpen: false,
  highlightedActionId: null as string | null,
}

export const useRecordingStore = create<RecordingState>((set) => ({
  ...initialState,
  
  setStatus: (status) => set({ status }),
  
  addAction: (action) => set((state) => ({
    actions: [...state.actions, action]
  })),
  
  removeAction: (id) => set((state) => ({
    actions: state.actions.filter((a) => a.id !== id)
  })),
  
  addTranscriptSegment: (segment) => set((state) => ({
    transcriptSegments: [...state.transcriptSegments, segment]
  })),

  setTranscriptSegments: (segments) => set({ transcriptSegments: segments }),
  
  setTranscriptText: (text) => set({ transcriptText: text }),
  
  setStartTime: (time) => set({ startTime: time }),
  
  setStartUrl: (url) => set({ startUrl: url }),
  
  setOutputPath: (path) => set({ outputPath: path }),
  
  setNotes: (notes) => set({ notes }),
  
  setVoiceEnabled: (enabled) => set({ isVoiceEnabled: enabled }),

  setSessionSaved: (saved) => set({ sessionSaved: saved }),

  setAudioStatus: (audioStatus) => set({ audioStatus }),

  incrementAudioChunks: () => set((state) => ({
    audioChunksCount: state.audioChunksCount + 1
  })),

  setAudioError: (audioError) => set({ audioError }),
  
  setTranscriptViewOpen: (open) => set({ isTranscriptViewOpen: open }),
  
  setHighlightedActionId: (id) => set({ highlightedActionId: id }),
  
  reset: () => set(initialState),
}))

