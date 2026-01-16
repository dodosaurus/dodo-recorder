import { useRecordingStore } from '@/stores/recordingStore'
import { cn, formatTimestamp } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { RecordingStatus } from '@/types/session'
import { FileText, FolderOpen } from 'lucide-react'

const statusConfig: Record<RecordingStatus, { label: string; color: string }> = {
  idle: { label: 'Ready', color: 'bg-green-500' },
  recording: { label: 'Recording', color: 'bg-destructive animate-pulse-recording' },
  paused: { label: 'Paused', color: 'bg-yellow-500' },
  processing: { label: 'Processing', color: 'bg-primary' },
  saving: { label: 'Saving', color: 'bg-accent' },
}

export function StatusBar() {
  const { status, startTime, actionsCount } = useRecordingStore(useShallow((state) => ({
    status: state.status,
    startTime: state.startTime,
    actionsCount: state.actions.length,
  })))
  const [elapsed, setElapsed] = useState(0)
  const [logPath, setLogPath] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'recording' || !startTime) {
      setElapsed(0)
      return
    }

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime)
    }, 1000)

    return () => clearInterval(interval)
  }, [status, startTime])

  useEffect(() => {
    // Get log path on mount
    if (window.electronAPI?.getLogPath) {
      window.electronAPI.getLogPath().then(setLogPath).catch(console.error)
    }
  }, [])

  const openLogFile = async () => {
    if (window.electronAPI?.openLogFile) {
      const result = await window.electronAPI.openLogFile()
      if (!result.success) {
        console.error('Failed to open log file:', result.error)
      }
    }
  }

  const openLogFolder = async () => {
    if (window.electronAPI?.openLogFolder) {
      const result = await window.electronAPI.openLogFolder()
      if (!result.success) {
        console.error('Failed to open log folder:', result.error)
      }
    }
  }

  const { label, color } = statusConfig[status]

  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex items-center gap-2">
        <span className={cn('w-2 h-2 rounded-full', color)} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      
      {status === 'recording' && (
        <>
          <div className="text-muted-foreground">
            <span className="text-foreground font-medium">{formatTimestamp(elapsed)}</span>
          </div>
          <div className="text-muted-foreground">
            <span className="text-foreground font-medium">{actionsCount}</span> actions
          </div>
        </>
      )}

      {/* Log access buttons - only show when idle to avoid clutter */}
      {logPath && status === 'idle' && (
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={openLogFile}
            className="flex items-center gap-1 px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
            title={`Open log file: ${logPath}`}
          >
            <FileText className="h-3 w-3" />
            <span className="text-xs">Logs</span>
          </button>
          <button
            onClick={openLogFolder}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
            title="Open logs folder"
          >
            <FolderOpen className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}
