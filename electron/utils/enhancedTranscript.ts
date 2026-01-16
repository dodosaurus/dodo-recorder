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
 * - Actions are interleaved within sentences based on timestamp proximity
 *
 * Example output:
 * "So, this is the test session [action:e6c3069a:navigate]. Now I'm clicking on some
 * top menu items [action:c5922be3:click] [action:72e42724:click] to assert them.
 * To assert my name [action:2e185707:assert] in the hero section. To assert the button
 * is here [action:3ea1708c:assert] LinkedIn button [action:ef955889:click]. Taking a
 * screenshot now [action:4a62c1b8:screenshot] [screenshot:screenshot-3655.png]..."
 *
 * Purpose: Primary handover format for AI test generation, framework-agnostic,
 * also readable by test automation engineers to understand what happened during the session.
 */

/**
 * Interface for a sentence with calculated timestamps
 */
interface SentenceWithTime {
  text: string
  startTime: number
  endTime: number
}

/**
 * Splits text into sentences and calculates proportional timestamps for each.
 * Splits on sentence boundaries: period, exclamation mark, question mark.
 *
 * @param text - The text to split
 * @param segmentStartTime - Start time of the voice segment in ms
 * @param segmentEndTime - End time of the voice segment in ms
 * @returns Array of sentences with calculated timestamps
 */
function splitIntoSentencesWithTimestamps(
  text: string,
  segmentStartTime: number,
  segmentEndTime: number
): SentenceWithTime[] {
  // Split by sentence boundaries while keeping the delimiter
  const sentencePattern = /([^.!?]+[.!?]+)/g
  const matches = text.match(sentencePattern)
  
  if (!matches || matches.length === 0) {
    // No sentence delimiters found, return whole text
    return [{
      text: text.trim(),
      startTime: segmentStartTime,
      endTime: segmentEndTime
    }]
  }
  
  const sentences: SentenceWithTime[] = []
  const totalDuration = segmentEndTime - segmentStartTime
  const totalLength = text.length
  
  let currentPosition = 0
  
  for (const sentence of matches) {
    const sentenceText = sentence.trim()
    if (sentenceText.length === 0) continue
    
    const sentenceLength = sentence.length
    
    // Calculate proportional time for this sentence based on character length
    const startRatio = currentPosition / totalLength
    const endRatio = (currentPosition + sentenceLength) / totalLength
    
    const sentenceStart = segmentStartTime + (totalDuration * startRatio)
    const sentenceEnd = segmentStartTime + (totalDuration * endRatio)
    
    sentences.push({
      text: sentenceText,
      startTime: Math.round(sentenceStart),
      endTime: Math.round(sentenceEnd)
    })
    
    currentPosition += sentenceLength
  }
  
  // Handle any remaining text that didn't match (text without proper sentence ending)
  const lastMatchEnd = matches.join('').length
  if (lastMatchEnd < text.length) {
    const remainingText = text.substring(lastMatchEnd).trim()
    if (remainingText.length > 0) {
      sentences.push({
        text: remainingText,
        startTime: sentences.length > 0 ? sentences[sentences.length - 1].endTime : segmentStartTime,
        endTime: segmentEndTime
      })
    }
  }
  
  return sentences
}

/**
 * Interleaves actions within text based on sentence timestamps.
 * Actions are placed after the sentence whose time range contains the action timestamp.
 *
 * @param sentences - Array of sentences with timestamps
 * @param actions - Actions to interleave (must have timestamps within sentence range)
 * @returns Formatted text with actions interleaved
 */
