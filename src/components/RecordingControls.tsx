import { useRecordingStore } from '@/stores/recordingStore'
import { Button } from '@/components/ui/button'
import { Play, Square, Save, Loader2, Mic, MicOff, RotateCcw } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { RecordedAction, SessionBundle } from '@/types/session'

export function RecordingControls() {
  const {
    status, startUrl, outputPath, actions, transcriptSegments, notes, isVoiceEnabled,
    audioStatus, audioChunksCount, audioError, startTime,
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
    startTime: state.startTime,
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

    setAudioError(null)

    // Set start time FIRST, before any recording starts
    // This ensures audio timestamps align with action timestamps
    const recordingStartTime = Date.now()
    setStartTime(recordingStartTime)

    // Start audio recording FIRST (before browser) to capture everything
    if (isVoiceEnabled) {
      try {
        const permResult = await window.electronAPI.checkMicrophonePermission()
        if (!permResult.granted) {
          setAudioError('Microphone permission denied')
          setAudioStatus('error')
          return
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000  // Match Whisper's expected sample rate
          }
        })
        
        mediaRecorderRef.current = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 128000
        })
        audioChunksRef.current = []

        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data)
            incrementAudioChunks()
          }
        }

        mediaRecorderRef.current.start(1000)
        setAudioStatus('recording')
        console.log('🎤 Audio recording started at:', recordingStartTime)
      } catch (err) {
        console.error('Failed to start audio recording:', err)
        setAudioError(err instanceof Error ? err.message : 'Failed to access microphone')
        setAudioStatus('error')
        return
      }
    }

    // Now start browser recording - pass the startTime so backend uses the same timestamp
    const result = await window.electronAPI.startRecording(startUrl, outputPath, recordingStartTime)
    
    if (!result.success) {
      console.error('Failed to start recording:', result.error)
      // Stop audio if browser failed to start
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      }
      return
    }

    setStatus('recording')
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
        
        console.log('='.repeat(60))
        console.log('🎤 Audio Recording Summary')
        console.log('='.repeat(60))
        console.log(`Total audio chunks: ${audioChunksRef.current.length}`)
        console.log(`Total audio size: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`)
        console.log(`Audio duration (approx): ${audioChunksRef.current.length} seconds`)
        console.log('='.repeat(60))
        
        const result = await window.electronAPI.transcribeAudio(arrayBuffer)
        if (result.success && result.segments) {
          console.log('✅ Transcription successful')
          console.log(`Segments received: ${result.segments.length}`)
          result.segments.forEach((seg: any, idx: number) => {
            console.log(`  [${idx + 1}] ${seg.startTime}ms -> ${seg.endTime}ms: "${seg.text}"`)
          })
          setTranscriptSegments(result.segments)
          setAudioStatus('complete')
        } else {
          console.error('❌ Transcription failed:', result)
          setAudioError('success' in result && !result.success ? result.error : 'Transcription failed')
          setAudioStatus('error')
        }
      } else {
        console.warn('⚠️  No audio chunks recorded')
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
    console.log('Starting session save...')

    // Distribute voice segments across actions using sophisticated algorithm
    let actionsWithVoice = actions
    if (transcriptSegments.length > 0 && startTime) {
      console.log(`Distributing ${transcriptSegments.length} voice segments across ${actions.length} actions...`)
      try {
        const result = await window.electronAPI.distributeVoiceSegments(
          actions,
          transcriptSegments,
          startTime
        )
        if (result.success && result.actions) {
          actionsWithVoice = result.actions
          console.log('Voice segments distributed successfully')
        } else if ('success' in result && !result.success) {
          console.error('Failed to distribute voice segments:', result.error)
        }
      } catch (error) {
        console.error('Exception during voice distribution:', error)
        // Continue with original actions if distribution fails
      }
    }

    // Create simplified session bundle with just actions and startTime
    const session: SessionBundle = {
      actions: actionsWithVoice,
      startTime: startTime || Date.now(),
    }

    console.log('Saving session bundle...')
    const result = await window.electronAPI.saveSession(session)
    
    if (result.success) {
      console.log('Session saved successfully to:', result.path)
      
      // Reload user preferences before resetting to restore URL and output path
      const prefsResult = await window.electronAPI.getUserPreferences()
      
      reset()
      
      // Restore the saved preferences after reset
      if (prefsResult.success && (prefsResult as any).preferences) {
        const preferences = (prefsResult as any).preferences
        if (preferences.startUrl) {
          useRecordingStore.getState().setStartUrl(preferences.startUrl)
        }
        if (preferences.outputPath) {
          useRecordingStore.getState().setOutputPath(preferences.outputPath)
        }
      }
    } else {
      console.error('Failed to save session:', 'success' in result ? result.error : 'Unknown error')
    }

    setStatus('idle')
  }

  const resetSession = async () => {
    if (!window.electronAPI) return

    // Reload user preferences before resetting to restore URL and output path
    const prefsResult = await window.electronAPI.getUserPreferences()
    
    reset()
    
    // Restore the saved preferences after reset
    if (prefsResult.success && (prefsResult as any).preferences) {
      const preferences = (prefsResult as any).preferences
      if (preferences.startUrl) {
        useRecordingStore.getState().setStartUrl(preferences.startUrl)
      }
      if (preferences.outputPath) {
        useRecordingStore.getState().setOutputPath(preferences.outputPath)
      }
    }
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
            onClick={resetSession}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
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
