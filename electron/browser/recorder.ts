import { chromium, Browser, Page } from 'playwright'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'

interface ElementTarget {
  selector: string
  role?: string
  name?: string
  testId?: string
  xpath?: string
  css?: string
  text?: string
  placeholder?: string
  boundingBox?: { x: number; y: number; width: number; height: number }
}

interface RecordedAction {
  id: string
  timestamp: number
  type: 'click' | 'fill' | 'navigate' | 'keypress' | 'select' | 'check' | 'scroll'
  target?: ElementTarget
  value?: string
  url?: string
  key?: string
}

export class BrowserRecorder extends EventEmitter {
  private browser: Browser | null = null
  private page: Page | null = null
  private actions: RecordedAction[] = []
  private startTime: number = 0

  async start(url: string): Promise<void> {
    this.startTime = Date.now()
    this.actions = []

    this.browser = await chromium.launch({
      headless: false,
      args: ['--start-maximized'],
    })

    const context = await this.browser.newContext({
      viewport: null,
    })

    this.page = await context.newPage()

    await this.setupEventListeners()
    
    await this.page.goto(url)
    this.recordAction({
      type: 'navigate',
      url,
    })
  }

  private async setupEventListeners(): Promise<void> {
    if (!this.page) return

    await this.page.exposeFunction('__dodoRecordAction', (data: string) => {
      try {
        const parsed = JSON.parse(data)
        this.recordAction(parsed)
      } catch (e) {
        console.error('Failed to parse action:', e)
      }
    })

    await this.page.addInitScript(() => {
      const getElementInfo = (element: Element): object => {
        const rect = element.getBoundingClientRect()
        const attributes: Record<string, string> = {}
        
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i]
          attributes[attr.name] = attr.value
        }

        const testId = element.getAttribute('data-testid') || 
                       element.getAttribute('data-test-id') ||
                       element.getAttribute('data-test')

        const ariaLabel = element.getAttribute('aria-label')
        const role = element.getAttribute('role') || element.tagName.toLowerCase()
        const text = (element.textContent || '').trim().slice(0, 100)
        const placeholder = element.getAttribute('placeholder')
        
        let selector = element.tagName.toLowerCase()
        if (element.id) {
          selector = `#${element.id}`
        } else if (testId) {
          selector = `[data-testid="${testId}"]`
        } else if (ariaLabel) {
          selector = `[aria-label="${ariaLabel}"]`
        } else if (text && text.length < 50) {
          selector = `${element.tagName.toLowerCase()}:has-text("${text.slice(0, 30)}")`
        }

        const generateXPath = (el: Element): string => {
          if (el.id) return `//*[@id="${el.id}"]`
          
          const parts: string[] = []
          let current: Element | null = el
          
          while (current && current.nodeType === Node.ELEMENT_NODE) {
            let index = 1
            let sibling = current.previousElementSibling
            
            while (sibling) {
              if (sibling.tagName === current.tagName) index++
              sibling = sibling.previousElementSibling
            }
            
            const tagName = current.tagName.toLowerCase()
            parts.unshift(index > 1 ? `${tagName}[${index}]` : tagName)
            current = current.parentElement
          }
          
          return '/' + parts.join('/')
        }

        return {
          selector,
          role,
          name: ariaLabel || text.slice(0, 50),
          testId,
          xpath: generateXPath(element),
          css: selector,
          text: text.slice(0, 100),
          placeholder,
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        }
      }

      document.addEventListener('click', (e) => {
        const target = e.target as Element
        if (!target) return
        
        (window as unknown as { __dodoRecordAction: (data: string) => void }).__dodoRecordAction(JSON.stringify({
          type: 'click',
          target: getElementInfo(target),
        }))
      }, true)

      document.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement
        if (!target) return
        
        (window as unknown as { __dodoRecordAction: (data: string) => void }).__dodoRecordAction(JSON.stringify({
          type: 'fill',
          target: getElementInfo(target),
          value: target.value,
        }))
      }, true)

      document.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement
        if (target.tagName === 'SELECT') {
          (window as unknown as { __dodoRecordAction: (data: string) => void }).__dodoRecordAction(JSON.stringify({
            type: 'select',
            target: getElementInfo(target),
            value: target.value,
          }))
        }
      }, true)

      document.addEventListener('keydown', (e) => {
        if (['Enter', 'Tab', 'Escape'].includes(e.key)) {
          const target = e.target as Element
          (window as unknown as { __dodoRecordAction: (data: string) => void }).__dodoRecordAction(JSON.stringify({
            type: 'keypress',
            target: target ? getElementInfo(target) : undefined,
            key: e.key,
          }))
        }
      }, true)
    })

    this.page.on('framenavigated', (frame) => {
      if (frame === this.page?.mainFrame()) {
        this.recordAction({
          type: 'navigate',
          url: frame.url(),
        })
      }
    })
  }

  private recordAction(partial: Omit<RecordedAction, 'id' | 'timestamp'>): void {
    const action: RecordedAction = {
      id: uuidv4(),
      timestamp: Date.now() - this.startTime,
      ...partial,
    }
    
    this.actions.push(action)
    this.emit('action', action)
  }

  getActions(): RecordedAction[] {
    return [...this.actions]
  }

  async stop(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.page = null
    }
  }
}

