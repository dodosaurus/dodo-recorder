import { ipcMain } from 'electron'
import { handleIpc, ipcError } from '../utils/ipc'
import { updateTimeWindows } from '../utils/voiceDistribution'
import { getSettingsStore } from '../settings/store'
import { logger } from '../utils/logger'
import type { SessionBundle } from '../../shared/types'
import { getSessionWriter } from './recording'

function validateSessionBundle(data: unknown): data is SessionBundle {
  if (!data || typeof data !== 'object') return false
  
  const bundle = data as Partial<SessionBundle>
  
  // Validate required fields exist and have correct types
  if (!Array.isArray(bundle.actions)) return false
  if (!Array.isArray(bundle.timeline)) return false
  if (!Array.isArray(bundle.transcript)) return false
  if (!bundle.metadata || typeof bundle.metadata !== 'object') return false
  if (typeof bundle.metadata.id !== 'string') return false
  if (typeof bundle.notes !== 'string') return false
  
  // Validate actions array structure
  for (const action of bundle.actions) {
    if (!action || typeof action !== 'object') return false
    if (typeof action.id !== 'string') return false
    if (typeof action.timestamp !== 'number') return false
    if (typeof action.type !== 'string') return false
  }
  
  // Validate timeline array structure
  for (const entry of bundle.timeline) {
    if (!entry || typeof entry !== 'object') return false
    if (typeof entry.timestamp !== 'number') return false
    if (typeof entry.type !== 'string') return false
  }
  
  // Validate transcript array structure
  for (const segment of bundle.transcript) {
    if (!segment || typeof segment !== 'object') return false
    if (typeof segment.id !== 'string') return false
    if (typeof segment.startTime !== 'number') return false
    if (typeof segment.endTime !== 'number') return false
    if (typeof segment.text !== 'string') return false
  }
  
  return true
}

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

    logger.info(`[IPC] Session has ${sessionData.actions.length} actions, ${sessionData.transcript.length} transcript segments`)
    
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
    return handleIpc(async () => {
      const settings = getSettingsStore()
      settings.update(updates as any)
      
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
}
