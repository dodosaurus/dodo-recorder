import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { ensureDir, safeUnlink, getTempPath } from '../utils/fs'
import { logger } from '../utils/logger'
import type { TranscriptSegment } from '../../shared/types'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath = require('ffmpeg-static') as string
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpeg = require('fluent-ffmpeg')

const execAsync = promisify(exec)

logger.debug('FFmpeg path:', ffmpegPath)
ffmpeg.setFfmpegPath(ffmpegPath)

interface WhisperResult {
  start: string
  end: string
  speech: string
}

export class Transcriber {
  private isInitialized = false
  private modelName: string
  private modelPath?: string
  private transcriptionTimeoutMs: number

  constructor(
    modelName: string = 'small.en', // Upgraded to small.en for better quality
    transcriptionTimeoutMs: number = 300000,
    modelPath?: string
  ) {
    this.modelName = modelName
    this.transcriptionTimeoutMs = transcriptionTimeoutMs
    this.modelPath = modelPath
  }

  /**
   * Initializes the transcriber by checking for Whisper model availability
   * @throws {Error} If model is not found (logs error but doesn't throw)
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    // Use custom model path if provided, otherwise use default
    const modelPath = this.modelPath || this.getDefaultModelPath()
    
    logger.info('='.repeat(60))
    logger.info('🎤 Whisper Transcriber Initialization')
    logger.info('='.repeat(60))
    logger.info(`Model: ${this.modelName}`)
    logger.info(`Path: ${modelPath}`)
    
    if (!fs.existsSync(modelPath)) {
      logger.error('❌ Whisper model not found!')
      logger.error('Please run: cd node_modules/whisper-node/lib/whisper.cpp && make')
      logger.error(`Then download: ggml-${this.modelName}.bin to the models directory`)
      logger.error('Download from: https://huggingface.co/ggerganov/whisper.cpp/tree/main')
    } else {
      const stats = fs.statSync(modelPath)
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
      logger.info(`✅ Model ready (${sizeMB} MB)`)
    }
    
    logger.info('='.repeat(60))
    
    this.isInitialized = true
  }

  /**
   * Get the default model path based on model name
   */
  private getDefaultModelPath(): string {
    const whisperNodeDir = path.dirname(require.resolve('whisper-node/package.json'))
    const whisperModelsDir = path.join(whisperNodeDir, 'lib/whisper.cpp/models')
    return path.join(whisperModelsDir, `ggml-${this.modelName}.bin`)
  }

  /**
   * Transcribes audio buffer to text segments
   * @param audioBuffer - Audio data buffer to transcribe
   * @returns Promise that resolves with array of transcript segments (empty array on error)
   */
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
      logger.info('Converting audio to WAV format...')
      
      await this.convertToWav(inputPath, wavPath)
      await safeUnlink(inputPath)

      logger.info('Transcribing audio file:', wavPath)
      const segments = await this.transcribeWithTimeout(wavPath)
      logger.info('Transcription complete, segments:', segments.length)
      
      await safeUnlink(wavPath)
      
