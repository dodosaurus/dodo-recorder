import { useRecordingStore } from '@/stores/recordingStore'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { useSettings } from '@/lib/useSettings'
import { Play, Square, Save, Loader2, Mic, MicOff, RotateCcw, CheckCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { RecordedAction, SessionBundle } from '@/types/session'
import { buildNarrativeWithSentenceLevelDistribution } from '../../shared/narrativeBuilder'

export function RecordingControls() {
  const {
    status, startUrl, outputPath, actions, transcriptSegments, isVoiceEnabled,
    audioStatus, audioChunksCount, audioError, startTime, sessionSaved, selectedMicrophoneId,
    pausedAt, pausedDurationMs,
    setStatus, setStartTime, addAction, setTranscriptSegments, setTranscriptText, reset,
    setAudioStatus, incrementAudioChunks, setAudioError, setSessionSaved, setSelectedMicrophoneId,
    setPausedAt, setPausedDuration
  } = useRecordingStore(useShallow((state) => ({
    status: state.status,
    startUrl: state.startUrl,
    outputPath: state.outputPath,
    actions: state.actions,
    transcriptSegments: state.transcriptSegments,
    isVoiceEnabled: state.isVoiceEnabled,
    audioStatus: state.audioStatus,
    audioChunksCount: state.audioChunksCount,
    audioError: state.audioError,
    startTime: state.startTime,
    sessionSaved: state.sessionSaved,
    selectedMicrophoneId: state.selectedMicrophoneId,
    pausedAt: state.pausedAt,
    pausedDurationMs: state.pausedDurationMs,
    setStatus: state.setStatus,
    setStartTime: state.setStartTime,
    addAction: state.addAction,
    setTranscriptSegments: state.setTranscriptSegments,
    setTranscriptText: state.setTranscriptText,
    reset: state.reset,
    setAudioStatus: state.setAudioStatus,
    incrementAudioChunks: state.incrementAudioChunks,
    setAudioError: state.setAudioError,
    setSessionSaved: state.setSessionSaved,
    setSelectedMicrophoneId: state.setSelectedMicrophoneId,
    setPausedAt: state.setPausedAt,
    setPausedDuration: state.setPausedDuration,
  })))

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const [showResetWarning, setShowResetWarning] = useState(false)

  // Use shared settings hook to reload preferences during reset
  const { reload: reloadSettings } = useSettings()

  useEffect(() => {
    if (!window.electronAPI) return
    const unsubscribe = window.electronAPI.onActionRecorded((action) => {
      addAction(action as RecordedAction)
    })
    return unsubscribe
  }, [addAction])

  // Listen for pause/resume state changes from browser widget
  useEffect(() => {
    if (!window.electronAPI) return
    const unsubscribe = window.electronAPI.onRecordingStateChanged((data) => {
      console.log('🔔 Recording state changed from widget:', data.status)
      setStatus(data.status)
      
      if (data.status === 'paused') {
        setPausedAt(Date.now())
        // Pause audio recording
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.pause()
          console.log('🎤 Audio recording paused')
        }
        setAudioActive(false)
      } else if (data.status === 'recording') {
        // Accumulate paused duration
        if (pausedAt) {
          const newDuration = pausedDurationMs + (Date.now() - pausedAt)
          setPausedDuration(newDuration)
          setPausedAt(null)
        }
        // Resume audio recording
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
          mediaRecorderRef.current.resume()
          console.log('🎤 Audio recording resumed')
        }
        if (isVoiceEnabled) {
          setAudioActive(true)
        }
      }
    })
    return unsubscribe
  }, [setStatus, setPausedAt, setPausedDuration, pausedAt, pausedDurationMs, isVoiceEnabled])

  const cleanupAudioMonitoring = () => {
    if (audioContextRef.current) {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect()
      analyserRef.current = null
    }

    if (window.electronAPI) {
      void window.electronAPI.updateAudioActivity(false)
    }
  }

  const setAudioActive = (active: boolean) => {
    if (window.electronAPI) {
      void window.electronAPI.updateAudioActivity(active)
    }
  }

  const canStart = startUrl && outputPath && status === 'idle'
  const canStop = status === 'recording' || status === 'paused'
  const canSave = status === 'idle' && actions.length > 0

  const startRecording = async () => {
    console.log('🎬 startRecording() called')
    console.log('  canStart:', canStart)
    console.log('  startUrl:', startUrl)
    console.log('  outputPath:', outputPath)
    console.log('  status:', status)
    console.log('  isVoiceEnabled:', isVoiceEnabled)
    console.log('  window.electronAPI:', !!window.electronAPI)
    
    if (!canStart || !window.electronAPI) {
      console.error('❌ Cannot start recording - preconditions not met')
      console.error('  canStart:', canStart)
      console.error('  electronAPI available:', !!window.electronAPI)
      return
    }

    setAudioError(null)
    setSessionSaved(false)

    // Set start time FIRST, before any recording starts
    // This ensures audio timestamps align with action timestamps
    const recordingStartTime = Date.now()
    setStartTime(recordingStartTime)
    console.log('⏰ Recording start time set:', recordingStartTime)

    // Start audio recording FIRST (before browser) to capture everything
    if (isVoiceEnabled) {
      console.log('🎤 Voice recording enabled - checking microphone permission...')
      try {
        const permResult = await window.electronAPI.checkMicrophonePermission()
        console.log('🎤 Microphone permission result:', permResult)
        
        if (!permResult.granted) {
          console.error('❌ Microphone permission denied')
          setAudioError('Microphone permission denied')
          setAudioStatus('error')
          setAudioActive(false)
          return
        }
        
        // Validate selected device exists before requesting stream
        if (selectedMicrophoneId) {
          console.log('🎤 Validating selected microphone device...')
          const devices = await navigator.mediaDevices.enumerateDevices()
          const deviceExists = devices.some(d => d.deviceId === selectedMicrophoneId)
          
          if (!deviceExists) {
            console.warn('⚠️  Selected microphone not found, falling back to default')
            setAudioError('Selected microphone not available, using default')
            // Clear selected device and fall back to default
            setSelectedMicrophoneId(undefined)
            // Update settings to clear the invalid device
            if (window.electronAPI) {
              await window.electronAPI.updateMicrophoneSettings({ selectedMicrophoneId: undefined })
            }
          }
        }
        
        console.log('🎤 Requesting microphone stream...')
        console.log('🎤 Selected microphone ID:', selectedMicrophoneId)
        
        // Try to get stream with selected device
        let stream: MediaStream | undefined
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: selectedMicrophoneId ? { exact: selectedMicrophoneId } : undefined,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 16000  // Match Whisper's expected sample rate
            }
          })
          console.log('🎤 Microphone stream acquired')
        } catch (getUserMediaError) {
          console.error('❌ Failed to get stream with selected device:', getUserMediaError)
          
          // Fallback to default device if selected device fails
          if (selectedMicrophoneId) {
            console.warn('🔄 Falling back to default microphone...')
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                  sampleRate: 16000
                }
              })
              console.log('✅ Fallback to default device succeeded')
              setAudioError(null)
            } catch (fallbackError) {
              console.error('❌ Fallback to default device also failed:', fallbackError)
              setAudioError(fallbackError instanceof Error ? fallbackError.message : 'Failed to access any microphone')
              setAudioStatus('error')
              return
            }
          } else {
            // No selected device, so initial failure is a real error
            console.error('❌ Failed to access default microphone')
            setAudioError(getUserMediaError instanceof Error ? getUserMediaError.message : 'Failed to access microphone')
            setAudioStatus('error')
            return
          }
        }
        
        if (stream) {
          // Store stream reference
          audioStreamRef.current = stream

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
        }
      } catch (err) {
        console.error('❌ Failed to start audio recording:', err)
        setAudioError(err instanceof Error ? err.message : 'Failed to access microphone')
        setAudioStatus('error')
        setAudioActive(false)
        return
      }
    } else {
      console.log('🔇 Voice recording disabled')
      setAudioActive(false)
    }

    // Now start browser recording - pass the startTime so backend uses the same timestamp
    console.log('🌐 Starting browser recording...')
    console.log('  URL:', startUrl)
    console.log('  Output:', outputPath)
    console.log('  Start time:', recordingStartTime)
    
    try {
      const result = await window.electronAPI.startRecording(startUrl, outputPath, recordingStartTime)
      console.log('🌐 Browser recording result:', result)
      
      if (!result.success) {
        console.error('❌ Failed to start recording:', result.error)
        // Stop audio if browser failed to start
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          console.log('🎤 Stopping audio due to browser recording failure')
          mediaRecorderRef.current.stop()
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
          mediaRecorderRef.current = null
        }
        cleanupAudioMonitoring()
        // Clean up audio stream reference
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop())
          audioStreamRef.current = null
        }
        return
      }

      console.log('✅ Recording started successfully')
      setStatus('recording')

      // Signal audio is active in the browser widget
      if (isVoiceEnabled && audioStreamRef.current) {
        await window.electronAPI.updateAudioActivity(true)
        console.log('✅ Audio activity set to true in browser')
      }
    } catch (err) {
      console.error('❌ Exception during startRecording IPC call:', err)
      // Stop audio if browser failed to start
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        console.log('🎤 Stopping audio due to exception')
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
        mediaRecorderRef.current = null
      }
      cleanupAudioMonitoring()
      // Clean up audio stream reference
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
        audioStreamRef.current = null
      }
    }
  }


  const stopRecording = async () => {
    if (!canStop || !window.electronAPI) return

    setAudioActive(false)
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
          
          // Distribute voice segments across actions RIGHT AFTER transcription
          if (startTime && result.segments.length > 0) {
            console.log(`Distributing ${result.segments.length} voice segments across ${actions.length} actions...`)
            try {
              const distributionResult = await window.electronAPI.distributeVoiceSegments(
                actions,
                result.segments,
                startTime
              )
              if (distributionResult.success && distributionResult.actions) {
                console.log('Voice segments distributed successfully')
                
                // Update actions in store with distributed voice segments
                // We need to replace all actions with the new ones that have voice segments
                const actionsWithVoice = distributionResult.actions
                
                // Generate narrative text locally for UI display using shared builder
                const narrativeText = buildNarrativeWithSentenceLevelDistribution(actionsWithVoice)
                setTranscriptText(narrativeText)
                console.log('Narrative text generated successfully for UI')
                
                // Update actions in store - replace entire actions array with distributed ones
                useRecordingStore.setState({ actions: actionsWithVoice })
              } else if ('success' in distributionResult && !distributionResult.success) {
                console.error('Failed to distribute voice segments:', distributionResult.error)
              }
            } catch (error) {
              console.error('Exception during voice distribution:', error)
            }
          }
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

      cleanupAudioMonitoring()
      
      // Clean up audio stream reference
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
        audioStreamRef.current = null
      }
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
          
          // Generate narrative text locally for UI display using shared builder
          const narrativeText = buildNarrativeWithSentenceLevelDistribution(actionsWithVoice)
          setTranscriptText(narrativeText)
          console.log('Narrative text generated successfully for UI')
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
      setSessionSaved(true)
    } else {
      console.error('Failed to save session:', 'success' in result ? result.error : 'Unknown error')
    }

    setStatus('idle')
  }

  const resetSession = async () => {
    if (!window.electronAPI) return

    // Show warning if session hasn't been saved
    if (!sessionSaved && actions.length > 0) {
      setShowResetWarning(true)
      return
    }

    // Save current voice settings
    const currentVoiceEnabled = isVoiceEnabled
    
    // Reset the recording state
    reset()

    // Restore voice enabled state
    useRecordingStore.getState().setVoiceEnabled(currentVoiceEnabled)

    // Reload all saved preferences (URL, output path, microphone settings)
    await reloadSettings()
  }

  const confirmReset = async () => {
    setShowResetWarning(false)
    
    // Save current voice settings
    const currentVoiceEnabled = isVoiceEnabled
    
    // Reset the recording state
    reset()

    // Restore voice enabled state
    useRecordingStore.getState().setVoiceEnabled(currentVoiceEnabled)

    // Reload all saved preferences (URL, output path, microphone settings)
    await reloadSettings()
  }

  const cancelReset = () => {
    setShowResetWarning(false)
  }

  const renderAudioStatus = () => {
    if (!isVoiceEnabled) return null

    if (status === 'recording' && audioStatus === 'recording') {
      return (
        <div className="flex items-center justify-center text-xs bg-red-500/10 text-red-400 px-3 py-2 rounded-md">
          <div className="flex items-center gap-2">
            <Mic className="h-3.5 w-3.5 animate-pulse" />
            <span>Recording audio</span>
            <span className="font-mono">{audioChunksCount}s</span>
          </div>
        </div>
      )
    }

    if (audioStatus === 'processing') {
      return (
        <div className="flex items-center justify-center text-xs bg-amber-500/10 text-amber-400 px-3 py-2 rounded-md">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Transcribing audio...</span>
          </div>
        </div>
      )
    }

    if (audioStatus === 'complete' && transcriptSegments.length > 0) {
      return (
        <div className="flex items-center justify-center text-xs bg-emerald-500/10 text-emerald-400 px-3 py-2 rounded-md">
          <div className="flex items-center gap-2">
            <Mic className="h-3.5 w-3.5" />
            <span>{transcriptSegments.length} voice segment{transcriptSegments.length !== 1 ? 's' : ''} transcribed</span>
          </div>
        </div>
      )
    }

    if (audioStatus === 'error') {
      return (
        <div className="flex items-center justify-center text-xs bg-red-500/10 text-red-400 px-3 py-2 rounded-md">
          <div className="flex items-center gap-2">
            <MicOff className="h-3.5 w-3.5" />
            <span>{audioError || 'Audio error'}</span>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <>
      <Dialog
        open={showResetWarning}
        onOpenChange={setShowResetWarning}
        title="Unsaved Session"
        description="You have unsaved changes. Are you sure you want to reset? This will clear all recorded actions and cannot be undone."
      >
        <DialogFooter>
          <Button variant="outline" onClick={cancelReset}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmReset}>
            Reset Anyway
          </Button>
        </DialogFooter>
      </Dialog>

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

      {(status === 'recording' || status === 'paused') && (
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
            variant={sessionSaved ? "outline" : "success"}
            onClick={saveSession}
            disabled={sessionSaved}
          >
            {sessionSaved ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Session Saved
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Session
              </>
            )}
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
    </>
  )
}
