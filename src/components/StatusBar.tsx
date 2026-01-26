import { useRecordingStore } from '@/stores/recordingStore'
import { cn, formatTimestamp } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { RecordingStatus } from '@/types/session'

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
    </div>
  )
}
