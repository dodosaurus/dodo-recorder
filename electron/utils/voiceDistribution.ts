import type { RecordedAction, TranscriptSegment } from '../../shared/types'

// Configuration constants for the distribution algorithm
// These can be overridden via settings
let TIME_WINDOWS = {
  LOOKBACK: 10000,  // 10 seconds before action
  LOOKAHEAD: 5000,  // 5 seconds after action
  LONG_SEGMENT_THRESHOLD: 3000, // 3+ seconds = long segment
}

/**
 * Update time windows configuration
 * @param config - New configuration values
 */
export function updateTimeWindows(config: {
  lookbackMs?: number
  lookaheadMs?: number
  longSegmentThresholdMs?: number
}): void {
  if (config.lookbackMs !== undefined) {
    TIME_WINDOWS.LOOKBACK = config.lookbackMs
  }
  if (config.lookaheadMs !== undefined) {
    TIME_WINDOWS.LOOKAHEAD = config.lookaheadMs
  }
  if (config.longSegmentThresholdMs !== undefined) {
    TIME_WINDOWS.LONG_SEGMENT_THRESHOLD = config.longSegmentThresholdMs
  }
}

/**
 * Distributes voice segments across actions using a sophisticated algorithm
 * that considers temporal proximity, segment boundaries, and context.
 *
 * Algorithm principles:
 * 1. Pre-action segments: Voice before first action is captured
 * 2. Temporal windows: Segments are assigned based on time proximity
 * 3. Overlap handling: Segments spanning multiple actions are intelligently split
 * 4. Context preservation: Maintains natural speech flow for LLM interpretation
 *
 * Performance note: This function sorts both actions and segments by timestamp.
 * If inputs are already sorted, the sorting check will skip redundant operations.
 *
 * @param actions - Array of recorded actions (will be sorted by timestamp)
 * @param segments - Array of transcript segments (will be sorted by startTime)
 * @param sessionStartTime - Session start timestamp (currently unused but reserved for future use)
 * @returns Array of actions with voice segments attached
 */
export function distributeVoiceSegments(
  actions: RecordedAction[],
  segments: TranscriptSegment[],
  sessionStartTime: number
): RecordedAction[] {
  if (segments.length === 0) return actions
  if (actions.length === 0) return []

  // Sort inputs to ensure correct temporal ordering
  // Note: Checks if already sorted to avoid redundant operations
  const sortedActions = sortByTimestamp(actions)
  const sortedSegments = sortByStartTime(segments)
  const actionVoiceMap = initializeActionVoiceMap(sortedActions)

  // Handle pre-action segments
  assignPreActionSegments(sortedSegments, sortedActions, actionVoiceMap)

  // Distribute remaining segments
  distributeSegmentsToActions(sortedSegments, sortedActions, actionVoiceMap)

  // Return actions with voice segments attached
  return attachVoiceSegmentsToActions(sortedActions, actionVoiceMap)
}

/**
 * Helper: Check if array is sorted by a numeric property
 * Used to optimize sorting operations when inputs are already sorted
 */
function isSorted<T>(arr: T[], key: keyof T): boolean {
  for (let i = 1; i < arr.length; i++) {
    if ((arr[i][key] as number) < (arr[i - 1][key] as number)) {
      return false
    }
  }
  return true
}

/**
 * Helper: Generic sort function by numeric property
 */
function sortByProperty<T>(items: T[], prop: keyof T): T[] {
  return [...items].sort((a, b) => (a[prop] as number) - (b[prop] as number))
}

/**
 * Helper: Sort actions by timestamp (only if not already sorted)
 */
function sortByTimestamp(actions: RecordedAction[]): RecordedAction[] {
  if (isSorted(actions, 'timestamp')) {
    return actions
  }
  return sortByProperty(actions, 'timestamp')
}

/**
 * Helper: Sort segments by start time (only if not already sorted)
 */
function sortByStartTime(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (isSorted(segments, 'startTime')) {
    return segments
  }
  return sortByProperty(segments, 'startTime')
}

/**
 * Helper: Initialize map for storing voice segments per action
 */
function initializeActionVoiceMap(actions: RecordedAction[]): Map<string, TranscriptSegment[]> {
  const map = new Map<string, TranscriptSegment[]>()
  actions.forEach(action => map.set(action.id, []))
  return map
}

/**
 * Helper: Assign segments that occur before the first action
 */
function assignPreActionSegments(
  segments: TranscriptSegment[],
  actions: RecordedAction[],
  voiceMap: Map<string, TranscriptSegment[]>
): void {
  const firstActionTime = actions[0].timestamp
  const preActionSegments = segments.filter(seg => seg.endTime < firstActionTime)
  
  if (preActionSegments.length > 0) {
    voiceMap.set(actions[0].id, [...preActionSegments])
  }
}

/**
 * Helper: Distribute segments to their best matching actions
 */
