import path from 'path'
import { ensureDir, writeJson, writeText } from '../utils/fs'
import { sanitizeSessionId } from '../utils/validation'
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

    await Promise.all([
      writeJson(path.join(sessionDir, 'actions.json'), { actions: session.actions }),
      writeJson(path.join(sessionDir, 'timeline.json'), { timeline: session.timeline }),
      writeJson(path.join(sessionDir, 'transcript.json'), { segments: session.transcript }),
      writeJson(path.join(sessionDir, 'metadata.json'), session.metadata),
      writeText(path.join(sessionDir, 'notes.md'), session.notes || '# Session Notes\n\n'),
    ])

    return sessionDir
  }
}
