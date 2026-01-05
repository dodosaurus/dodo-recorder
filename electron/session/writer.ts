import path from 'path'
import { ensureDir, writeJson, writeText } from '../utils/fs'
import { sanitizeSessionId } from '../utils/validation'
import { generateFullTranscript } from '../utils/voiceDistribution'
import { generateEnhancedTranscript, generateDetailedEnhancedTranscript } from '../utils/enhancedTranscript'
import type { SessionBundle } from '../../shared/types'

export class SessionWriter {
  private outputDir: string

  constructor(outputDir: string) {
    this.outputDir = outputDir
  }

  async write(session: SessionBundle): Promise<string> {
    const safeId = sanitizeSessionId(session.metadata.id)
    const sessionDir = path.join(this.outputDir, safeId)
    const screenshotsDir = path.join(sessionDir, 'screenshots')

    await ensureDir(sessionDir)
    await ensureDir(screenshotsDir)

    // Generate full transcript text (original format)
    const fullTranscript = generateFullTranscript(session.transcript)
    const transcriptText = fullTranscript
      ? `# Voice Commentary Transcript\n\n${fullTranscript}\n`
      : '# Voice Commentary Transcript\n\nNo voice commentary recorded.\n'

    // Generate enhanced transcript with action IDs embedded
    const enhancedTranscript = generateEnhancedTranscript(session.actions, {
      fullActionIds: false, // Use short 8-char IDs for readability
      actionFormat: 'action:ID',
      screenshotFormat: 'screenshot:FILENAME',
    })
    const enhancedTranscriptText = `# Enhanced Narrative Transcript\n\n` +
      `This transcript embeds action and screenshot references inline for LLM consumption.\n` +
      `Format: [action:SHORT_ID:TYPE] for actions, [screenshot:FILENAME] for screenshots.\n\n` +
      `${enhancedTranscript}\n`

    // Generate detailed enhanced transcript with metadata table
    const detailedEnhancedTranscript = generateDetailedEnhancedTranscript(session.actions)

    await Promise.all([
      writeJson(path.join(sessionDir, 'actions.json'), { actions: session.actions }),
      writeJson(path.join(sessionDir, 'timeline.json'), { timeline: session.timeline }),
      writeJson(path.join(sessionDir, 'transcript.json'), { segments: session.transcript }),
      writeJson(path.join(sessionDir, 'metadata.json'), session.metadata),
      writeText(path.join(sessionDir, 'notes.md'), session.notes || '# Session Notes\n\n'),
      writeText(path.join(sessionDir, 'transcript.txt'), transcriptText),
      writeText(path.join(sessionDir, 'transcript-enhanced.txt'), enhancedTranscriptText),
      writeText(path.join(sessionDir, 'transcript-detailed.md'), detailedEnhancedTranscript),
    ])

    return sessionDir
  }
}
