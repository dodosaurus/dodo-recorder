export interface ElementTarget {
  selector: string
  role?: string
  name?: string
  testId?: string
  xpath?: string
  css?: string
  text?: string
  placeholder?: string
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface RecordedAction {
  id: string
  timestamp: number
  type: 'click' | 'fill' | 'navigate' | 'keypress' | 'select' | 'check' | 'scroll'
  target?: ElementTarget
  value?: string
  url?: string
  key?: string
  screenshot?: string
}

export interface TranscriptSegment {
  id: string
  startTime: number
  endTime: number
  text: string
}

export interface TimelineEntry {
  timestamp: number
  type: 'action' | 'speech'
  actionId?: string
  transcriptId?: string
  summary: string
}

export interface SessionMetadata {
  id: string
  startTime: number
  endTime?: number
  startUrl: string
  duration?: number
  actionCount: number
  transcriptSegmentCount: number
}

export interface SessionBundle {
  actions: RecordedAction[]
  timeline: TimelineEntry[]
  transcript: TranscriptSegment[]
  metadata: SessionMetadata
  notes: string
}

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'processing' | 'saving'

export type ActionType = RecordedAction['type']

export interface IpcResultSuccess<T = object> {
  success: true
  data?: T
}

export interface IpcResultError {
  success: false
  error: string
}

export type IpcResult<T = object> = (IpcResultSuccess<T> & T) | IpcResultError

