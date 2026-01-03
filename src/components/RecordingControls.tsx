import { useRecordingStore } from '@/stores/recordingStore'
import { Button } from '@/components/ui/button'
import { Play, Square, Save, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { generateSessionId } from '@/lib/utils'
import type { RecordedAction, SessionBundle, TimelineEntry } from '@/types/session'

export function RecordingControls() {
  const status = useRecordingStore((state) => state.status)
  const startUrl = useRecordingStore((state) => state.startUrl)
  const outputPath = useRecordingStore((state) => state.outputPath)
  const actions = useRecordingStore((state) => state.actions)
  const transcriptSegments = useRecordingStore((state) => state.transcriptSegments)
  const notes = useRecordingStore((state) => state.notes)
  const isVoiceEnabled = useRecordingStore((state) => state.isVoiceEnabled)
  const setStatus = useRecordingStore((state) => state.setStatus)
  const setStartTime = useRecordingStore((state) => state.setStartTime)
  const addAction = useRecordingStore((state) => state.addAction)
  const reset = useRecordingStore((state) => state.reset)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const sessionIdRef = useRef<string>('')

  useEffect(() => {
    if (!window.electronAPI) return
    const unsubscribe = window.electronAPI.onActionRecorded((action) => {
      addAction(action as RecordedAction)
    })
    return unsubscribe
  }, [addAction])

  const canStart = startUrl && outputPath && status === 'idle'
  const canStop = status === 'recording'
  const canSave = status === 'idle' && actions.length > 0

  const startRecording = async () => {
    if (!canStart || !window.electronAPI) return

    sessionIdRef.current = generateSessionId()
    const result = await window.electronAPI.startRecording(startUrl, outputPath)
    
    if (!result.success) {
      console.error('Failed to start recording:', result.error)
      return
    }

    setStartTime(Date.now())
    setStatus('recording')

    if (isVoiceEnabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaRecorderRef.current = new MediaRecorder(stream)
        audioChunksRef.current = []

        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data)
          }
        }

        mediaRecorderRef.current.start(1000)
      } catch (err) {
        console.error('Failed to start audio recording:', err)
      }
    }
  }

  const stopRecording = async () => {
    if (!canStop || !window.electronAPI) return

    setStatus('processing')

    await window.electronAPI.stopRecording()

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      if (audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        const arrayBuffer = await audioBlob.arrayBuffer()
        
        await window.electronAPI.transcribeAudio(arrayBuffer)
      }
    }

    setStatus('idle')
  }

  const saveSession = async () => {
    if (!canSave || !window.electronAPI) return

    setStatus('saving')

    const timeline: TimelineEntry[] = [
      ...actions.map((a) => ({
        timestamp: a.timestamp,
        type: 'action' as const,
        actionId: a.id,
        summary: `${a.type}: ${a.target?.selector || a.url || a.key || ''}`,
      })),
      ...transcriptSegments.map((t) => ({
        timestamp: t.startTime,
        type: 'speech' as const,
        transcriptId: t.id,
        summary: t.text.slice(0, 100),
      })),
    ].sort((a, b) => a.timestamp - b.timestamp)

    const session: SessionBundle = {
      actions,
      timeline,
      transcript: transcriptSegments,
      metadata: {
        id: sessionIdRef.current || generateSessionId(),
        startTime: Date.now(),
        startUrl,
        actionCount: actions.length,
        transcriptSegmentCount: transcriptSegments.length,
      },
      notes,
    }

    const result = await window.electronAPI.saveSession(session)
    
    if (result.success) {
      console.log('Session saved to:', result.path)
      reset()
    } else {
      console.error('Failed to save session:', result.error)
    }

    setStatus('idle')
  }

  return (
    <div className="p-4 border-t border-border space-y-3">
      {status === 'idle' && actions.length === 0 && (
        <Button
          className="w-full"
          size="lg"
          onClick={startRecording}
          disabled={!canStart}
        >
          <Play className="h-4 w-4 mr-2" />
          Start Recording
        </Button>
      )}

      {status === 'recording' && (
        <Button
          className="w-full"
          size="lg"
          variant="destructive"
          onClick={stopRecording}
        >
          <Square className="h-4 w-4 mr-2" />
          Stop Recording
        </Button>
      )}

      {status === 'processing' && (
        <Button className="w-full" size="lg" disabled>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Processing...
        </Button>
      )}

      {status === 'saving' && (
        <Button className="w-full" size="lg" disabled>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Saving...
        </Button>
      )}

      {status === 'idle' && actions.length > 0 && (
        <div className="space-y-2">
          <Button
            className="w-full"
            size="lg"
            variant="success"
            onClick={saveSession}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Session
          </Button>
          <Button
            className="w-full"
            size="lg"
            variant="outline"
            onClick={startRecording}
            disabled={!canStart}
          >
            <Play className="h-4 w-4 mr-2" />
            New Recording
          </Button>
        </div>
      )}

      {!startUrl && (
        <p className="text-xs text-center text-muted-foreground">
          Enter a URL to start recording
        </p>
      )}
      {startUrl && !outputPath && (
        <p className="text-xs text-center text-muted-foreground">
          Select an output folder
        </p>
      )}
    </div>
  )
}

