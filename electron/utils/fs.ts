import fs from 'fs'
import path from 'path'
import { logger } from './logger'

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true })
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2)
  await fs.promises.writeFile(filePath, content, 'utf-8')
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await fs.promises.writeFile(filePath, content, 'utf-8')
}

export async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath)
  } catch (error) {
    logger.warn(`Failed to delete file ${filePath}:`, error)
  }
}

export function getTempPath(baseDir: string, prefix: string, ext: string): string {
  return path.join(baseDir, `${prefix}-${Date.now()}${ext}`)
}

/**
 * Clean up old temporary files from a directory
 * @param dir - Directory to clean
 * @param maxAgeMs - Maximum age of files to keep (in milliseconds)
 */
export async function cleanupOldTempFiles(dir: string, maxAgeMs: number): Promise<void> {
  try {
    // Check if directory exists
    try {
      await fs.promises.access(dir)
    } catch {
      // Directory doesn't exist, nothing to clean
      return
    }

    const files = await fs.promises.readdir(dir)
    const now = Date.now()
    
    for (const file of files) {
      const filePath = path.join(dir, file)
      
      try {
        const stats = await fs.promises.stat(filePath)
        
        // Only delete files, not directories
        if (stats.isFile() && now - stats.mtimeMs > maxAgeMs) {
          await fs.promises.unlink(filePath)
          logger.debug(`Cleaned up old temp file: ${filePath}`)
        }
      } catch (error) {
        // Skip files that can't be accessed
        logger.warn(`Failed to process temp file ${filePath}:`, error)
      }
    }
  } catch (error) {
    logger.warn('Failed to cleanup temp files:', error)
  }
}