function distributeSegmentsToActions(
  segments: TranscriptSegment[],
  actions: RecordedAction[],
  voiceMap: Map<string, TranscriptSegment[]>
): void {
  const firstActionTime = actions[0].timestamp

  segments.forEach(segment => {
    // Skip pre-action segments (already handled)
    if (segment.endTime < firstActionTime) return

    const segmentMidpointMs = (segment.startTime + segment.endTime) / 2
    const assignment = findBestActionForSegment(segment, segmentMidpointMs, actions)

    assignSegmentToActions(segment, assignment, voiceMap)
  })
}

/**
 * Helper: Assign a segment based on assignment type
 */
function assignSegmentToActions(
  segment: TranscriptSegment,
  assignment: SegmentAssignment,
  voiceMap: Map<string, TranscriptSegment[]>
): void {
  const actionIds = assignment.type === 'single'
    ? [assignment.actionId]
    : assignment.actionIds

  actionIds.forEach(actionId => {
    const existing = voiceMap.get(actionId)
    if (existing) {
      existing.push(segment)
    } else {
      voiceMap.set(actionId, [segment])
    }
  })
}

/**
 * Helper: Attach voice segments to actions
 */
function attachVoiceSegmentsToActions(
  actions: RecordedAction[],
  voiceMap: Map<string, TranscriptSegment[]>
): RecordedAction[] {
  return actions.map(action => ({
    ...action,
    voiceSegments: voiceMap.get(action.id) || []
  }))
}

interface SingleAssignment {
  type: 'single'
  actionId: string
}

interface SplitAssignment {
  type: 'split'
  actionIds: string[]
}

type SegmentAssignment = SingleAssignment | SplitAssignment

/**
 * Determines the best action(s) to assign a voice segment to.
 * Uses temporal proximity and overlap detection.
 */
function findBestActionForSegment(
  segment: TranscriptSegment,
  segmentMidpointMs: number,
  actions: RecordedAction[]
): SegmentAssignment {
  const relevantActions = findRelevantActions(segment, actions)

  if (relevantActions.length === 0) {
    return { type: 'single', actionId: findClosestAction(segmentMidpointMs, actions).id }
  }

  if (relevantActions.length === 1) {
    return { type: 'single', actionId: relevantActions[0].id }
  }

  // Multiple relevant actions - determine if segment should be split
  return shouldSplitSegment(segment, relevantActions)
    ? { type: 'split', actionIds: relevantActions.map(a => a.id) }
    : { type: 'single', actionId: findClosestAction(segmentMidpointMs, relevantActions).id }
}

/**
 * Helper: Find actions within temporal window of segment
 */
function findRelevantActions(
  segment: TranscriptSegment,
  actions: RecordedAction[]
): RecordedAction[] {
  return actions.filter(action => {
    const windowStart = action.timestamp - TIME_WINDOWS.LOOKBACK
    const windowEnd = action.timestamp + TIME_WINDOWS.LOOKAHEAD
    
    return isSegmentInWindow(segment, windowStart, windowEnd)
  })
}

/**
 * Helper: Check if segment overlaps with time window
 */
function isSegmentInWindow(
  segment: TranscriptSegment,
  windowStart: number,
  windowEnd: number
): boolean {
  return (
    (segment.startTime >= windowStart && segment.startTime <= windowEnd) ||
    (segment.endTime >= windowStart && segment.endTime <= windowEnd) ||
    (segment.startTime <= windowStart && segment.endTime >= windowEnd)
  )
}

/**
 * Helper: Determine if segment should be split across multiple actions
 */
function shouldSplitSegment(
  segment: TranscriptSegment,
  relevantActions: RecordedAction[]
): boolean {
  const segmentDurationMs = segment.endTime - segment.startTime
  const actionSpanMs = relevantActions[relevantActions.length - 1].timestamp - relevantActions[0].timestamp
  
  return segmentDurationMs > TIME_WINDOWS.LONG_SEGMENT_THRESHOLD && actionSpanMs > 0
}

/**
 * Helper: Find action closest to timestamp
 */
function findClosestAction(
  timestampMs: number,
  actions: RecordedAction[]
): RecordedAction {
  return actions.reduce((closest, action) => {
    const closestDistMs = Math.abs(closest.timestamp - timestampMs)
    const actionDistMs = Math.abs(action.timestamp - timestampMs)
    return actionDistMs < closestDistMs ? action : closest
  })
}


/**
 * Generates a full transcript text from segments
 */
export function generateFullTranscript(segments: TranscriptSegment[]): string {
  if (segments.length === 0) {
    return ''
  }

  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime)
  
  return sorted
    .map(segment => {
      const timestamp = formatTranscriptTimestamp(segment.startTime)
      return `[${timestamp}] ${segment.text}`
    })
    .join('\n\n')
}

/**
 * Formats a timestamp in milliseconds to MM:SS format
 */
function formatTranscriptTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
