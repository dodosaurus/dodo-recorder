import fs from 'fs'
import path from 'path'

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
  } catch {
    // Ignore deletion errors
  }
}

export function getTempPath(baseDir: string, prefix: string, ext: string): string {
  return path.join(baseDir, `${prefix}-${Date.now()}${ext}`)
}

