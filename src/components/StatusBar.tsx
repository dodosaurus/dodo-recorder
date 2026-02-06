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
  const { status, startTime, actionsCount, pausedAt, pausedDurationMs } = useRecordingStore(useShallow((state) => ({
    status: state.status,
    startTime: state.startTime,
    actionsCount: state.actions.length,
    pausedAt: state.pausedAt,
    pausedDurationMs: state.pausedDurationMs,
  })))
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if ((status !== 'recording' && status !== 'paused') || !startTime) {
      setElapsed(0)
      return
    }

    // If paused, freeze the timer
    if (status === 'paused' && pausedAt) {
      const frozenElapsed = pausedAt - startTime - pausedDurationMs
      setElapsed(frozenElapsed)
      return
    }

    // If recording, update timer excluding paused duration
    if (status === 'recording') {
      const interval = setInterval(() => {
        setElapsed(Date.now() - startTime - pausedDurationMs)
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [status, startTime, pausedAt, pausedDurationMs])

  const { label, color } = statusConfig[status]

  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex items-center gap-2">
        <span className={cn('w-2 h-2 rounded-full', color)} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      
      {(status === 'recording' || status === 'paused') && (
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
