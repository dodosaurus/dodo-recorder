import type { RecordedAction, TranscriptSegment } from '../../shared/types'

/**
 * Generates an enhanced narrative transcript that embeds action IDs inline
 * This format is optimized for LLM consumption, providing a readable narrative
 * with direct references to specific actions and screenshots.
 * 
 * Format: "narrative text [action:ACTION_ID] more text [screenshot:SCREENSHOT_ID]"
 * 
 * Example output:
 * "So, this is the test session. The browser just opened and the URL was visited 
 * [action:e6c3069a]. Now I'm clicking on some top menu items [action:c5922be3] 
 * [action:72e42724] to assert them, to assert my name [action:2e185707]. In the 
 * hero section, to assert the button is here [action:3ea1708c], LinkedIn button 
 * [action:ef955889], GitHub button [action:037f6c8b], scrolling a bit 
 * [screenshot:screenshot-24840.png], now navigating via top menu..."
 */

interface EnhancedTranscriptOptions {
  /** Include full action IDs (default: false, uses short 8-char IDs) */
  fullActionIds?: boolean
  /** Format for action references (default: 'action:ID') */
  actionFormat?: 'action:ID' | 'act:ID' | '#ID'
  /** Format for screenshot references (default: 'screenshot:FILENAME') */
  screenshotFormat?: 'screenshot:FILENAME' | 'img:FILENAME' | '@FILENAME'
}

/**
 * Generates an enhanced narrative transcript with embedded action/screenshot references
 */
export function generateEnhancedTranscript(
  actions: RecordedAction[],
  options: EnhancedTranscriptOptions = {}
): string {
  const {
    fullActionIds = false,
    actionFormat = 'action:ID',
    screenshotFormat = 'screenshot:FILENAME',
  } = options

  if (actions.length === 0) {
    return 'No actions recorded in this session.'
  }

  // Sort actions by timestamp
  const sortedActions = [...actions].sort((a, b) => a.timestamp - b.timestamp)

  // Build narrative segments with embedded references
  const narrativeSegments: string[] = []
  let currentSegmentText = ''
  let lastVoiceEndTime = 0

  for (const action of sortedActions) {
    const voiceSegments = action.voiceSegments || []
    
    // Process voice segments for this action
    for (const segment of voiceSegments) {
      // Avoid duplicate text if segments overlap
      if (segment.startTime >= lastVoiceEndTime) {
        if (currentSegmentText && !currentSegmentText.endsWith(' ')) {
          currentSegmentText += ' '
        }
        currentSegmentText += segment.text.trim()
        lastVoiceEndTime = segment.endTime
      }
    }

    // Add action reference after the voice commentary
    if (currentSegmentText) {
      // Add action reference
      const actionRef = formatActionReference(action, fullActionIds, actionFormat)
      currentSegmentText += ` ${actionRef}`

      // Add screenshot reference if present
      if (action.screenshot) {
        const screenshotRef = formatScreenshotReference(action.screenshot, screenshotFormat)
        currentSegmentText += ` ${screenshotRef}`
      }

      narrativeSegments.push(currentSegmentText)
      currentSegmentText = ''
    } else {
      // No voice for this action, just add the reference
      const actionRef = formatActionReference(action, fullActionIds, actionFormat)
      let ref = actionRef
      
      if (action.screenshot) {
        const screenshotRef = formatScreenshotReference(action.screenshot, screenshotFormat)
        ref += ` ${screenshotRef}`
      }
      
      narrativeSegments.push(ref)
    }
  }

  // Add any remaining text
  if (currentSegmentText) {
    narrativeSegments.push(currentSegmentText)
  }

  return narrativeSegments.join(' ')
}

/**
 * Formats an action reference based on the specified format
 */
function formatActionReference(
  action: RecordedAction,
  fullId: boolean,
  format: string
): string {
  const id = fullId ? action.id : action.id.substring(0, 8)
  const actionType = action.type
  
  switch (format) {
    case 'act:ID':
      return `[act:${id}]`
    case '#ID':
      return `[#${id}]`
    case 'action:ID':
    default:
      return `[action:${id}:${actionType}]`
  }
}

/**
 * Formats a screenshot reference based on the specified format
 */
function formatScreenshotReference(
  filename: string,
  format: string
): string {
  switch (format) {
    case 'img:FILENAME':
      return `[img:${filename}]`
    case '@FILENAME':
      return `[@${filename}]`
    case 'screenshot:FILENAME':
    default:
      return `[screenshot:${filename}]`
  }
}

/**
 * Generates a detailed enhanced transcript with action metadata
 * This version includes more context about each action for LLM analysis
 */
export function generateDetailedEnhancedTranscript(
  actions: RecordedAction[]
): string {
  if (actions.length === 0) {
    return 'No actions recorded in this session.'
  }

  const sortedActions = [...actions].sort((a, b) => a.timestamp - b.timestamp)
  const lines: string[] = []

  lines.push('# Enhanced Session Transcript with Action References\n')
  lines.push('This transcript embeds action IDs inline for easy LLM parsing and reference.\n')

  let narrativeText = ''
  let lastVoiceEndTime = 0

  for (const action of sortedActions) {
    const voiceSegments = action.voiceSegments || []
    
    // Collect voice commentary
    for (const segment of voiceSegments) {
      if (segment.startTime >= lastVoiceEndTime) {
        if (narrativeText && !narrativeText.endsWith(' ')) {
          narrativeText += ' '
        }
        narrativeText += segment.text.trim()
        lastVoiceEndTime = segment.endTime
      }
    }

    // Add action reference
    const shortId = action.id.substring(0, 8)
    const timestamp = formatTimestamp(action.timestamp)
    
    if (narrativeText) {
      narrativeText += ` [action:${shortId}:${action.type}]`
      if (action.screenshot) {
        narrativeText += ` [screenshot:${action.screenshot}]`
      }
    } else {
      // Silent action
      narrativeText += ` [action:${shortId}:${action.type}]`
      if (action.screenshot) {
        narrativeText += ` [screenshot:${action.screenshot}]`
      }
    }
  }

  lines.push('## Narrative\n')
  lines.push(narrativeText + '\n')
  
  lines.push('\n## Action Reference Table\n')
  lines.push('| Short ID | Type | Timestamp | Target | Screenshot |')
  lines.push('|----------|------|-----------|--------|------------|')
  
  for (const action of sortedActions) {
    const shortId = action.id.substring(0, 8)
    const timestamp = formatTimestamp(action.timestamp)
    const target = action.target?.name || action.url || '-'
    const screenshot = action.screenshot || '-'
    
    lines.push(`| ${shortId} | ${action.type} | ${timestamp} | ${target} | ${screenshot} |`)
  }

  return lines.join('\n')
}

/**
 * Formats timestamp in MM:SS format
 */
function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Extracts action IDs from enhanced transcript text
 * Useful for parsing and validation
 */
export function extractActionIds(enhancedTranscript: string): string[] {
  const actionPattern = /\[action:([a-f0-9-]+)(?::[a-z]+)?\]/g
  const matches = enhancedTranscript.matchAll(actionPattern)
  return Array.from(matches, m => m[1])
}

/**
 * Extracts screenshot references from enhanced transcript text
 */
export function extractScreenshots(enhancedTranscript: string): string[] {
  const screenshotPattern = /\[screenshot:([^\]]+)\]/g
  const matches = enhancedTranscript.matchAll(screenshotPattern)
  return Array.from(matches, m => m[1])
}
