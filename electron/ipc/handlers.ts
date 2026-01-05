import { BrowserWindow } from 'electron'
import { registerRecordingHandlers } from './recording'
import { registerSessionHandlers, registerSettingsHandlers } from './session'

/**
 * Register all IPC handlers
 * @param mainWindow - The main browser window instance
 */
export function registerAllHandlers(mainWindow: BrowserWindow | null): void {
  registerRecordingHandlers(mainWindow)
  registerSessionHandlers()
  registerSettingsHandlers()
}