      return segments
    } catch (error) {
      logger.error('Transcription failed:', error)
      return []
    }
  }

  private convertToWav(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Add 1.5 seconds of silence at the beginning to help Whisper detect early speech
      // This is especially important for external microphones which have initialization delays
      // Whisper's VAD needs this buffer to properly detect speech at the very beginning
      ffmpeg(inputPath)
        .audioFrequency(16000)
        .audioChannels(1)
        .audioCodec('pcm_s16le')
        .format('wav')
        // Prepend 1.5s of silence using adelay and apad filters
        .audioFilters([
          'apad=pad_dur=1.5',  // Add 1.5s padding at the end
          'areverse',           // Reverse the audio
          'apad=pad_dur=1.5',  // Add 1.5s padding (which will be at the beginning after reversing back)
          'areverse'            // Reverse back to original
        ])
        .on('end', () => {
          logger.debug('Audio conversion complete (with 1.5s leading silence)')
          resolve()
        })
        .on('error', (err: Error) => {
          logger.error('Audio conversion failed:', err)
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

  /**
   * Transcribe audio with timeout protection
   * @param audioPath - Path to the audio file
   * @returns Promise that resolves with transcript segments or rejects on timeout
   */
  private async transcribeWithTimeout(audioPath: string): Promise<TranscriptSegment[]> {
    return Promise.race([
      this.runWhisper(audioPath),
      new Promise<TranscriptSegment[]>((_, reject) =>
        setTimeout(() => reject(new Error('Transcription timeout')), this.transcriptionTimeoutMs)
      )
    ])
  }

  /**
   * Run Whisper transcription on audio file using direct whisper.cpp call
   * @param audioPath - Path to the audio file
   * @returns Promise that resolves with transcript segments
   */
  private async runWhisper(audioPath: string): Promise<TranscriptSegment[]> {
    try {
      logger.info('='.repeat(60))
      logger.info('🎙️  Starting Whisper Transcription (Direct whisper.cpp)')
      logger.info('='.repeat(60))
      logger.info(`Audio file: ${audioPath}`)
      logger.info(`Model: ${this.modelName}`)
      
      // Get whisper.cpp path
      const whisperNodeDir = path.dirname(require.resolve('whisper-node/package.json'))
      const whisperCppDir = path.join(whisperNodeDir, 'lib/whisper.cpp')
      const whisperMainPath = path.join(whisperCppDir, 'main')
      const modelPath = this.modelPath || this.getDefaultModelPath()
      const jsonOutputPath = `${audioPath}.json`
      
      // Build command with ALL the parameters we need (whisper-node was ignoring most of them!)
      const command = [
        whisperMainPath,
        '-m', modelPath,
        '-f', audioPath,
        '-l', 'en',
        '-oj',  // Output JSON format
        '--print-progress',  // Show progress
        // Critical parameters for early speech detection:
        '-ml', '0',  // max-len: no length limit
        '-sow',  // split-on-word: split on word boundaries
        '-bo', '5',  // best-of: use best of 5 candidates
        '-bs', '5',  // beam-size: beam search size
        '-et', '2.0',  // entropy-thold: LOWERED from 2.4 to 2.0 for better early detection
        '-lpt', '-1.0',  // logprob-thold: log probability threshold
        '--prompt', '"This is a recording session with browser interactions, clicking, navigation, and voice commentary."'
      ].join(' ')
      
      logger.info('Executing whisper.cpp command:')
      logger.info(command)
      
      // Execute whisper.cpp directly
      const { stdout, stderr } = await execAsync(command, {
        cwd: whisperCppDir,
        maxBuffer: 10 * 1024 * 1024  // 10MB buffer for large outputs
      })
      
      if (stderr) {
        logger.debug('Whisper stderr:', stderr)
      }
      
      // Read the JSON output file created by whisper.cpp
      logger.info(`Reading JSON output from: ${jsonOutputPath}`)
      const jsonContent = await fs.promises.readFile(jsonOutputPath, 'utf-8')
      const jsonData = JSON.parse(jsonContent)
      
      // Clean up the JSON file
      await safeUnlink(jsonOutputPath)
      
      // Extract transcription segments from JSON
      // whisper.cpp JSON format: { "transcription": [ { "timestamps": { "from": "00:00:00,000", "to": "00:00:05,000" }, "offsets": { "from": 0, "to": 5000 }, "text": "..." } ] }
      const result: WhisperResult[] = []
      
      if (jsonData.transcription && Array.isArray(jsonData.transcription)) {
        for (const segment of jsonData.transcription) {
          if (segment.timestamps && segment.text) {
            // Convert comma format to dot format (00:00:00,000 -> 00:00:00.000)
            const start = segment.timestamps.from.replace(',', '.')
            const end = segment.timestamps.to.replace(',', '.')
            result.push({
              start,
              end,
              speech: segment.text.trim()
            })
          }
        }
      }
      
      logger.info(`Parsed ${result.length} segments from JSON output`)

      logger.info('='.repeat(60))
      logger.info('📊 Raw Whisper Results')
      logger.info('='.repeat(60))
      
      if (!result || !Array.isArray(result)) {
        logger.warn('⚠️  Whisper returned no results')
        return []
      }

      logger.info(`Total segments from Whisper: ${result.length}`)
      
      // Log ALL raw segments before filtering
      result.forEach((segment, index) => {
        const startMs = this.parseTimestamp(segment.start)
        const endMs = this.parseTimestamp(segment.end)
        logger.info(`  [${index + 1}] ${segment.start} -> ${segment.end} (${startMs}ms -> ${endMs}ms)`)
        logger.info(`      Text: "${segment.speech}"`)
      })

      // Filter out segments that are likely noise or silence
      const validSegments = result.filter(segment => {
        const text = segment.speech.trim()
        const isValid = text.length > 0 &&
               !text.match(/^\[.*\]$/) &&  // Remove [BLANK_AUDIO], [noise], etc.
               !text.match(/^\(.*\)$/) &&  // Remove (mouse clicking), etc.
               text !== '...' &&
               text !== '.' &&
               text.length > 2  // Minimum 3 characters
        
        if (!isValid) {
          logger.debug(`  ❌ Filtered out: "${text}"`)
        }
        return isValid
      })

      logger.info('='.repeat(60))
      logger.info(`✅ Valid segments after filtering: ${validSegments.length}`)
      logger.info('='.repeat(60))

      // Subtract 1500ms from all timestamps to account for the 1.5s silence padding we added
      // This padding is critical for external microphones which have initialization delays
      const PADDING_OFFSET_MS = 1500
      
      const segments = validSegments.map((segment, index) => {
        const startTime = Math.max(0, this.parseTimestamp(segment.start) - PADDING_OFFSET_MS)
        const endTime = Math.max(0, this.parseTimestamp(segment.end) - PADDING_OFFSET_MS)
        
        return {
          id: `t${index + 1}`,
          startTime,
          endTime,
          text: segment.speech.trim(),
        }
      }).filter(segment => segment.endTime > 0) // Remove any segments that are entirely in the padding

      // Log final processed segments
      logger.info('📝 Final segments (after removing 1500ms padding offset):')
      segments.forEach(segment => {
        logger.info(`  [${segment.id}] ${segment.startTime}ms -> ${segment.endTime}ms`)
        logger.info(`      "${segment.text}"`)
      })
      logger.info('='.repeat(60))

      return segments
    } catch (error) {
      logger.error('Whisper processing failed:', error)
      return []
    }
  }
}
