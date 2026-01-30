import path from 'path'
import fs from 'fs'
import { app } from 'electron'

// Import Playwright first
import { chromium, Browser, Page, Frame } from 'playwright'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { logger } from '../utils/logger'
import type { RecordedAction } from '../../shared/types'
import { getInjectionScript } from './injected-script'
import { getWidgetScript, getWidgetInitScript } from './recording-widget'
import { getHighlighterScript, getHighlighterInitScript } from './hover-highlighter'

/**
 * Gets the path to the Playwright browsers directory
 * In development: uses project root's playwright-browsers
 * In production: uses app.asar's resources/playwright-browsers
 */
function getBrowsersPath(): string {
  if (app.isPackaged) {
    // Production: browsers are in extraResources
    return path.join(process.resourcesPath, 'playwright-browsers')
  }
  // Development: browsers are in project root
  return path.join(process.cwd(), 'playwright-browsers')
}

/**
 * Gets the path to the Chromium browser executable
 * This constructs the path manually since Playwright ignores PLAYWRIGHT_BROWSERS_PATH
 *
 * Supports supported platforms and architectures:
 * - macOS ARM64: chrome-mac-arm64
 * - Windows x64: chrome-win64
 */
function getBrowserExecutablePath(): string {
  const browsersPath = getBrowsersPath()
  const chromiumVersion = 'chromium-1200'
  const chromiumPath = path.join(browsersPath, chromiumVersion)
  
  if (process.platform === 'darwin') {
    // macOS: Try ARM64 first (most common)
    const arm64Path = path.join(
      chromiumPath,
      'chrome-mac-arm64',
      'Google Chrome for Testing.app',
      'Contents',
      'MacOS',
      'Google Chrome for Testing'
    )
    if (fs.existsSync(arm64Path)) {
      return arm64Path
    }
    
    // Fallback - return ARM64 path (will fail with helpful error)
    return arm64Path
  } else if (process.platform === 'win32') {
    // Windows: Try chrome-win64 first, then chrome-win
    const win64Path = path.join(chromiumPath, 'chrome-win64', 'chrome.exe')
    if (fs.existsSync(win64Path)) {
      return win64Path
    }
    
    const winPath = path.join(chromiumPath, 'chrome-win', 'chrome.exe')
    if (fs.existsSync(winPath)) {
      return winPath
    }
    
    // Fallback - return chrome-win64 path (will fail with helpful error)
    return win64Path
  }
  
  // Unsupported platform - throw error to satisfy TypeScript return type
  throw new Error(`Unsupported platform: ${process.platform}`)
}

const browsersPath = getBrowsersPath()
const browserExecutablePath = getBrowserExecutablePath()

// Debug logging for browser path resolution
logger.info(`[recorder.ts] app.isPackaged: ${app.isPackaged}`)
logger.info(`[recorder.ts] process.resourcesPath: ${process.resourcesPath}`)
logger.info(`[recorder.ts] process.cwd(): ${process.cwd()}`)
logger.info(`[recorder.ts] browsersPath: ${browsersPath}`)
logger.info(`[recorder.ts] browserExecutablePath: ${browserExecutablePath}`)

export class BrowserRecorder extends EventEmitter {
  private browser: Browser | null = null
  private page: Page | null = null
  private actions: RecordedAction[] = []
  private startTime: number = 0
  private frameNavigatedHandler: ((frame: Frame) => void) | null = null
  private screenshotDir: string | null = null
  private initialNavigationComplete: boolean = false
  private audioActive: boolean = false
  private lastRecordedUrl: string | null = null

  /**
   * Checks if Playwright Chromium browser is installed
   * @returns true if browser is installed, false otherwise
   */
  private async checkBrowserInstalled(): Promise<boolean> {
    try {
      // Check if our manually constructed browser path exists
      const exists = fs.existsSync(browserExecutablePath)
      logger.info(`[checkBrowserInstalled] browserExecutablePath: ${browserExecutablePath}`)
      logger.info(`[checkBrowserInstalled] fs.existsSync(browserExecutablePath): ${exists}`)
      
      // Also check if the browsers directory exists
      const browsersDirExists = fs.existsSync(browsersPath)
      logger.info(`[checkBrowserInstalled] browsersPath: ${browsersPath}`)
      logger.info(`[checkBrowserInstalled] fs.existsSync(browsersPath): ${browsersDirExists}`)
      
      // List contents of browsers directory if it exists
      if (browsersDirExists) {
        try {
          const contents = fs.readdirSync(browsersPath)
          logger.info(`[checkBrowserInstalled] browsersPath contents: ${contents.join(', ')}`)
        } catch (e) {
          logger.info(`[checkBrowserInstalled] Failed to read browsersPath: ${e}`)
        }
      }
      
      return exists
    } catch (error) {
      logger.info(`[checkBrowserInstalled] Exception: ${error}`)
      return false
    }
  }

