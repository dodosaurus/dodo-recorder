import { useRecordingStore } from '@/stores/recordingStore'
import { MousePointer2, Type, Navigation, Keyboard, ListChecks, Camera, Target, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import type { ActionType } from '@/types/session'

const actionIcons: Record<ActionType, typeof MousePointer2> = {
  click: MousePointer2,
  fill: Type,
  navigate: Navigation,
  keypress: Keyboard,
  select: ListChecks,
  check: ListChecks,
  scroll: MousePointer2,
  assert: Target,
  screenshot: Camera,
}

const actionColors: Record<ActionType, string> = {
  click: 'text-blue-400 hover:text-blue-300',
  fill: 'text-green-400 hover:text-green-300',
  navigate: 'text-purple-400 hover:text-purple-300',
  keypress: 'text-yellow-400 hover:text-yellow-300',
  select: 'text-orange-400 hover:text-orange-300',
  check: 'text-orange-400 hover:text-orange-300',
  scroll: 'text-cyan-400 hover:text-cyan-300',
  assert: 'text-pink-400 hover:text-pink-300',
  screenshot: 'text-indigo-400 hover:text-indigo-300',
}

interface TranscriptPart {
  type: 'text' | 'action' | 'screenshot'
  content: string
  actionId?: string
  actionType?: ActionType
  screenshotFilename?: string
}

export function TranscriptView() {
  const { transcriptText, actions, setHighlightedActionId, setTranscriptViewOpen } = useRecordingStore(
    useShallow((state) => ({
      transcriptText: state.transcriptText,
      actions: state.actions,
      setHighlightedActionId: state.setHighlightedActionId,
      setTranscriptViewOpen: state.setTranscriptViewOpen,
    }))
  )

  // Extract only the Narrative section from transcript
  const extractNarrative = (text: string): string => {
    const narrativeMatch = text.match(/## Narrative\s*\n\s*([\s\S]*?)(?:\n\n## Action Reference|$)/)
    if (narrativeMatch && narrativeMatch[1]) {
      return narrativeMatch[1].trim()
    }
    return text
  }

  // Parse transcript text to extract action references and screenshot references
  const parseTranscript = (text: string): TranscriptPart[] => {
    const parts: TranscriptPart[] = []
    let lastIndex = 0
    
    // Match [action:SHORT_ID:TYPE] and [screenshot:FILENAME]
    const regex = /\[(action|screenshot):([^\]]+)\]/g
    let match
    
    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        const textContent = text.slice(lastIndex, match.index)
        if (textContent) {
          parts.push({ type: 'text', content: textContent })
        }
      }
      
      const [fullMatch, refType, refContent] = match
      
      if (refType === 'action') {
        const [shortId, actionType] = refContent.split(':')
        parts.push({
          type: 'action',
          content: fullMatch,
          actionId: shortId,
          actionType: actionType as ActionType,
        })
      } else if (refType === 'screenshot') {
        parts.push({
          type: 'screenshot',
          content: fullMatch,
          screenshotFilename: refContent,
        })
      }
      
      lastIndex = regex.lastIndex
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex)
      if (remainingText) {
        parts.push({ type: 'text', content: remainingText })
      }
    }
    
    return parts
  }

  const narrativeText = extractNarrative(transcriptText)
  const parts = parseTranscript(narrativeText)

  const handleActionClick = (shortId: string) => {
    // Find the full action ID by matching the short ID prefix
    const action = actions.find(a => a.id.startsWith(shortId))
    if (action) {
      setHighlightedActionId(action.id)
      // Scroll to the action in ActionsList
      setTimeout(() => {
        const element = document.querySelector(`[data-action-id="${action.id}"]`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    }
  }

  const handleClose = () => {
    setTranscriptViewOpen(false)
  }

  if (!transcriptText) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">No transcript available yet. Record a session first.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <div className="flex-shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">Transcript</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click on actions to highlight them in the list
          </p>
        </div>
        <button
          onClick={handleClose}
          className="p-1.5 rounded-md hover:bg-secondary transition-colors"
          title="Close transcript"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto text-base leading-relaxed space-y-1">
          {parts.map((part, index) => {
            if (part.type === 'text') {
              return (
                <span key={`text-${index}`} className="text-foreground/95 text-base leading-relaxed">
                  {part.content}
                </span>
              )
            }

            if (part.type === 'action' && part.actionId && part.actionType) {
              const Icon = actionIcons[part.actionType] || MousePointer2
              const colorClass = actionColors[part.actionType] || 'text-muted-foreground'
              
              return (
                <button
                  key={`action-${index}`}
                  onClick={() => handleActionClick(part.actionId!)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-1 mx-0.5 rounded-md',
                    'bg-secondary/50 hover:bg-secondary transition-colors',
                    'cursor-pointer select-none align-middle',
                    colorClass
                  )}
                  title={`Click to highlight action ${part.actionId}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs font-mono font-medium">
                    {part.actionId}:{part.actionType}
                  </span>
                </button>
              )
            }

            if (part.type === 'screenshot' && part.screenshotFilename) {
              return (
                <span
                  key={`screenshot-${index}`}
                  className="inline-flex items-center gap-1.5 px-2 py-1 mx-0.5 rounded-md bg-indigo-500/10 text-indigo-400 align-middle"
                  title={`Screenshot: ${part.screenshotFilename}`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span className="text-xs font-mono font-medium">
                    {part.screenshotFilename}
                  </span>
                </span>
              )
            }

            return null
          })}
        </div>
      </div>
    </div>
  )
}
