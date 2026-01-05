import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { ensureDir, safeUnlink, getTempPath } from '../utils/fs'
import type { TranscriptSegment } from '../../shared/types'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath = require('ffmpeg-static') as string
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpeg = require('fluent-ffmpeg')

console.log('FFmpeg path:', ffmpegPath)
ffmpeg.setFfmpegPath(ffmpegPath)

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
      await ensureDir(tempDir)
      
      const inputPath = getTempPath(tempDir, 'audio-input', '.webm')
      const wavPath = getTempPath(tempDir, 'audio', '.wav')
      
      await fs.promises.writeFile(inputPath, audioBuffer)
      console.log('Converting audio to WAV format...')
      
      await this.convertToWav(inputPath, wavPath)
      await safeUnlink(inputPath)

      console.log('Transcribing audio file:', wavPath)
      const segments = await this.runWhisper(wavPath)
      console.log('Transcription complete, segments:', segments.length)
      
      await safeUnlink(wavPath)
      
      return segments
    } catch (error) {
      console.error('Transcription failed:', error)
      return []
    }
  }

  private convertToWav(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFrequency(16000)
        .audioChannels(1)
        .audioCodec('pcm_s16le')
        .format('wav')
        .on('end', () => {
          console.log('Audio conversion complete')
          resolve()
        })
        .on('error', (err: Error) => {
          console.error('Audio conversion failed:', err)
          reject(err)
        })
        .save(outputPath)
    })
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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const whisperModule = require('whisper-node')
      const whisper = whisperModule.whisper || whisperModule.default || whisperModule
      
      const result: WhisperResult[] | null = await whisper(audioPath, {
        modelName: this.modelName,
        whisperOptions: {
          language: 'en',
          word_timestamps: false,
          // Improved settings for better transcription quality
          translate: false,
          max_len: 0,  // No length limit
          split_on_word: true,  // Split on word boundaries
          best_of: 5,  // Use best of 5 beams for better accuracy
          beam_size: 5,  // Beam search size
          temperature: 0.0,  // Deterministic output (no randomness)
          compression_ratio_threshold: 2.4,
          logprob_threshold: -1.0,
          no_speech_threshold: 0.3,  // Lower threshold to catch more speech (was 0.6)
          // Additional settings to capture beginning
          initial_prompt: "This is a test recording.",  // Prime the model
          condition_on_previous_text: true,  // Use context from previous segments
        }
      })

      if (!result || !Array.isArray(result)) {
        console.log('Whisper returned no results')
        return []
      }

      // Filter out segments that are likely noise or silence
      const validSegments = result.filter(segment => {
        const text = segment.speech.trim()
        // Filter out common noise patterns
        return text.length > 0 &&
               !text.match(/^\[.*\]$/) &&  // Remove [BLANK_AUDIO], [noise], etc.
               !text.match(/^\(.*\)$/) &&  // Remove (mouse clicking), etc.
               text !== '...' &&
               text !== '.' &&
               text.length > 2  // Minimum 3 characters
      })

      return validSegments.map((segment, index) => ({
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
