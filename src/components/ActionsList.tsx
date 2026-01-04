import { useRecordingStore } from '@/stores/recordingStore'
import { formatTimestamp, cn } from '@/lib/utils'
import { MousePointer2, Type, Navigation, Keyboard, ListChecks, Trash2, Target, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useShallow } from 'zustand/react/shallow'
import { useState } from 'react'
import type { RecordedAction, ActionType, Locator } from '@/types/session'

const actionIcons: Record<ActionType, typeof MousePointer2> = {
  click: MousePointer2,
  fill: Type,
  navigate: Navigation,
  keypress: Keyboard,
  select: ListChecks,
  check: ListChecks,
  scroll: MousePointer2,
  assert: Target,
}

const actionColors: Record<ActionType, string> = {
  click: 'text-blue-400',
  fill: 'text-green-400',
  navigate: 'text-purple-400',
  keypress: 'text-yellow-400',
  select: 'text-orange-400',
  check: 'text-orange-400',
  scroll: 'text-cyan-400',
  assert: 'text-pink-400',
}

const strategyLabels: Record<string, string> = {
  testId: 'Test ID',
  id: 'ID',
  role: 'Role',
  placeholder: 'Placeholder',
  text: 'Text',
  css: 'CSS',
  xpath: 'XPath',
}

const confidenceColors: Record<string, string> = {
  high: 'text-green-500',
  medium: 'text-yellow-500',
  low: 'text-red-400',
}

function getActionDescription(action: RecordedAction): string {
  switch (action.type) {
    case 'click':
      return action.target?.name || action.target?.selector || 'Element'
    case 'fill': {
      const fieldName = action.target?.placeholder || action.target?.name || action.target?.selector || 'Field'
      const value = action.value ? `"${action.value.slice(0, 30)}${action.value.length > 30 ? '...' : ''}"` : ''
      return `${fieldName} → ${value}`
    }
    case 'navigate':
      return action.url || ''
    case 'keypress':
      return action.key || ''
    case 'select':
      return `${action.target?.name || 'Select'} → ${action.value}`
    case 'assert':
      return action.target?.innerText?.slice(0, 50) || action.target?.name || action.target?.tagName || 'Element'
    default:
      return action.target?.selector || ''
  }
}

function LocatorBadge({ locator }: { locator: Locator }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={cn('font-mono', confidenceColors[locator.confidence])}>●</span>
      <span className="text-muted-foreground">{strategyLabels[locator.strategy] || locator.strategy}:</span>
      <code className="text-primary truncate max-w-[200px]" title={locator.value}>
        {locator.value}
      </code>
    </div>
  )
}

export function ActionsList() {
  const { actions, removeAction, status } = useRecordingStore(useShallow((state) => ({
    actions: state.actions,
    removeAction: state.removeAction,
    status: state.status,
  })))

  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedActions(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (actions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-secondary flex items-center justify-center">
            <MousePointer2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">No actions recorded yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Start recording to capture browser interactions
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="divide-y divide-border">
        {actions.map((action, index) => {
          const Icon = actionIcons[action.type] || MousePointer2
          const colorClass = actionColors[action.type] || 'text-muted-foreground'
          const description = getActionDescription(action)
          const hasLocators = action.target?.locators && action.target.locators.length > 0
          const isExpanded = expandedActions.has(action.id)

          return (
            <div
              key={action.id}
              className="group px-4 py-3 hover:bg-card transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 pt-0.5">
                  <span className="text-xs text-muted-foreground font-mono w-6 inline-block">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                
                <div className={cn('flex-shrink-0 p-1.5 rounded bg-secondary', colorClass)}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {action.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(action.timestamp)}
                    </span>
                    {action.type === 'assert' && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400">
                        assertion
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground mt-0.5 truncate" title={description}>
                    {description}
                  </p>
                  
                  {hasLocators && (
                    <button
                      onClick={() => toggleExpand(action.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1.5 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {action.target!.locators!.length} locator{action.target!.locators!.length > 1 ? 's' : ''}
                    </button>
                  )}
                </div>

                {status !== 'recording' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                    onClick={() => removeAction(action.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                )}
              </div>
              
              {hasLocators && isExpanded && (
                <div className="mt-2 ml-[52px] space-y-1.5 pb-1">
                  {action.target!.locators!.map((locator, i) => (
                    <LocatorBadge key={i} locator={locator} />
                  ))}
                  {action.type === 'assert' && action.target?.innerText && (
                    <div className="text-xs text-muted-foreground mt-2 p-2 bg-secondary/50 rounded">
                      <span className="text-muted-foreground">Content: </span>
                      <span className="text-foreground">"{action.target.innerText.slice(0, 100)}"</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