function interleaveActionsInText(
  sentences: SentenceWithTime[],
  actions: RecordedAction[]
): string {
  if (sentences.length === 0) return ''
  if (actions.length === 0) {
    return sentences.map(s => s.text).join(' ')
  }
  
  // Sort actions by timestamp
  const sortedActions = [...actions].sort((a, b) => a.timestamp - b.timestamp)
  
  let result = ''
  let actionIndex = 0
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    result += sentence.text
    
    // Find all actions that should appear after this sentence
    const actionsToInsert: RecordedAction[] = []
    
    while (actionIndex < sortedActions.length) {
      const action = sortedActions[actionIndex]
      
      // Action belongs after this sentence if:
      // 1. Action timestamp is within this sentence's time range, OR
      // 2. Action timestamp is before next sentence starts (or this is last sentence)
      const isInSentenceRange = action.timestamp >= sentence.startTime && action.timestamp <= sentence.endTime
      const isBeforeNextSentence = i === sentences.length - 1 || action.timestamp < sentences[i + 1].startTime
      
      if (isInSentenceRange || (isBeforeNextSentence && action.timestamp <= sentence.endTime)) {
        actionsToInsert.push(action)
        actionIndex++
      } else if (action.timestamp <= sentence.endTime) {
        // Action is in this sentence's range but we'll check next iteration
        actionsToInsert.push(action)
        actionIndex++
      } else {
        // Action is after this sentence
        break
      }
    }
    
    // Insert action references
    if (actionsToInsert.length > 0) {
      result += ' '
      for (const action of actionsToInsert) {
        result += formatActionReference(action)
        if (action.type === 'screenshot' && action.screenshot) {
          result += ' ' + formatScreenshotReference(action.screenshot)
        }
        result += ' '
      }
    }
    
    // Add space between sentences if not last
    if (i < sentences.length - 1 && !result.endsWith(' ')) {
      result += ' '
    }
  }
  
  // Handle any remaining actions that weren't inserted (edge case)
  while (actionIndex < sortedActions.length) {
    const action = sortedActions[actionIndex]
    result += formatActionReference(action)
    if (action.type === 'screenshot' && action.screenshot) {
      result += ' ' + formatScreenshotReference(action.screenshot)
    }
    result += ' '
    actionIndex++
  }
  
  return result.trim()
}

/**
 * Builds the narrative text with sentence-level action distribution.
 * This is the core improved algorithm that distributes actions throughout the text
 * based on timestamp proximity rather than just appending them at the end.
 *
 * IMPORTANT: Each action appears EXACTLY ONCE at its most meaningful location
 * (closest to the action's actual timestamp).
 *
 * @param actions - Sorted array of actions with voiceSegments attached
 * @returns Narrative text with actions interleaved at precise locations
 */
function buildNarrativeWithSentenceLevelDistribution(actions: RecordedAction[]): string {
  let narrativeText = ''
  const processedSegments = new Set<string>() // Track segments to avoid duplicates
  const placedActions = new Set<string>() // Track actions to ensure each appears only once
  
  // Determine the best segment for each action (closest to action timestamp)
  const actionToBestSegmentMap = new Map<string, string>()
  
  for (const action of actions) {
    const voiceSegments = action.voiceSegments || []
    
    if (voiceSegments.length === 0) {
      // Will be placed at end
      continue
    }
    
    // Find the segment closest to the action's timestamp
    let bestSegment = voiceSegments[0]
    let bestDistance = Math.abs(action.timestamp - getSegmentMidpoint(voiceSegments[0]))
    
    for (const segment of voiceSegments) {
      const distance = Math.abs(action.timestamp - getSegmentMidpoint(segment))
      if (distance < bestDistance) {
        bestDistance = distance
        bestSegment = segment
      }
    }
    
    const segmentKey = `${bestSegment.id}-${bestSegment.startTime}-${bestSegment.endTime}`
    actionToBestSegmentMap.set(action.id, segmentKey)
  }
  
  // Group actions by their best segment
  const segmentToActionsMap = new Map<string, RecordedAction[]>()
  const actionsWithoutVoice: RecordedAction[] = []
  
  for (const action of actions) {
    const bestSegmentKey = actionToBestSegmentMap.get(action.id)
    
    if (!bestSegmentKey) {
      actionsWithoutVoice.push(action)
    } else {
      if (!segmentToActionsMap.has(bestSegmentKey)) {
        segmentToActionsMap.set(bestSegmentKey, [])
      }
      segmentToActionsMap.get(bestSegmentKey)!.push(action)
    }
  }
  
  // Collect all unique segments in chronological order
  const allSegments: TranscriptSegment[] = []
  for (const action of actions) {
    if (action.voiceSegments) {
      for (const segment of action.voiceSegments) {
        const segmentKey = `${segment.id}-${segment.startTime}-${segment.endTime}`
        if (!processedSegments.has(segmentKey)) {
          allSegments.push(segment)
          processedSegments.add(segmentKey)
        }
      }
    }
  }
  
  // Sort segments by start time
  allSegments.sort((a, b) => a.startTime - b.startTime)
  
  // Process each segment
  for (const segment of allSegments) {
    const segmentKey = `${segment.id}-${segment.startTime}-${segment.endTime}`
    const segmentActions = segmentToActionsMap.get(segmentKey) || []
    
    // Filter out already placed actions
    const actionsToPlace = segmentActions.filter(action => !placedActions.has(action.id))
    
    if (actionsToPlace.length === 0 && segmentActions.length === 0) {
      // Segment with no actions - just add text
      if (narrativeText && !narrativeText.endsWith(' ')) {
        narrativeText += ' '
      }
      narrativeText += segment.text.trim()
    } else if (actionsToPlace.length === 0) {
      // All actions already placed in previous segments, just add text
      if (narrativeText && !narrativeText.endsWith(' ')) {
        narrativeText += ' '
      }
      narrativeText += segment.text.trim()
    } else {
      // Split segment into sentences with timestamps
      const sentences = splitIntoSentencesWithTimestamps(
        segment.text,
        segment.startTime,
        segment.endTime
      )
      
      // Interleave actions within sentences
      const interleavedText = interleaveActionsInText(sentences, actionsToPlace)
      
      // Mark these actions as placed
      actionsToPlace.forEach(action => placedActions.add(action.id))
      
      if (narrativeText && !narrativeText.endsWith(' ')) {
        narrativeText += ' '
      }
      narrativeText += interleavedText
    }
  }
  
  // Append actions without voice that haven't been placed yet
  const unplacedActions = actionsWithoutVoice.filter(action => !placedActions.has(action.id))
  
  if (unplacedActions.length > 0) {
    if (narrativeText && !narrativeText.endsWith(' ')) {
      narrativeText += ' '
    }
    for (const action of unplacedActions) {
      narrativeText += formatActionReference(action)
      if (action.type === 'screenshot' && action.screenshot) {
        narrativeText += ' ' + formatScreenshotReference(action.screenshot)
      }
      narrativeText += ' '
      placedActions.add(action.id)
    }
  }
  
  return narrativeText.trim()
}

