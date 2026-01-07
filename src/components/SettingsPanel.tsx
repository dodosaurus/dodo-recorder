import { useRecordingStore } from '@/stores/recordingStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Folder, Mic } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useEffect } from 'react'

export function SettingsPanel() {
  const {
    startUrl, setStartUrl, outputPath, setOutputPath,
    isVoiceEnabled, setVoiceEnabled, status
  } = useRecordingStore(useShallow((state) => ({
    startUrl: state.startUrl,
    setStartUrl: state.setStartUrl,
    outputPath: state.outputPath,
    setOutputPath: state.setOutputPath,
    isVoiceEnabled: state.isVoiceEnabled,
    setVoiceEnabled: state.setVoiceEnabled,
    status: state.status,
  })))

  const isDisabled = status === 'recording' || status === 'processing'

  // Load saved preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      if (!window.electronAPI) {
        console.log('[SettingsPanel] electronAPI not available')
        return
      }
      
      console.log('[SettingsPanel] Loading user preferences...')
      const result = await window.electronAPI.getUserPreferences()
      console.log('[SettingsPanel] getUserPreferences result:', result)
      
      // The result structure is: { success: true, preferences: { startUrl, outputPath } }
      if (result.success && (result as any).preferences) {
        const preferences = (result as any).preferences
        console.log('[SettingsPanel] Loaded preferences:', preferences)
        
        if (preferences.startUrl) {
          console.log('[SettingsPanel] Setting startUrl:', preferences.startUrl)
          setStartUrl(preferences.startUrl)
        }
        if (preferences.outputPath) {
          console.log('[SettingsPanel] Setting outputPath:', preferences.outputPath)
          setOutputPath(preferences.outputPath)
        }
      } else {
        console.log('[SettingsPanel] Failed to load preferences or no data')
      }
    }
    
    loadPreferences()
  }, [setStartUrl, setOutputPath])

  // Save startUrl when it changes
  const handleStartUrlChange = async (url: string) => {
    setStartUrl(url)
    if (window.electronAPI) {
      await window.electronAPI.updateUserPreferences({ startUrl: url })
    }
  }

  const handleSelectFolder = async () => {
    if (!window.electronAPI) return
    const path = await window.electronAPI.selectOutputFolder()
    if (path) {
      setOutputPath(path)
      // Save the selected path to preferences
      await window.electronAPI.updateUserPreferences({ outputPath: path })
    }
  }

  return (
    <div className="p-4 space-y-4 flex-1">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Start URL
        </label>
        <Input
          placeholder="https://example.com"
          value={startUrl}
          onChange={(e) => handleStartUrlChange(e.target.value)}
          disabled={isDisabled}
          className="bg-background"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Output Folder
        </label>
        <div className="flex gap-2">
          <Input
            placeholder="Select a folder..."
            value={outputPath}
            readOnly
            disabled={isDisabled}
            className="bg-background flex-1"
          />
          <Button
            variant="secondary"
            size="icon"
            onClick={handleSelectFolder}
            disabled={isDisabled}
          >
            <Folder className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Voice Recording</span>
        </div>
        <Switch
          checked={isVoiceEnabled}
          onCheckedChange={setVoiceEnabled}
          disabled={isDisabled}
        />
      </div>

      {isVoiceEnabled && (
        <p className="text-xs text-muted-foreground text-center">
          Speak your observations during recording. Audio will be transcribed locally using Whisper.
        </p>
      )}
    </div>
  )
}
