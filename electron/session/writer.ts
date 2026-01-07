import path from 'path'
import { ensureDir, writeJson, writeText } from '../utils/fs'
import { sanitizeSessionId } from '../utils/validation'
import { generateTranscriptWithReferences } from '../utils/enhancedTranscript'
import type { SessionBundle, RecordedAction } from '../../shared/types'

export class SessionWriter {
  private outputDir: string

  constructor(outputDir: string) {
    this.outputDir = outputDir
  }

  async write(session: SessionBundle): Promise<string> {
    // Generate session directory name from startTime
    const date = new Date(session.startTime)
    const sessionId = date.toISOString()
      .replace(/T/, '-')
      .replace(/:/g, '')
      .split('.')[0] // Remove milliseconds
    const safeId = sanitizeSessionId(`session-${sessionId}`)
    
    const sessionDir = path.join(this.outputDir, safeId)
    const screenshotsDir = path.join(sessionDir, 'screenshots')

    await ensureDir(sessionDir)
    await ensureDir(screenshotsDir)

    // Prepare actions without voiceSegments for clean JSON output
    const actionsWithoutVoice = session.actions.map(action => {
      const { voiceSegments, ...actionWithoutVoice } = action
      return actionWithoutVoice
    })

    // Generate transcript.txt with embedded action and screenshot references
    const transcriptText = generateTranscriptWithReferences(session.actions)

    // Write only the 3 essential files:
    // 1. actions.json - all actions without voiceSegments, each with unique ID
    // 2. screenshots/ - folder already created, screenshots saved during recording
    // 3. transcript.txt - narrative with action/screenshot references
    await Promise.all([
      writeJson(path.join(sessionDir, 'actions.json'), { actions: actionsWithoutVoice }),
      writeText(path.join(sessionDir, 'transcript.txt'), transcriptText),
    ])

    return sessionDir
  }
}
