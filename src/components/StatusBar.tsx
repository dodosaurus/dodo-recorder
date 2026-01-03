import { useRecordingStore } from '@/stores/recordingStore'
import { cn, formatTimestamp } from '@/lib/utils'
import { useEffect, useState } from 'react'

export function StatusBar() {
  const status = useRecordingStore((state) => state.status)
  const startTime = useRecordingStore((state) => state.startTime)
  const actions = useRecordingStore((state) => state.actions)
  const [elapsed, setElapsed] = useState(0)

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

  const statusConfig = {
    idle: { label: 'Ready', color: 'bg-muted-foreground' },
    recording: { label: 'Recording', color: 'bg-destructive animate-pulse-recording' },
    paused: { label: 'Paused', color: 'bg-yellow-500' },
    processing: { label: 'Processing', color: 'bg-primary' },
    saving: { label: 'Saving', color: 'bg-accent' },
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
            <span className="text-foreground font-medium">{actions.length}</span> actions
          </div>
        </>
      )}
    </div>
  )
}