  /**
   * Starts recording browser interactions
   * @param url - The URL to navigate to
   * @param screenshotDir - Optional directory to save screenshots
   * @throws {Error} If browser fails to launch or navigate
   * @returns Promise that resolves when recording has started
   */
  async start(url: string, screenshotDir?: string): Promise<void> {
    this.startTime = Date.now()
    this.actions = []
    this.screenshotDir = screenshotDir || null
    this.initialNavigationComplete = false
    this.lastRecordedUrl = url // Initialize with the start URL to avoid recording it as a navigation

    // Log the Playwright browsers path (set at module load time)
    logger.info(`Playwright browsers path: ${browsersPath}`)
    logger.info(`Browser executable path: ${browserExecutablePath}`)

    // Check if Playwright browsers are installed
    const browserInstalled = await this.checkBrowserInstalled()
    if (!browserInstalled) {
      const errorMessage =
        'Playwright Chromium browser is not installed.\n\n' +
        `Expected location: ${browserExecutablePath}\n\n` +
        'This should have been bundled with the app. Please reinstall the application.'
      logger.error('❌ Playwright browser not installed')
      logger.error(`❌ Browser path check failed. See debug logs above for details.`)
      throw new Error(errorMessage)
    }

    this.browser = await chromium.launch({
      headless: false,
      executablePath: browserExecutablePath,
      args: [
        '--start-maximized',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    })

    const context = await this.browser.newContext({
      viewport: null,
    })

    this.page = await context.newPage()

    await this.setupEventListeners()
    
    // Navigate to URL - the framenavigated event will record this
    await this.page.goto(url)
    // Mark initial navigation as complete to allow subsequent navigations
    this.initialNavigationComplete = true
  }

  private async setupEventListeners(): Promise<void> {
    if (!this.page) return

    // Expose recording function to browser context
    await this.page.exposeFunction('__dodoRecordAction', (data: string) => {
      try {
        const parsed = JSON.parse(data)
        this.recordAction(parsed)
      } catch (e) {
        logger.error('Failed to parse action:', e)
      }
    })

    // Expose screenshot function to browser context
    await this.page.exposeFunction('__dodoTakeScreenshot', async () => {
      try {
        return await this.captureScreenshot()
      } catch (e) {
        logger.error('Failed to take screenshot:', e)
        return null
      }
    })

    // Inject the recording script into the page
    await this.page.addInitScript(getInjectionScript())
    
    // Inject the widget creation function
    // Note: Using string concatenation to avoid nested template literal issues
    await this.page.addInitScript('window.__dodoCreateWidget = ' + getWidgetScript().toString())
    
    // Inject the widget initialization script
    await this.page.addInitScript(getWidgetInitScript())
    
    // Inject the hover highlighter creation function
    await this.page.addInitScript('window.__dodoCreateHighlighter = ' + getHighlighterScript().toString())
    
    // Inject the highlighter initialization script (same pattern as widget)
    await this.page.addInitScript(getHighlighterInitScript())

    // Setup frame navigation handler
    this.frameNavigatedHandler = (frame: Frame) => {
      try {
        if (frame === this.page?.mainFrame()) {
          // Only record navigation if it's not the initial page load
          // The initial navigation is already recorded by the start() method
          if (this.initialNavigationComplete) {
            const currentUrl = frame.url()
            // Only record navigation if the URL is different from the last recorded one
            // This prevents duplicate navigation events for the same URL
            if (this.lastRecordedUrl !== currentUrl) {
              this.lastRecordedUrl = currentUrl
              this.recordAction({
                type: 'navigate',
                url: currentUrl,
              })
            }
          }
        }
      } catch (error) {
        logger.error('Error handling frame navigation:', error)
      }
    }
    
    this.page.on('framenavigated', this.frameNavigatedHandler)
  }

  /**
   * Captures a screenshot and returns the filename
   */
  private async captureScreenshot(): Promise<string | null> {
    if (!this.page || !this.screenshotDir) return null

    try {
      const timestamp = Date.now() - this.startTime
      const filename = `screenshot-${timestamp}.png`
      const filepath = path.join(this.screenshotDir, filename)
      
      await this.page.screenshot({ 
        path: filepath,
        fullPage: false,
      })
      
      logger.debug('Screenshot captured:', filename)
      return filename
    } catch (error) {
      logger.error('Screenshot capture failed:', error)
      return null
    }
  }

  private recordAction(partial: Omit<RecordedAction, 'id' | 'timestamp'>): void {
    const action: RecordedAction = {
      id: randomUUID(),
      timestamp: Date.now() - this.startTime,
      ...partial,
    }
    
    this.actions.push(action)
    this.emit('action', action)
  }

  /**
   * Gets all recorded actions
   * @returns Array of recorded actions (copy to prevent external modification)
   */
  getActions(): RecordedAction[] {
    return [...this.actions]
  }

  /**
   * Updates whether audio recording is active in the browser widget.
   */
  async updateAudioActivity(active: boolean): Promise<void> {
    if (!this.page) return
    
    // Store active state to maintain across navigations
    this.audioActive = active

    try {
      await this.page.evaluate((isActive) => {
        const win = window as any
        win.__dodoAudioActive = isActive

        if (isActive && typeof win.__dodoShowEqualizer === 'function') {
          win.__dodoShowEqualizer()
        }

        if (!isActive && typeof win.__dodoHideEqualizer === 'function') {
          win.__dodoHideEqualizer()
        }
      }, active)
    } catch (error) {
      // Silently ignore failures (page may be navigating)
    }
  }

  /**
   * Stops the browser recorder and cleans up resources
   * Removes all event listeners to prevent memory leaks
   */
  async stop(): Promise<void> {
    // Remove all event listeners
    if (this.page && this.frameNavigatedHandler) {
      this.page.removeListener('framenavigated', this.frameNavigatedHandler)
      this.frameNavigatedHandler = null
    }
    
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.page = null
    }
  }
}
