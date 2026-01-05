/**
 * Logger utility for handling sensitive data in logs
 * Provides environment-aware logging with different levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const isDevelopment = process.env.NODE_ENV === 'development'

/**
 * Sanitizes sensitive data from log messages
 * Removes file paths, tokens, and other sensitive information
 */
function sanitizeMessage(msg: string): string {
  if (isDevelopment) {
    // In development, show full messages
    return msg
  }
  
  // In production, sanitize sensitive patterns
  return msg
    .replace(/\/Users\/[^/]+/g, '/Users/***')
    .replace(/\/home\/[^/]+/g, '/home/***')
    .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\***')
    .replace(/token[=:]\s*[^\s]+/gi, 'token=***')
    .replace(/password[=:]\s*[^\s]+/gi, 'password=***')
    .replace(/api[_-]?key[=:]\s*[^\s]+/gi, 'api_key=***')
}

/**
 * Formats log message with timestamp and level
 */
function formatMessage(level: LogLevel, msg: string): string {
  const timestamp = new Date().toISOString()
  return `[${timestamp}] [${level.toUpperCase()}] ${msg}`
}

export const logger = {
  /**
   * Debug level logging - only shown in development
   */
  debug: (msg: string, ...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(formatMessage('debug', sanitizeMessage(msg)), ...args)
    }
  },

  /**
   * Info level logging - shown in all environments
   */
  info: (msg: string, ...args: unknown[]): void => {
    console.log(formatMessage('info', sanitizeMessage(msg)), ...args)
  },

  /**
   * Warning level logging - shown in all environments
   */
  warn: (msg: string, ...args: unknown[]): void => {
    console.warn(formatMessage('warn', sanitizeMessage(msg)), ...args)
  },

  /**
   * Error level logging - shown in all environments
   */
  error: (msg: string, ...args: unknown[]): void => {
    console.error(formatMessage('error', sanitizeMessage(msg)), ...args)
  },

  /**
   * Log with custom level
   */
  log: (level: LogLevel, msg: string, ...args: unknown[]): void => {
    const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    method(formatMessage(level, sanitizeMessage(msg)), ...args)
  },
}