/**
 * Helper: Calculate the midpoint timestamp of a voice segment
 */
function getSegmentMidpoint(segment: TranscriptSegment): number {
  return (segment.startTime + segment.endTime) / 2
}

/**
 * Generates the main transcript.txt file with embedded action references
 * and comprehensive header for AI agents.
 */
export function generateTranscriptWithReferences(
  actions: RecordedAction[],
  sessionId: string,
  startTime: number,
  startUrl?: string
): string {
  if (actions.length === 0) {
    return 'No actions recorded in this session.\n'
  }

  // Sort actions by timestamp
  const sortedActions = [...actions].sort((a, b) => a.timestamp - b.timestamp)
  
  // Calculate duration
  const firstAction = sortedActions[0]
  const lastAction = sortedActions[sortedActions.length - 1]
  const durationMs = lastAction.timestamp - firstAction.timestamp
  const durationFormatted = formatDuration(durationMs)
  
  // Count action types
  const actionTypeCounts = sortedActions.reduce((acc, action) => {
    acc[action.type] = (acc[action.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const lines: string[] = []
  
  // Header with session metadata
  lines.push('# Recording Session Transcript\n')
  lines.push(`**Session ID**: ${sessionId}`)
  lines.push(`**Start Time**: ${new Date(startTime).toISOString()}`)
  lines.push(`**Duration**: ${durationFormatted}`)
  if (startUrl) {
    lines.push(`**Starting URL**: ${startUrl}`)
  }
  lines.push(`**Total Actions**: ${sortedActions.length}`)
  lines.push(`**Action Types**: ${Object.entries(actionTypeCounts).map(([type, count]) => `${count} ${type}`).join(', ')}`)
  lines.push(`**Format Version**: 1.0`)
  lines.push(`**Generated By**: Dodo Recorder\n`)
  lines.push('---\n')
  
  // AI usage instructions
  lines.push('## For AI Test Generation Agents\n')
  lines.push('This session bundle is a **standalone artifact** for generating browser automation tests.')
  lines.push('It works with any test framework: Playwright, Cypress, Selenium, Puppeteer, etc.\n')
  
  lines.push('### Bundle Structure\n')
  lines.push('1. **transcript.txt** (this file) - Human narrative with embedded action references')
  lines.push('2. **actions.json** - Detailed action metadata with multiple locator strategies')
  lines.push('3. **screenshots/** - Visual captures of browser state during recording\n')
  
  lines.push('### How to Parse This Data\n')
  lines.push('#### Step 1: Understand Action References')
  lines.push('The narrative below contains action references in format: `[action:SHORT_ID:TYPE]`')
  lines.push('- `SHORT_ID` = First 8 characters of the full UUID in actions.json')
  lines.push('- `TYPE` = Action type (click, fill, assert, navigate, screenshot, etc.)')
  lines.push('- Example: `[action:8c61934e:click]` maps to `"id": "8c61934e-4cd3-4793-bdb5-5c1c6d696f37"` in actions.json\n')
  
  lines.push('#### Step 2: Cross-Reference with actions.json')
  lines.push('For each action reference:')
  lines.push('1. Extract the 8-character prefix (e.g., `8c61934e`)')
  lines.push('2. Find the matching action in actions.json by searching for IDs starting with this prefix')
  lines.push('3. Use the `target.locators` array for multiple element identification strategies')
  lines.push('4. Consider `confidence` levels when choosing selectors:\n')
  lines.push('   - `high`: Preferred, most reliable (e.g., testId, unique text)')
  lines.push('   - `medium`: Acceptable, reasonably stable (e.g., role with name, CSS with ID)')
  lines.push('   - `low`: Use only if no better alternative (e.g., nth-child selectors, complex XPath)\n')
  
  lines.push('#### Step 3: Use Locator Strategies')
  lines.push('Each action provides multiple locator strategies. Choose based on your framework and preferences:')
  lines.push('- **testId**: `data-testid` attributes - Most stable, framework-agnostic')
  lines.push('- **text**: Element text content - Good for buttons, links, labels')
  lines.push('- **placeholder**: Input placeholder attribute - Best for form inputs')
  lines.push('- **role**: ARIA role with accessible name - Semantic, accessibility-friendly')
  lines.push('- **css**: CSS selectors - Framework-agnostic but potentially brittle')
  lines.push('- **xpath**: XPath expressions - Universal but harder to maintain\n')
  
  lines.push('**Recommended priority**: testId > text/placeholder/role > css > xpath\n')
  
  lines.push('#### Step 4: Interpret Action Types')
  lines.push('- **navigate**: Page navigation or URL change')
  lines.push('- **click**: User click interaction')
  lines.push('- **fill**: Text input (input fields, textareas)')
  lines.push('- **assert**: Element visibility/existence check (intended for verification)')
  lines.push('- **screenshot**: Manual screenshot capture')
  lines.push('- **keypress**: Keyboard input')
  lines.push('- **select**: Dropdown selection')
  lines.push('- **check**: Checkbox/radio button interaction')
  lines.push('- **scroll**: Page scroll action\n')
  
  lines.push('#### Step 5: Use Voice Commentary for Context')
  lines.push('Voice commentary (the narrative text) provides:')
  lines.push('- **User intent**: Why actions were performed')
  lines.push('- **Expected outcomes**: What should happen after each action')
  lines.push('- **Test organization**: Hints about test structure ("smoke test", "assert visibility", etc.)')
  lines.push('- **Business context**: Real-world meaning of the interactions\n')
  
  lines.push('Use this information to:')
  lines.push('- Generate meaningful test names and descriptions')
  lines.push('- Create logical test groupings and assertions')
  lines.push('- Add helpful code comments')
  lines.push('- Understand the expected behavior being tested\n')
  
  lines.push('#### Step 6: Screenshots')
  lines.push('Screenshot actions include a `screenshot` field with the filename.')
  lines.push('Both the transcript narrative and actions.json reference these files.')
  lines.push('Use screenshots for:')
  lines.push('- Visual regression testing')
  lines.push('- Debugging test failures')
  lines.push('- Understanding page state at specific moments\n')
  
  lines.push('---\n')

  // Build the narrative with improved sentence-level action interleaving
  const narrativeText = buildNarrativeWithSentenceLevelDistribution(sortedActions)

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
  if (action.target?.text) return action.target.text.substring(0, 50)
  if (action.value) return action.value.substring(0, 50)
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

/**
 * Formats duration in human-readable format
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  
  if (minutes === 0) {
    return `${seconds}s`
  }
  return `${minutes}m ${seconds}s`
}
