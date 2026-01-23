import { ipcMain } from 'electron'
import { handleIpc, ipcError } from '../utils/ipc'
import { updateTimeWindows } from '../utils/voiceDistribution'
import { getSettingsStore } from '../settings/store'
import { logger } from '../utils/logger'
import {
  validateSettingsUpdate,
  validateUserPreferencesUpdate,
  validateSessionBundle,
} from '../utils/validation'
import { getSessionWriter } from './recording'

/**
 * Register session-related IPC handlers
 */
export function registerSessionHandlers() {
  ipcMain.handle('save-session', async (_, sessionData: unknown) => {
    logger.info('[IPC] Saving session...')
    
    const sessionWriter = getSessionWriter()
    if (!sessionWriter) {
      logger.error('[IPC] Session writer not initialized')
      return ipcError('Session writer not initialized')
    }

    if (!validateSessionBundle(sessionData)) {
      logger.error('[IPC] Invalid session data structure')
      return ipcError('Invalid session data structure')
    }

    logger.info(`[IPC] Session has ${sessionData.actions.length} actions`)
    
    return handleIpc(async () => {
      const sessionPath = await sessionWriter!.write(sessionData)
      logger.info('[IPC] Session saved to:', sessionPath)
      return { path: sessionPath }
    }, 'Failed to save session')
  })
}

/**
 * Register settings-related IPC handlers
 */
export function registerSettingsHandlers() {
  ipcMain.handle('settings-get-all', async () => {
    return handleIpc(async () => {
      const settings = getSettingsStore()
      return { settings: settings.getAll() }
    }, 'Failed to get settings')
  })

  ipcMain.handle('settings-update', async (_, updates: unknown) => {
    if (!validateSettingsUpdate(updates)) {
      logger.error('[IPC] Invalid settings data structure')
      return ipcError('Invalid settings data structure')
    }
    
    return handleIpc(async () => {
      const settings = getSettingsStore()
      settings.update(updates)
      
      // Apply voice distribution settings immediately
      updateTimeWindows(settings.getVoiceDistributionConfig())
      
      return { settings: settings.getAll() }
    }, 'Failed to update settings')
  })

  ipcMain.handle('settings-reset', async () => {
    return handleIpc(async () => {
      const settings = getSettingsStore()
      settings.reset()
      
      // Apply default voice distribution settings
      updateTimeWindows(settings.getVoiceDistributionConfig())
      
      return { settings: settings.getAll() }
    }, 'Failed to reset settings')
  })

  ipcMain.handle('user-preferences-get', async () => {
    return handleIpc(async () => {
      const settings = getSettingsStore()
      return { preferences: settings.getUserPreferences() }
    }, 'Failed to get user preferences')
  })

  ipcMain.handle('user-preferences-update', async (_, preferences: unknown) => {
    if (!validateUserPreferencesUpdate(preferences)) {
      logger.error('[IPC] Invalid user preferences data structure')
      return ipcError('Invalid user preferences data structure')
    }
    
    return handleIpc(async () => {
      const settings = getSettingsStore()
      settings.updateUserPreferences(preferences)
      return { preferences: settings.getUserPreferences() }
    }, 'Failed to update user preferences')
  })

  ipcMain.handle('get-microphone-settings', async () => {
    return handleIpc(async () => {
      const settings = getSettingsStore()
      return { settings: settings.getAudioSettings() }
    }, 'Failed to get microphone settings')
  })

  ipcMain.handle('update-microphone-settings', async (_, settings: unknown) => {
    // Basic validation - settings should be an object with optional selectedMicrophoneId
    if (!settings || typeof settings !== 'object') {
      logger.error('[IPC] Invalid microphone settings data structure')
      return ipcError('Invalid microphone settings data structure')
    }
    
    const microphoneSettings = settings as Partial<{ selectedMicrophoneId: string }>
    
    // Validate selectedMicrophoneId if provided
    if (microphoneSettings.selectedMicrophoneId !== undefined && typeof microphoneSettings.selectedMicrophoneId !== 'string') {
      logger.error('[IPC] Invalid selectedMicrophoneId: must be a string')
      return ipcError('Invalid selectedMicrophoneId: must be a string')
    }
    
    return handleIpc(async () => {
      const settingsStore = getSettingsStore()
      settingsStore.updateAudioSettings(microphoneSettings)
      return { settings: settingsStore.getAudioSettings() }
    }, 'Failed to update microphone settings')
  })
}
