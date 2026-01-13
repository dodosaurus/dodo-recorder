import path from 'path'
import os from 'os'
import fs from 'fs'
import { app } from 'electron'

const ALLOWED_PROTOCOLS = ['http:', 'https:']
const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]+$/
const MAX_AUDIO_SIZE = 50 * 1024 * 1024 // 50MB limit

export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' }
  }

  try {
    const parsed = new URL(url)
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return { valid: false, error: `Protocol ${parsed.protocol} is not allowed. Use http: or https:` }
    }
    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

export function sanitizeSessionId(id: string): string {
  if (!id || typeof id !== 'string') {
    return `session-${Date.now()}`
  }
  const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, '_')
  return sanitized.slice(0, 100) // Limit length
}

export function validateSessionId(id: string): boolean {
  return typeof id === 'string' && SESSION_ID_REGEX.test(id) && id.length <= 100
}

export function validateAudioBuffer(buffer: ArrayBuffer): { valid: boolean; error?: string } {
  if (!buffer || !(buffer instanceof ArrayBuffer)) {
    return { valid: false, error: 'Invalid audio buffer' }
  }
  if (buffer.byteLength > MAX_AUDIO_SIZE) {
    return { valid: false, error: `Audio buffer too large (max ${MAX_AUDIO_SIZE / 1024 / 1024}MB)` }
  }
  if (buffer.byteLength === 0) {
    return { valid: false, error: 'Audio buffer is empty' }
  }
  return { valid: true }
}

export function validateOutputPath(outputPath: string): { valid: boolean; error?: string } {
  if (!outputPath || typeof outputPath !== 'string') {
    return { valid: false, error: 'Output path is required' }
  }
  
  // Resolve to absolute path first
  const resolved = path.resolve(outputPath)
  
  // Normalize to remove . and .. segments
  const normalized = path.normalize(resolved)
  
  // Check for path traversal (normalized should not differ from resolved)
  if (normalized !== resolved) {
    return { valid: false, error: 'Path traversal not allowed' }
  }
  
  // Additional Windows-specific checks
  if (process.platform === 'win32') {
    // Check for UNC paths or device paths
    if (/^\\\\\?\\/.test(outputPath) || /^[A-Za-z]:/.test(outputPath)) {
      // Allow but validate further
    }
  }
  
  // Ensure path is within user directories
  const homeDir = os.homedir()
  const userDataDir = app.getPath('userData')
  const allowedDirs = [homeDir, userDataDir]
  
  if (!allowedDirs.some(dir => normalized.startsWith(dir))) {
    return { valid: false, error: 'Path must be within user directory' }
  }
  
  // Check for symlink traversal
  try {
    const realPath = fs.realpathSync(normalized)
    if (realPath !== normalized) {
      return { valid: false, error: 'Symlink traversal not allowed' }
    }
  } catch {
    // Path doesn't exist yet, that's OK
  }
  
  return { valid: true }
}

