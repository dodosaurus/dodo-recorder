import { create } from 'zustand'
import type { RecordedAction, TranscriptSegment, RecordingStatus } from '@/types/session'

interface RecordingState {
  status: RecordingStatus
  actions: RecordedAction[]
  transcriptSegments: TranscriptSegment[]
  startTime: number | null
  startUrl: string
  outputPath: string
  notes: string
  isVoiceEnabled: boolean
  
  setStatus: (status: RecordingStatus) => void
  addAction: (action: RecordedAction) => void
  removeAction: (id: string) => void
  addTranscriptSegment: (segment: TranscriptSegment) => void
  setStartTime: (time: number) => void
  setStartUrl: (url: string) => void
  setOutputPath: (path: string) => void
  setNotes: (notes: string) => void
  setVoiceEnabled: (enabled: boolean) => void
  reset: () => void
}

const initialState = {
  status: 'idle' as RecordingStatus,
  actions: [] as RecordedAction[],
  transcriptSegments: [] as TranscriptSegment[],
  startTime: null as number | null,
  startUrl: '',
  outputPath: '',
  notes: '',
  isVoiceEnabled: true,
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
  
  setStartTime: (time) => set({ startTime: time }),
  
  setStartUrl: (url) => set({ startUrl: url }),
  
  setOutputPath: (path) => set({ outputPath: path }),
  
  setNotes: (notes) => set({ notes }),
  
  setVoiceEnabled: (enabled) => set({ isVoiceEnabled: enabled }),
  
  reset: () => set(initialState),
}))

