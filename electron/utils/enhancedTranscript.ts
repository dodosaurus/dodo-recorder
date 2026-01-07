import type { RecordedAction, TranscriptSegment } from '../../shared/types'

/**
 * Generates the primary transcript.txt file for LLM consumption and human readability.
 * This is the main output file that combines voice commentary with action and screenshot references.
 *
 * Format:
 * - Voice transcription text flows naturally
 * - Action references embedded inline: [action:ID:TYPE]
 * - Screenshot references embedded inline: [screenshot:FILENAME]
 * - ALL actions and screenshots are referenced in the transcript
 * - References appear at estimated location during commentary
 *
 * Example output:
 * "So, this is the test session. The browser just opened and the URL was visited
 * [action:e6c3069a:navigate] [screenshot:screenshot-001.png]. Now I'm clicking on
 * some top menu items [action:c5922be3:click] [screenshot:screenshot-002.png]
 * [action:72e42724:click] to assert them, to assert my name [action:2e185707:assert].
 * In the hero section, to assert the button is here [action:3ea1708c:assert],
 * LinkedIn button [action:ef955889:click] [screenshot:screenshot-003.png]..."
 *
 * Purpose: Primary handover format for LLM to create Playwright tests, also readable
 * by test automation engineers to understand what happened during the session.
 */

/**
 * Generates the main transcript.txt file with embedded action and screenshot references.
 * This ensures ALL actions and screenshots are referenced in the output, even if there's
 * no voice commentary for some actions.
 */
export function generateTranscriptWithReferences(actions: RecordedAction[]): string {
  if (actions.length === 0) {
    return 'No actions recorded in this session.\n'
  }

  // Sort actions by timestamp
  const sortedActions = [...actions].sort((a, b) => a.timestamp - b.timestamp)

  const lines: string[] = []
  lines.push('# Recording Session Transcript\n')
  lines.push('This transcript combines voice commentary with action and screenshot references.')
  lines.push('Format: [action:ID:TYPE] for actions, [screenshot:FILENAME] for screenshots.\n')

  // Build the narrative
  let narrativeText = ''
  let lastVoiceEndTime = 0
  let actionsWithoutVoice: RecordedAction[] = []

  for (const action of sortedActions) {
    const voiceSegments = action.voiceSegments || []
    
    // Check if this action has voice commentary
    if (voiceSegments.length > 0) {
      // First, flush any actions without voice that accumulated
      if (actionsWithoutVoice.length > 0) {
        for (const silentAction of actionsWithoutVoice) {
          narrativeText += formatActionReference(silentAction)
          if (silentAction.screenshot) {
            narrativeText += ' ' + formatScreenshotReference(silentAction.screenshot)
          }
          narrativeText += ' '
        }
        actionsWithoutVoice = []
      }

      // Add voice commentary for this action
      for (const segment of voiceSegments) {
        // Avoid duplicate text if segments overlap
        if (segment.startTime >= lastVoiceEndTime) {
          if (narrativeText && !narrativeText.endsWith(' ') && !narrativeText.endsWith('\n')) {
            narrativeText += ' '
          }
          narrativeText += segment.text.trim()
          lastVoiceEndTime = segment.endTime
        }
      }

      // Add action reference after the voice commentary
      narrativeText += ' ' + formatActionReference(action)
      if (action.screenshot) {
        narrativeText += ' ' + formatScreenshotReference(action.screenshot)
      }
    } else {
      // No voice for this action, accumulate it
      actionsWithoutVoice.push(action)
    }
  }

  // Flush any remaining actions without voice
  if (actionsWithoutVoice.length > 0) {
    for (const silentAction of actionsWithoutVoice) {
      narrativeText += ' ' + formatActionReference(silentAction)
      if (silentAction.screenshot) {
        narrativeText += ' ' + formatScreenshotReference(silentAction.screenshot)
      }
    }
  }

  lines.push('## Narrative\n')
  lines.push(narrativeText.trim() + '\n')

  // Add a reference section for easy lookup
  lines.push('\n## Action Reference\n')
  lines.push('| Action ID | Type | Timestamp | Target | Screenshot |')
  lines.push('|-----------|------|-----------|--------|------------|')
  
  for (const action of sortedActions) {
    const shortId = action.id.substring(0, 8)
    const timestamp = formatTimestamp(action.timestamp)
    const target = getActionTarget(action)
    const screenshot = action.screenshot || '-'
    
    lines.push(`| ${shortId} | ${action.type} | ${timestamp} | ${target} | ${screenshot} |`)
  }

  return lines.join('\n')
}

/**
 * Get a human-readable target description for an action
 */
function getActionTarget(action: RecordedAction): string {
  if (action.url) return action.url
  if (action.target?.name) return action.target.name
  if (action.target?.role) return action.target.role
  if (action.target?.text) return action.target.text.substring(0, 30)
  if (action.value) return action.value.substring(0, 30)
  return '-'
}

/**
 * Formats an action reference: [action:SHORT_ID:TYPE]
 */
function formatActionReference(action: RecordedAction): string {
  const shortId = action.id.substring(0, 8)
  return `[action:${shortId}:${action.type}]`
}

/**
 * Formats a screenshot reference: [screenshot:FILENAME]
 */
function formatScreenshotReference(filename: string): string {
  return `[screenshot:${filename}]`
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

// ===== LEGACY FUNCTIONS BELOW (kept for backward compatibility if needed) =====

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
      const actionRef = formatActionReferenceLegacy(action, fullActionIds, actionFormat)
      currentSegmentText += ` ${actionRef}`

      // Add screenshot reference if present
      if (action.screenshot) {
        const screenshotRef = formatScreenshotReferenceLegacy(action.screenshot, screenshotFormat)
        currentSegmentText += ` ${screenshotRef}`
      }

      narrativeSegments.push(currentSegmentText)
      currentSegmentText = ''
    } else {
      // No voice for this action, just add the reference
      const actionRef = formatActionReferenceLegacy(action, fullActionIds, actionFormat)
      let ref = actionRef
      
      if (action.screenshot) {
        const screenshotRef = formatScreenshotReferenceLegacy(action.screenshot, screenshotFormat)
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
 * LEGACY: Formats an action reference based on the specified format
 */
function formatActionReferenceLegacy(
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
 * LEGACY: Formats a screenshot reference based on the specified format
 */
function formatScreenshotReferenceLegacy(
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
