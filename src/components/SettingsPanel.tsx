import { useRecordingStore } from '@/stores/recordingStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Folder, Mic } from 'lucide-react'

export function SettingsPanel() {
  const startUrl = useRecordingStore((state) => state.startUrl)
  const setStartUrl = useRecordingStore((state) => state.setStartUrl)
  const outputPath = useRecordingStore((state) => state.outputPath)
  const setOutputPath = useRecordingStore((state) => state.setOutputPath)
  const isVoiceEnabled = useRecordingStore((state) => state.isVoiceEnabled)
  const setVoiceEnabled = useRecordingStore((state) => state.setVoiceEnabled)
  const status = useRecordingStore((state) => state.status)

  const isDisabled = status === 'recording' || status === 'processing'

  const handleSelectFolder = async () => {
    if (!window.electronAPI) return
    const path = await window.electronAPI.selectOutputFolder()
    if (path) {
      setOutputPath(path)
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
          onChange={(e) => setStartUrl(e.target.value)}
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
        {outputPath && (
          <p className="text-xs text-muted-foreground truncate" title={outputPath}>
            {outputPath}
          </p>
        )}
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
        <p className="text-xs text-muted-foreground">
          Speak your observations during recording. Audio will be transcribed locally using Whisper.
        </p>
      )}
    </div>
  )
}

