import { useEffect, useState } from 'react'
import { Minus, Square, X } from 'lucide-react'

export function TitleBar() {
  const [platform, setPlatform] = useState<'darwin' | 'win32'>('darwin')

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase()
    if (userAgent.includes('win')) {
      setPlatform('win32')
    } else {
      setPlatform('darwin')
    }
  }, [])

  const isMac = platform === 'darwin'

  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow?.()
  }

  const handleMaximize = () => {
    window.electronAPI?.maximizeWindow?.()
  }

  const handleClose = () => {
    window.electronAPI?.closeWindow?.()
  }

  return (
    <div 
      className="title-bar flex-shrink-0 h-9 bg-card border-b border-border flex items-center justify-between"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {isMac ? (
        <>
          <div className="w-20" />
          <div className="flex-1" />
        </>
      ) : (
        <>
          <div className="flex-1" />
          <div 
            className="flex items-center h-full"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <button
              onClick={handleMinimize}
              className="h-full px-4 hover:bg-secondary transition-colors flex items-center justify-center"
            >
              <Minus className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={handleMaximize}
              className="h-full px-4 hover:bg-secondary transition-colors flex items-center justify-center"
            >
              <Square className="w-3 h-3 text-muted-foreground" />
            </button>
            <button
              onClick={handleClose}
              className="h-full px-4 hover:bg-destructive transition-colors flex items-center justify-center"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

