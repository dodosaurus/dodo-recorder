import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
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
      </div>
    </div>
  )
}
