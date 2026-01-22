import { useState, useEffect } from 'react'
import { Mic, RefreshCw, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { enumerateAudioDevices, type AudioDevice } from '@/lib/audioDevices'

interface MicrophoneSelectorProps {
  disabled?: boolean
  onDeviceChange?: (deviceId: string | undefined) => void
  selectedDeviceId?: string
}

export function MicrophoneSelector({ disabled, onDeviceChange, selectedDeviceId }: MicrophoneSelectorProps) {
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle')

  // Load devices on mount
  useEffect(() => {
    loadDevices()
  }, [])

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      console.log('🎤 Device list changed, refreshing...')
      loadDevices()
    }

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [])

  const loadDevices = async () => {
    setIsLoading(true)
    try {
      const audioDevices = await enumerateAudioDevices()
      setDevices(audioDevices)
    } catch (error) {
      console.error('Failed to load audio devices:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeviceSelect = (value: string) => {
    const deviceId = value === 'default' ? undefined : value
    onDeviceChange?.(deviceId)
    setTestResult('idle')
  }

  const handleTest = async () => {
    if (!selectedDeviceId && devices.length === 0) {
      return
    }

    setIsTesting(true)
    setTestResult('idle')

    try {
      // Try to get a stream with the selected device
      const constraints: MediaStreamConstraints = {
        audio: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : true
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
      // Check if we got audio tracks
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length > 0) {
        // Check if track is enabled
        const track = audioTracks[0]
        if (track.enabled) {
          setTestResult('success')
          console.log('✅ Microphone test successful')
        } else {
          setTestResult('error')
          console.warn('⚠️ Microphone track is not enabled')
        }
      } else {
        setTestResult('error')
        console.warn('⚠️ No audio tracks in stream')
      }

      // Stop the stream after testing
      stream.getTracks().forEach(track => track.stop())
    } catch (error) {
      setTestResult('error')
      console.error('❌ Microphone test failed:', error)
    } finally {
      setIsTesting(false)
    }
  }

  const selectOptions = [
    { value: 'default', label: 'Default Microphone' },
    ...devices.map(device => ({
      value: device.deviceId,
      label: device.label,
    })),
  ]

  const currentValue = selectedDeviceId || 'default'

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Microphone
      </label>
      <div className="flex gap-2">
        <Select
          value={currentValue}
          onValueChange={handleDeviceSelect}
          options={selectOptions}
          disabled={disabled || isLoading}
          className="flex-1"
        />
        <Button
          variant="secondary"
          size="icon"
          onClick={loadDevices}
          disabled={disabled || isLoading}
          title="Refresh device list"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={handleTest}
          disabled={disabled || isTesting || devices.length === 0}
          title="Test microphone"
        >
          {isTesting ? (
            <Volume2 className="h-4 w-4 animate-pulse" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Test result feedback */}
      {testResult === 'success' && (
        <p className="text-xs text-emerald-500">✓ Microphone working</p>
      )}
      {testResult === 'error' && (
        <p className="text-xs text-red-500">✗ Microphone test failed</p>
      )}

      {/* Device count info */}
      {devices.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {devices.length} device{devices.length !== 1 ? 's' : ''} found
        </p>
      )}
      {devices.length === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground">
          No microphones found. Check your system settings.
        </p>
      )}
    </div>
  )
}
