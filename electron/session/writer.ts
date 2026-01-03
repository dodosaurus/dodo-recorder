import path from 'path'
import fs from 'fs'

interface SessionBundle {
  actions: unknown[]
  timeline: unknown[]
  transcript: unknown[]
  metadata: {
    id: string
    startTime: number
    endTime?: number
    startUrl: string
    duration?: number
    actionCount: number
    transcriptSegmentCount: number
  }
  notes: string
}

export class SessionWriter {
  private outputDir: string

  constructor(outputDir: string) {
    this.outputDir = outputDir
  }

  async write(session: SessionBundle): Promise<string> {
    const sessionDir = path.join(this.outputDir, session.metadata.id)
    
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true })
    }

    const screenshotsDir = path.join(sessionDir, 'screenshots')
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true })
    }

    await Promise.all([
      this.writeJson(path.join(sessionDir, 'actions.json'), { actions: session.actions }),
      this.writeJson(path.join(sessionDir, 'timeline.json'), { timeline: session.timeline }),
      this.writeJson(path.join(sessionDir, 'transcript.json'), { segments: session.transcript }),
      this.writeJson(path.join(sessionDir, 'metadata.json'), session.metadata),
      this.writeFile(path.join(sessionDir, 'notes.md'), session.notes || '# Session Notes\n\n'),
    ])

    return sessionDir
  }

  private async writeJson(filePath: string, data: unknown): Promise<void> {
    const content = JSON.stringify(data, null, 2)
    await fs.promises.writeFile(filePath, content, 'utf-8')
  }

  private async writeFile(filePath: string, content: string): Promise<void> {
    await fs.promises.writeFile(filePath, content, 'utf-8')
  }
}

