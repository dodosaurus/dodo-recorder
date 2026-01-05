import { chromium, Browser, Page } from 'playwright'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { logger } from '../utils/logger'
import type { RecordedAction, ElementTarget } from '../../shared/types'

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
        logger.error('Failed to parse action:', e)
      }
    })

    await this.page.addInitScript(() => {
      const escapeForJson = (str: string): string => {
        return str
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
          .replace(/\f/g, '\\f')
          .replace(/\b/g, '\\b')
      }

      const getTestId = (el: Element): string | null =>
        el.getAttribute('data-testid') ||
        el.getAttribute('data-test-id') ||
        el.getAttribute('data-test')

      const VALID_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/

      const truncateText = (text: string, maxLength: number): string =>
        text.slice(0, maxLength)

      type LocatorStrategy = 'testId' | 'id' | 'role' | 'placeholder' | 'text' | 'css' | 'xpath'
      interface Locator {
        strategy: LocatorStrategy
        value: string
        confidence: 'high' | 'medium' | 'low'
      }

      const generateXPath = (el: Element): string => {
        if (el.id && VALID_ID_PATTERN.test(el.id)) {
          return `//*[@id="${el.id}"]`
        }
        
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

      const generateCssSelector = (el: Element): string => {
        const parts: string[] = []
        let current: Element | null = el
        
        while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 4) {
          let selector = current.tagName.toLowerCase()
          
          if (current.id && VALID_ID_PATTERN.test(current.id)) {
            parts.unshift(`#${current.id}`)
            break
          }
          
          if (current.className && typeof current.className === 'string') {
            const classes = current.className.trim().split(/\s+/).filter(c => 
              c && !/^(ng-|js-|is-|has-)/.test(c) && c.length < 30
            ).slice(0, 2)
            if (classes.length) {
              selector += '.' + classes.join('.')
            }
          }
          
          const parent = current.parentElement
          if (parent) {
            const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName)
            if (siblings.length > 1) {
              const index = siblings.indexOf(current) + 1
              selector += `:nth-of-type(${index})`
            }
          }
          
          parts.unshift(selector)
          current = current.parentElement
        }
        
        return parts.join(' > ')
      }

      const buildLocators = (element: Element): Locator[] => {
        const locators: Locator[] = []
        const tagName = element.tagName.toLowerCase()
        
        const testId = getTestId(element)
        if (testId) {
          locators.push({
            strategy: 'testId',
            value: `[data-testid="${escapeForJson(testId)}"]`,
            confidence: 'high'
          })
        }
        
        if (element.id && VALID_ID_PATTERN.test(element.id)) {
          locators.push({
            strategy: 'id',
            value: `#${element.id}`,
            confidence: 'high'
          })
        }
        
        const role = element.getAttribute('role')
        const ariaLabel = element.getAttribute('aria-label')
        if (role && ariaLabel) {
          locators.push({
            strategy: 'role',
            value: `getByRole('${role}', { name: '${escapeForJson(ariaLabel)}' })`,
            confidence: 'high'
          })
        } else if (ariaLabel) {
          locators.push({
            strategy: 'role',
            value: `getByLabel('${escapeForJson(ariaLabel)}')`,
            confidence: 'medium'
          })
        }
        
        const placeholder = element.getAttribute('placeholder')
        if (placeholder && ['input', 'textarea'].includes(tagName)) {
          locators.push({
            strategy: 'placeholder',
            value: `getByPlaceholder('${escapeForJson(placeholder)}')`,
            confidence: 'medium'
          })
        }
        
        const text = (element.textContent || '').trim()
        if (text && text.length > 0 && text.length < 50 && ['button', 'a', 'span', 'label', 'h1', 'h2', 'h3', 'h4', 'p'].includes(tagName)) {
          locators.push({
            strategy: 'text',
            value: `getByText('${escapeForJson(truncateText(text, 40))}')`,
            confidence: text.length < 20 ? 'medium' : 'low'
          })
        }
        
        const cssSelector = generateCssSelector(element)
        if (cssSelector) {
          locators.push({
            strategy: 'css',
            value: cssSelector,
            confidence: cssSelector.includes('#') ? 'medium' : 'low'
          })
        }
        
        locators.push({
          strategy: 'xpath',
          value: generateXPath(element),
          confidence: 'low'
        })
        
        const priorityOrder: LocatorStrategy[] = ['testId', 'id', 'role', 'placeholder', 'text', 'css', 'xpath']
        locators.sort((a, b) => priorityOrder.indexOf(a.strategy) - priorityOrder.indexOf(b.strategy))
        
        return locators.slice(0, 3)
      }

      const getElementInfo = (element: Element): object => {
        const rect = element.getBoundingClientRect()
        const tagName = element.tagName.toLowerCase()

        const testId = getTestId(element)

        const ariaLabel = element.getAttribute('aria-label')
        const role = element.getAttribute('role') || tagName
        const text = truncateText((element.textContent || '').trim(), 100)
        const placeholder = element.getAttribute('placeholder')
        
        const locators = buildLocators(element)
        const selector = locators.length > 0 ? locators[0].value : tagName

        const attrs: Record<string, string> = {}
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i]
          if (['class', 'style', 'onclick', 'onmouseover'].includes(attr.name)) continue
          attrs[attr.name] = truncateText(attr.value, 100)
        }

        return {
          selector,
          locators,
          role,
          name: ariaLabel || truncateText(text, 50),
          testId,
          xpath: generateXPath(element),
          css: generateCssSelector(element),
          text: truncateText(text, 100),
          placeholder,
          tagName,
          innerText: truncateText(text, 200),
          attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
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
        
        const assertMode = e.altKey === true || e.metaKey === true
        
        ;(window as unknown as { __dodoRecordAction: (data: string) => void }).__dodoRecordAction(JSON.stringify({
          type: assertMode ? 'assert' : 'click',
          target: getElementInfo(target),
        }))
        
        if (assertMode) {
          e.preventDefault()
          e.stopPropagation()
        }
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
      try {
        if (frame === this.page?.mainFrame()) {
          this.recordAction({
            type: 'navigate',
            url: frame.url(),
          })
        }
      } catch (error) {
        logger.error('Error handling frame navigation:', error)
      }
    })
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
