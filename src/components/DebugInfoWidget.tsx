import { useEffect, useState } from 'react'
import { FileText, FolderOpen, GitCommit, ChevronDown, ChevronUp } from 'lucide-react'
import type { BuildInfo } from '@/types/electron'

export function DebugInfoWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [logPath, setLogPath] = useState<string | null>(null)
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null)

  // Get build info from Vite define (dev mode) or IPC (production)
  useEffect(() => {
    // In dev mode, use Vite define
    if (typeof __BUILD_INFO__ !== 'undefined') {
      setBuildInfo(__BUILD_INFO__)
      return
    }

    // In production, fetch from main process
    if (window.electronAPI?.getBuildInfo) {
      window.electronAPI.getBuildInfo().then(setBuildInfo).catch(console.error)
    }
  }, [])

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

  const commitHash = buildInfo?.commitHash || 'unknown'

  return (
    <div className="relative">
      {/* Toggle button - always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/50 rounded transition-colors"
        title="Debug info"
      >
        <span className="font-mono text-[10px]">{commitHash}</span>
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {/* Collapsible panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-50 p-3">
          {/* Build Info Section */}
          {buildInfo && (
            <div className="mb-3 pb-3 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Build Info</span>
              </div>
              <div className="space-y-1 text-[10px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Commit:</span>
                  <span className="font-mono text-foreground">{commitHash}</span>
                </div>
                <div className="flex justify-between">
                  <span>Branch:</span>
                  <span className="font-mono text-foreground">{buildInfo.branch}</span>
                </div>
                <div className="flex justify-between">
                  <span>Built:</span>
                  <span className="font-mono text-foreground">{new Date(buildInfo.buildTime).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Node:</span>
                  <span className="font-mono text-foreground">{buildInfo.nodeVersion}</span>
                </div>
              </div>
            </div>
          )}

          {/* Logs Section */}
          {logPath && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Logs</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={openLogFile}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                  title="Open log file"
                >
                  <FileText className="h-3 w-3" />
                </button>
                <button
                  onClick={openLogFolder}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                  title="Open logs folder"
                >
                  <FolderOpen className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
