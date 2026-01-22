import path from 'path'
import fs from 'fs'
import { app } from 'electron'

/**
 * Gets the path to the Playwright browsers directory
 * In development: uses project root's playwright-browsers
 * In production: uses app.asar's resources/playwright-browsers
 *
 * IMPORTANT: This must be called BEFORE importing Playwright because
 * Playwright reads PLAYWRIGHT_BROWSERS_PATH at module load time.
 */
function getBrowsersPath(): string {
  if (app.isPackaged) {
    // Production: browsers are in extraResources
    return path.join(process.resourcesPath, 'playwright-browsers')
  }
  // Development: browsers are in project root
  return path.join(process.cwd(), 'playwright-browsers')
}

// Set PLAYWRIGHT_BROWSERS_PATH BEFORE importing Playwright
// Playwright reads this environment variable at module load time
const browsersPath = getBrowsersPath()
process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath

// Now import Playwright after setting the environment variable
import { chromium, Browser, Page, Frame } from 'playwright'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { logger } from '../utils/logger'
import type { RecordedAction } from '../../shared/types'
import { getInjectionScript } from './injected-script'
import { getWidgetScript, getWidgetInitScript } from './recording-widget'

export class BrowserRecorder extends EventEmitter {
  private browser: Browser | null = null
  private page: Page | null = null
  private actions: RecordedAction[] = []
  private startTime: number = 0
  private frameNavigatedHandler: ((frame: Frame) => void) | null = null
  private screenshotDir: string | null = null
  private initialNavigationComplete: boolean = false
  private audioActive: boolean = false

  /**
   * Checks if Playwright Chromium browser is installed
   * @returns true if browser is installed, false otherwise
   */
  private async checkBrowserInstalled(): Promise<boolean> {
    try {
      // Try to get browser executable path
      const browserPath = chromium.executablePath()
      return fs.existsSync(browserPath)
    } catch (error) {
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

    // Log the Playwright browsers path (set at module load time)
    logger.debug(`Playwright browsers path: ${browsersPath}`)

    // Check if Playwright browsers are installed
    const browserInstalled = await this.checkBrowserInstalled()
    if (!browserInstalled) {
      const errorMessage =
        'Playwright Chromium browser is not installed.\n\n' +
        `Expected location: ${browsersPath}\n\n` +
        'This should have been bundled with the app. Please reinstall the application.'
      logger.error('❌ Playwright browser not installed')
      throw new Error(errorMessage)
    }

    this.browser = await chromium.launch({
      headless: false,
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

    // Setup frame navigation handler
    this.frameNavigatedHandler = (frame: Frame) => {
      try {
        if (frame === this.page?.mainFrame()) {
          // Only record navigation if it's not the initial page load
          // The initial navigation is already recorded by the start() method
          if (this.initialNavigationComplete) {
            this.recordAction({
              type: 'navigate',
              url: frame.url(),
            })
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
   * Updates the audio level on the browser page for the recording widget.
   * Also ensures audio activity is maintained across page navigations.
   */
  async updateAudioLevel(level: number): Promise<void> {
    if (!this.page) return

    try {
      // If audio is active, ensure state is maintained across navigations
      const shouldBeActive = this.audioActive
      
      await this.page.evaluate(({ lvl, isActive }) => {
        const win = window as any
        win.__dodoAudioLevel = lvl
        
        // Re-establish active state after page navigations
        // This happens when __dodoAudioActive is reset to false in new page context
        if (isActive && !win.__dodoAudioActive) {
          win.__dodoAudioActive = true
          if (typeof win.__dodoShowEqualizer === 'function') {
            win.__dodoShowEqualizer()
          }
        }
      }, { lvl: level, isActive: shouldBeActive })
    } catch (error) {
      // Silently ignore failures (page may be navigating)
    }
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
