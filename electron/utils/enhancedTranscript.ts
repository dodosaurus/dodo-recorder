import type { RecordedAction, TranscriptSegment } from '../../shared/types'

/**
 * Generates narrative text with embedded action references.
 * This narrative is embedded in actions.json, not a separate transcript.txt file.
 *
 * Format:
 * - Voice transcription text flows naturally
 * - Action references embedded inline: [action:ID:TYPE]
 * - Screenshot references embedded inline for screenshot actions: [screenshot:FILENAME]
 * - ALL actions are referenced in the narrative
 * - Actions are interleaved within sentences based on timestamp proximity
 *
 * Example output:
 * "So, this is the test session [action:e6c3069a:navigate]. Now I'm clicking on some
 * top menu items [action:c5922be3:click] [action:72e42724:click] to assert them.
 * To assert my name [action:2e185707:assert] in the hero section. To assert the button
 * is here [action:3ea1708c:assert] LinkedIn button [action:ef955889:click]. Taking a
 * screenshot now [action:4a62c1b8:screenshot] [screenshot:screenshot-3655.png]..."
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
 * This is the core algorithm that distributes actions throughout the text
 * based on timestamp proximity rather than just appending them at the end.
 *
 * IMPORTANT: Each action appears EXACTLY ONCE at its most meaningful location
 * (closest to the action's actual timestamp).
 *
 * @param actions - Sorted array of actions with voiceSegments attached
 * @returns Narrative text with actions interleaved at precise locations
 */
export function buildNarrativeWithSentenceLevelDistribution(actions: RecordedAction[]): string {
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
