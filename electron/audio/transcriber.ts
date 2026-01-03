import path from 'path'
import fs from 'fs'
import { app } from 'electron'

interface TranscriptSegment {
  id: string
  startTime: number
  endTime: number
  text: string
}

interface WhisperResult {
  start: string
  end: string
  speech: string
}

export class Transcriber {
  private isInitialized = false
  private modelName = 'base.en'

  async initialize(): Promise<void> {
    const whisperNodeDir = path.dirname(require.resolve('whisper-node/package.json'))
    const whisperModelsDir = path.join(whisperNodeDir, 'lib/whisper.cpp/models')
    const modelPath = path.join(whisperModelsDir, `ggml-${this.modelName}.bin`)
    
    if (!fs.existsSync(modelPath)) {
      console.error('Whisper model not found at:', modelPath)
      console.error('Please run: cd node_modules/whisper-node/lib/whisper.cpp && make')
      console.error('Then copy ggml-base.en.bin to:', whisperModelsDir)
    } else {
      console.log('Whisper model ready:', modelPath)
    }
    
    this.isInitialized = true
  }

  async transcribe(audioBuffer: Buffer): Promise<TranscriptSegment[]> {
    if (!this.isInitialized) {
      throw new Error('Transcriber not initialized')
    }

    try {
      const tempDir = path.join(app.getPath('temp'), 'dodo-recorder')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }
      
      const wavPath = path.join(tempDir, `audio-${Date.now()}.wav`)
      fs.writeFileSync(wavPath, audioBuffer)

      console.log('Transcribing audio file:', wavPath)
      const segments = await this.runWhisper(wavPath)
      console.log('Transcription complete, segments:', segments.length)
      
      try {
        fs.unlinkSync(wavPath)
      } catch {
        console.warn('Could not delete temp audio file')
      }
      
      return segments
    } catch (error) {
      console.error('Transcription failed:', error)
      return []
    }
  }

  private parseTimestamp(timestamp: string): number {
    const parts = timestamp.split(':')
    if (parts.length === 3) {
      const hours = parseInt(parts[0], 10)
      const minutes = parseInt(parts[1], 10)
      const seconds = parseFloat(parts[2])
      return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000)
    }
    return 0
  }

  private async runWhisper(audioPath: string): Promise<TranscriptSegment[]> {
    try {
      const whisper = (await import('whisper-node')).default
      
      const result: WhisperResult[] | null = await whisper(audioPath, {
        modelName: this.modelName,
        whisperOptions: {
          language: 'en',
          word_timestamps: false,
        }
      })

      if (!result || !Array.isArray(result)) {
        console.log('Whisper returned no results')
        return []
      }

      return result.map((segment, index) => ({
        id: `t${index + 1}`,
        startTime: this.parseTimestamp(segment.start),
        endTime: this.parseTimestamp(segment.end),
        text: segment.speech.trim(),
      }))
    } catch (error) {
      console.error('Whisper processing failed:', error)
      return []
    }
  }
}
