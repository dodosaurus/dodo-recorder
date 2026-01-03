import path from 'path'
import fs from 'fs'
import { app } from 'electron'

interface TranscriptSegment {
  id: string
  startTime: number
  endTime: number
  text: string
}

export class Transcriber {
  private modelPath: string | null = null
  private isInitialized = false

  async initialize(): Promise<void> {
    const modelsDir = path.join(app.getPath('userData'), 'models')
    
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true })
    }

    this.modelPath = path.join(modelsDir, 'ggml-base.en.bin')
    
    if (!fs.existsSync(this.modelPath)) {
      console.log('Whisper model not found. Please download ggml-base.en.bin')
      console.log('Download from: https://huggingface.co/ggerganov/whisper.cpp/tree/main')
      console.log(`Place in: ${modelsDir}`)
    }
    
    this.isInitialized = true
  }

  async transcribe(audioBuffer: Buffer): Promise<TranscriptSegment[]> {
    if (!this.isInitialized) {
      throw new Error('Transcriber not initialized')
    }

    if (!this.modelPath || !fs.existsSync(this.modelPath)) {
      console.warn('Whisper model not available, returning empty transcript')
      return []
    }

    try {
      const tempDir = path.join(app.getPath('temp'), 'dodo-recorder')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }
      
      const wavPath = path.join(tempDir, `audio-${Date.now()}.wav`)
      fs.writeFileSync(wavPath, audioBuffer)

      const segments = await this.runWhisper(wavPath)
      
      fs.unlinkSync(wavPath)
      
      return segments
    } catch (error) {
      console.error('Transcription failed:', error)
      return []
    }
  }

  private async runWhisper(audioPath: string): Promise<TranscriptSegment[]> {
    try {
      const whisper = await import('whisper-node')
      
      const result = await whisper.whisper(audioPath, {
        modelPath: this.modelPath!,
        language: 'en',
      })

      if (!result || !Array.isArray(result)) {
        return []
      }

      return result.map((segment: { start: number; end: number; speech: string }, index: number) => ({
        id: `t${index + 1}`,
        startTime: Math.round(segment.start * 1000),
        endTime: Math.round(segment.end * 1000),
        text: segment.speech.trim(),
      }))
    } catch (error) {
      console.error('Whisper processing failed:', error)
      return []
    }
  }
}

