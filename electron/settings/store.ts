import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { logger } from '../utils/logger'

/**
 * Application settings interface
 * Defines all configurable options for the application
 */
export interface AppSettings {
  whisper: {
    modelName: 'tiny.en' | 'base.en' | 'small.en' | 'medium.en'
    modelPath?: string
    transcriptionTimeoutMs: number
  }
  voiceDistribution: {
    lookbackMs: number
    lookaheadMs: number
    longSegmentThresholdMs: number
  }
  output: {
    includeScreenshots: boolean
    prettyPrintJson: boolean
  }
  userPreferences: {
    startUrl: string
    outputPath: string
  }
}

/**
 * Default application settings
 */
const DEFAULT_SETTINGS: AppSettings = {
  whisper: {
    modelName: 'base.en',
    transcriptionTimeoutMs: 300000, // 5 minutes
  },
  voiceDistribution: {
    lookbackMs: 10000,  // 10 seconds
    lookaheadMs: 5000,  // 5 seconds
    longSegmentThresholdMs: 3000, // 3 seconds
  },
  output: {
    includeScreenshots: false,
    prettyPrintJson: true,
  },
  userPreferences: {
    startUrl: '',
    outputPath: '',
  },
}

/**
 * Settings store for managing application preferences
 * Persists settings to disk in the user data directory
 */
export class SettingsStore {
  private settings: AppSettings
  private settingsPath: string

  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json')
    this.settings = this.loadSettings()
  }

  /**
   * Load settings from disk or return defaults
   */
  private loadSettings(): AppSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8')
        const loaded = JSON.parse(data) as Partial<AppSettings>
        
        // Merge with defaults to ensure all fields exist
        return this.mergeWithDefaults(loaded)
      }
    } catch (error) {
      logger.warn('Failed to load settings, using defaults:', error)
    }
    
    return { ...DEFAULT_SETTINGS }
  }

  /**
   * Merge loaded settings with defaults to handle missing fields
   */
  private mergeWithDefaults(loaded: Partial<AppSettings>): AppSettings {
    return {
      whisper: {
        ...DEFAULT_SETTINGS.whisper,
        ...loaded.whisper,
      },
      voiceDistribution: {
        ...DEFAULT_SETTINGS.voiceDistribution,
        ...loaded.voiceDistribution,
      },
      output: {
        ...DEFAULT_SETTINGS.output,
        ...loaded.output,
      },
      userPreferences: {
        ...DEFAULT_SETTINGS.userPreferences,
        ...loaded.userPreferences,
      },
    }
  }

  /**
   * Save settings to disk
   */
  private saveSettings(): void {
    try {
      const data = JSON.stringify(this.settings, null, 2)
      fs.writeFileSync(this.settingsPath, data, 'utf-8')
      logger.debug('Settings saved to:', this.settingsPath)
    } catch (error) {
      logger.error('Failed to save settings:', error)
    }
  }

  /**
   * Get all settings
   */
  getAll(): AppSettings {
    return { ...this.settings }
  }

  /**
   * Get a specific setting value
   */
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key]
  }

  /**
   * Update settings (partial update supported)
   */
  update(updates: Partial<AppSettings>): void {
    this.settings = this.mergeWithDefaults({
      ...this.settings,
      ...updates,
    })
    this.saveSettings()
  }

  /**
   * Reset settings to defaults
   */
  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS }
    this.saveSettings()
  }

  /**
   * Get Whisper model configuration
   */
  getWhisperConfig(): { modelName: string; modelPath?: string; transcriptionTimeoutMs: number } {
    return {
      modelName: this.settings.whisper.modelName,
      modelPath: this.settings.whisper.modelPath,
      transcriptionTimeoutMs: this.settings.whisper.transcriptionTimeoutMs,
    }
  }

  /**
   * Get voice distribution configuration
   */
  getVoiceDistributionConfig(): {
    lookbackMs: number
    lookaheadMs: number
    longSegmentThresholdMs: number
  } {
    return { ...this.settings.voiceDistribution }
  }

  /**
   * Get user preferences (startUrl, outputPath)
   */
  getUserPreferences(): { startUrl: string; outputPath: string } {
    return { ...this.settings.userPreferences }
  }

  /**
   * Update user preferences
   */
  updateUserPreferences(preferences: Partial<{ startUrl: string; outputPath: string }>): void {
    this.settings.userPreferences = {
      ...this.settings.userPreferences,
      ...preferences,
    }
    this.saveSettings()
  }
}

// Singleton instance
let settingsStore: SettingsStore | null = null

/**
 * Get the settings store instance
 */
export function getSettingsStore(): SettingsStore {
  if (!settingsStore) {
    settingsStore = new SettingsStore()
  }
  return settingsStore
}
