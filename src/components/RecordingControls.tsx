import { useRecordingStore } from '@/stores/recordingStore'
import { Button } from '@/components/ui/button'
import { Play, Square, Save, Loader2, Mic, MicOff } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { generateSessionId } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import type { RecordedAction, SessionBundle, TimelineEntry } from '@/types/session'

export function RecordingControls() {
  const {
    status, startUrl, outputPath, actions, transcriptSegments, notes, isVoiceEnabled,
    audioStatus, audioChunksCount, audioError,
    setStatus, setStartTime, addAction, setTranscriptSegments, reset,
    setAudioStatus, incrementAudioChunks, setAudioError
  } = useRecordingStore(useShallow((state) => ({
    status: state.status,
    startUrl: state.startUrl,
    outputPath: state.outputPath,
    actions: state.actions,
    transcriptSegments: state.transcriptSegments,
    notes: state.notes,
    isVoiceEnabled: state.isVoiceEnabled,
    audioStatus: state.audioStatus,
    audioChunksCount: state.audioChunksCount,
    audioError: state.audioError,
    setStatus: state.setStatus,
    setStartTime: state.setStartTime,
    addAction: state.addAction,
    setTranscriptSegments: state.setTranscriptSegments,
    reset: state.reset,
    setAudioStatus: state.setAudioStatus,
    incrementAudioChunks: state.incrementAudioChunks,
    setAudioError: state.setAudioError,
  })))

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
    setAudioError(null)

    if (isVoiceEnabled) {
      try {
        const permResult = await window.electronAPI.checkMicrophonePermission()
        if (!permResult.granted) {
          setAudioError('Microphone permission denied')
          setAudioStatus('error')
        } else {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          mediaRecorderRef.current = new MediaRecorder(stream)
          audioChunksRef.current = []

          mediaRecorderRef.current.ondataavailable = (e) => {
            if (e.data.size > 0) {
              audioChunksRef.current.push(e.data)
              incrementAudioChunks()
            }
          }

          mediaRecorderRef.current.start(1000)
          setAudioStatus('recording')
        }
      } catch (err) {
        console.error('Failed to start audio recording:', err)
        setAudioError(err instanceof Error ? err.message : 'Failed to access microphone')
        setAudioStatus('error')
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
        setAudioStatus('processing')
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const arrayBuffer = await audioBlob.arrayBuffer()
        
        const result = await window.electronAPI.transcribeAudio(arrayBuffer)
        if (result.success && result.segments) {
          setTranscriptSegments(result.segments)
          setAudioStatus('complete')
        } else {
          setAudioError(result.error || 'Transcription failed')
          setAudioStatus('error')
        }
      } else {
        setAudioStatus('idle')
      }
      
      mediaRecorderRef.current = null
      audioChunksRef.current = []
    } else {
      setAudioStatus('idle')
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

  const renderAudioStatus = () => {
    if (!isVoiceEnabled) return null

    if (status === 'recording' && audioStatus === 'recording') {
      return (
        <div className="flex items-center gap-2 text-xs bg-red-500/10 text-red-400 px-3 py-2 rounded-md">
          <Mic className="h-3.5 w-3.5 animate-pulse" />
          <span>Recording audio</span>
          <span className="ml-auto font-mono">{audioChunksCount}s</span>
        </div>
      )
    }

    if (audioStatus === 'processing') {
      return (
        <div className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-400 px-3 py-2 rounded-md">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Transcribing audio with Whisper...</span>
        </div>
      )
    }

    if (audioStatus === 'complete' && transcriptSegments.length > 0) {
      return (
        <div className="flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-400 px-3 py-2 rounded-md">
          <Mic className="h-3.5 w-3.5" />
          <span>{transcriptSegments.length} voice segment{transcriptSegments.length !== 1 ? 's' : ''} transcribed</span>
        </div>
      )
    }

    if (audioStatus === 'error') {
      return (
        <div className="flex items-center gap-2 text-xs bg-red-500/10 text-red-400 px-3 py-2 rounded-md">
          <MicOff className="h-3.5 w-3.5" />
          <span>{audioError || 'Audio error'}</span>
        </div>
      )
    }

    return null
  }

  return (
    <div className="p-4 border-t border-border space-y-3">
      {renderAudioStatus()}

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
          {audioStatus === 'processing' ? 'Transcribing...' : 'Processing...'}
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
