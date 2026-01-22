import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface AudioLevelMeterProps {
  stream?: MediaStream
  className?: string
}

export function AudioLevelMeter({ stream, className }: AudioLevelMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const levelRef = useRef<number>(0)

  useEffect(() => {
    if (!stream) return

    // Clean up previous audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Create new audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    audioContextRef.current = audioContext

    // Get audio track from stream
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) return

    // Create analyser
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.3
    source.connect(analyser)
    analyserRef.current = analyser

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    // Animation loop
    const draw = () => {
      if (!analyserRef.current) return

      analyserRef.current.getByteFrequencyData(dataArray)

      // Calculate RMS (root mean square) for more accurate volume level
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += (dataArray[i] / 255) ** 2
      }
      const rms = Math.sqrt(sum / dataArray.length)
      const level = Math.min(100, rms * 100 * 2) // Scale to 0-100 range

      levelRef.current = level

      // Draw on canvas
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const width = canvas.width
          const height = canvas.height

          // Clear canvas
          ctx.clearRect(0, 0, width, height)

          // Determine color based on level
          let color = '#22c55e' // Green
          if (level > 50) {
            color = '#eab308' // Yellow
          }
          if (level > 75) {
            color = '#ef4444' // Red
          }

          // Draw level bar
          const barHeight = (level / 100) * height
          ctx.fillStyle = color
          ctx.fillRect(0, height - barHeight, width, barHeight)

          // Draw grid lines
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(0, height * 0.25)
          ctx.lineTo(width, height * 0.25)
          ctx.moveTo(0, height * 0.5)
          ctx.lineTo(width, height * 0.5)
          ctx.moveTo(0, height * 0.75)
          ctx.lineTo(width, height * 0.75)
          ctx.stroke()
        }
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    animationRef.current = requestAnimationFrame(draw)

    // Cleanup function
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect()
        analyserRef.current = null
      }
    }
  }, [stream])

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <canvas
        ref={canvasRef}
        width={200}
        height={20}
        className="rounded border border-border"
      />
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Audio Level:</span>
        <span className={cn(
          'font-mono font-medium',
          levelRef.current === 0 && 'text-muted-foreground',
          levelRef.current > 0 && levelRef.current <= 50 && 'text-emerald-500',
          levelRef.current > 50 && levelRef.current <= 75 && 'text-amber-500',
          levelRef.current > 75 && 'text-red-500'
        )}>
          {levelRef.current.toFixed(0)}%
        </span>
      </div>
    </div>
  )
}
