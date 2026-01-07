import type { RecordedAction, TranscriptSegment } from '../../shared/types'

/**
 * Generates the primary transcript.txt file for LLM consumption and human readability.
 * This is the main output file that combines voice commentary with action references.
 *
 * Format:
 * - Voice transcription text flows naturally
 * - Action references embedded inline: [action:ID:TYPE]
 * - Screenshot references embedded inline for screenshot actions: [screenshot:FILENAME]
 * - ALL actions are referenced in the transcript
 * - References appear at estimated location during commentary
 *
 * Example output:
 * "So, this is the test session. The browser just opened and the URL was visited
 * [action:e6c3069a:navigate]. Now I'm clicking on some top menu items
 * [action:c5922be3:click] [action:72e42724:click] to assert them, to assert my name
 * [action:2e185707:assert]. In the hero section, to assert the button is here
 * [action:3ea1708c:assert], LinkedIn button [action:ef955889:click]. Taking a
 * screenshot now [action:4a62c1b8:screenshot] [screenshot:screenshot-3655.png]..."
 *
 * Purpose: Primary handover format for LLM to create Playwright tests, also readable
 * by test automation engineers to understand what happened during the session.
 */

/**
 * Generates the main transcript.txt file with embedded action references.
 * This ensures ALL actions are referenced in the output, even if there's
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
          // Only add screenshot reference for screenshot actions
          if (silentAction.type === 'screenshot' && silentAction.screenshot) {
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
      // Only add screenshot reference for screenshot actions
      if (action.type === 'screenshot' && action.screenshot) {
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
      // Only add screenshot reference for screenshot actions
      if (silentAction.type === 'screenshot' && silentAction.screenshot) {
        narrativeText += ' ' + formatScreenshotReference(silentAction.screenshot)
      }
    }
  }

  lines.push('## Narrative\n')
  lines.push(narrativeText.trim() + '\n')

  // Add a reference section for easy lookup
  lines.push('\n## Action Reference\n')
  lines.push('| Action ID | Type | Timestamp | Target |')
  lines.push('|-----------|------|-----------|--------|')
  
  for (const action of sortedActions) {
    const shortId = action.id.substring(0, 8)
    const timestamp = formatTimestamp(action.timestamp)
    const target = getActionTarget(action)
    
    lines.push(`| ${shortId} | ${action.type} | ${timestamp} | ${target} |`)
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

