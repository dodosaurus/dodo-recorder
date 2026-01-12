import path from 'path'
import { ensureDir, writeJson, writeText } from '../utils/fs'
import { sanitizeSessionId } from '../utils/validation'
import { generateTranscriptWithReferences } from '../utils/enhancedTranscript'
import type { SessionBundle, RecordedAction } from '../../shared/types'

export class SessionWriter {
  private outputDir: string

  constructor(outputDir: string) {
    this.outputDir = outputDir
  }

  async write(session: SessionBundle): Promise<string> {
    try {
      // Generate session directory name from startTime
      const date = new Date(session.startTime)
      const sessionId = date.toISOString()
        .replace(/T/, '-')
        .replace(/:/g, '')
        .split('.')[0] // Remove milliseconds
      const safeId = sanitizeSessionId(`session-${sessionId}`)
      
      const sessionDir = path.join(this.outputDir, safeId)
      const screenshotsDir = path.join(sessionDir, 'screenshots')

      await ensureDir(sessionDir)
      await ensureDir(screenshotsDir)

      // Prepare actions without voiceSegments for clean JSON output
      const actionsWithoutVoice = session.actions.map(action => {
        const { voiceSegments, ...actionWithoutVoice } = action
        return actionWithoutVoice
      })
      
      // Extract start URL from first navigate action if available
      const startUrl = session.actions.find(a => a.type === 'navigate')?.url

      // Generate transcript.txt with embedded action and screenshot references
      const transcriptText = generateTranscriptWithReferences(
        session.actions,
        safeId,
        session.startTime,
        startUrl
      )
      
      // Count action types for metadata
      const actionTypeCounts = session.actions.reduce((acc, action) => {
        acc[action.type] = (acc[action.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      // Add metadata wrapper to actions.json
      const actionsWithMeta = {
        _meta: {
          formatVersion: '1.0',
          generatedBy: 'Dodo Recorder',
          sessionId: safeId,
          startTime: session.startTime,
          startTimeISO: new Date(session.startTime).toISOString(),
          totalActions: session.actions.length,
          actionTypes: actionTypeCounts,
          ...(startUrl && { startUrl }),
          notes: {
            locatorPriority: 'Recommended: testId > text/placeholder/role > css > xpath',
            confidenceLevels: 'high (preferred) > medium (acceptable) > low (avoid if alternatives exist)',
            actionTypeDescriptions: {
              navigate: 'Page navigation or URL change',
              click: 'User click interaction',
              fill: 'Text input to form fields',
              assert: 'Element visibility check (for test assertions)',
              screenshot: 'Manual screenshot capture',
              keypress: 'Keyboard input',
              select: 'Dropdown selection',
              check: 'Checkbox/radio interaction',
              scroll: 'Page scroll action'
            }
          }
        },
        actions: actionsWithoutVoice
      }
      
      // Generate README.md for session directory
      const readmeContent = this.generateReadme(safeId, session, startUrl, actionTypeCounts)

      // Write the 4 essential files:
      // 1. actions.json - all actions with metadata wrapper
      // 2. transcript.txt - narrative with comprehensive header
      // 3. README.md - quick start guide for AI agents
      // 4. screenshots/ - folder already created, screenshots saved during recording
      await Promise.all([
        writeJson(path.join(sessionDir, 'actions.json'), actionsWithMeta),
        writeText(path.join(sessionDir, 'transcript.txt'), transcriptText),
        writeText(path.join(sessionDir, 'README.md'), readmeContent),
      ])

      return sessionDir
    } catch (error) {
      console.error('[SessionWriter] Failed to write session:', error)
      throw error
    }
  }
  
  /**
   * Generates README.md content for the session directory
   */
  private generateReadme(
    sessionId: string,
    session: SessionBundle,
    startUrl: string | undefined,
    actionTypeCounts: Record<string, number>
  ): string {
    const firstAction = session.actions[0]
    const lastAction = session.actions[session.actions.length - 1]
    const durationMs = lastAction.timestamp - firstAction.timestamp
    const durationFormatted = this.formatDuration(durationMs)
    
    const lines: string[] = []
    
    lines.push(`# Session Bundle: ${sessionId}\n`)
    lines.push('## Quick Start for AI Agents\n')
    lines.push('This directory contains a complete recording session for browser automation test generation.')
    lines.push('The format is **framework-agnostic** - works with Playwright, Cypress, Selenium, Puppeteer, etc.\n')
    
    lines.push('### Files')
    lines.push('- **transcript.txt** - Narrative with action references and comprehensive AI usage instructions')
    lines.push('- **actions.json** - Detailed action metadata with multiple locator strategies and confidence levels')
    lines.push('- **screenshots/** - Visual captures of browser state\n')
    
    lines.push('### How to Use')
    lines.push('1. **Start with transcript.txt** - Read the header for complete parsing instructions')
    lines.push('2. **Parse the narrative** - Extract action references in format `[action:SHORT_ID:TYPE]`')
    lines.push('3. **Cross-reference with actions.json** - Match 8-char ID prefixes to full UUIDs')
    lines.push('4. **Choose locator strategies** - Use confidence levels (high > medium > low)')
    lines.push('5. **Generate tests** - Use your framework of choice with provided locator data\n')
    
    lines.push('### Session Metadata')
    lines.push(`- **Start Time**: ${new Date(session.startTime).toISOString()}`)
    if (startUrl) {
      lines.push(`- **Starting URL**: ${startUrl}`)
    }
    lines.push(`- **Duration**: ${durationFormatted}`)
    lines.push(`- **Total Actions**: ${session.actions.length}`)
    
    const actionTypesList = Object.entries(actionTypeCounts)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ')
    lines.push(`- **Action Breakdown**: ${actionTypesList}\n`)
    
    // Extract test intent from voice commentary if available
    const firstVoicedAction = session.actions.find(a => a.voiceSegments && a.voiceSegments.length > 0)
    if (firstVoicedAction && firstVoicedAction.voiceSegments) {
      const firstText = firstVoicedAction.voiceSegments[0].text
      lines.push('### Test Intent (from voice commentary)')
      lines.push(`> "${firstText.substring(0, 200)}${firstText.length > 200 ? '...' : ''}"\n`)
    }
    
    lines.push('### Key Features')
    lines.push('- ✅ Multiple locator strategies per action (testId, text, role, css, xpath)')
    lines.push('- ✅ Confidence levels for each locator (high, medium, low)')
    lines.push('- ✅ Voice commentary explaining user intent')
    lines.push('- ✅ Complete action metadata (target, value, timestamps, bounding boxes)')
    lines.push('- ✅ Screenshots with cross-references')
    lines.push('- ✅ Framework-agnostic format\n')
    
    lines.push('---\n')
    lines.push('**Format Version**: 1.0  ')
    lines.push('**Generated By**: Dodo Recorder  ')
    
    return lines.join('\n')
  }
  
  /**
   * Formats duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    
    if (minutes === 0) {
      return `${seconds}s`
    }
    return `${minutes}m ${seconds}s`
  }
}
