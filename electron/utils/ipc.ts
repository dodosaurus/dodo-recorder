import type { IpcResult } from '../../shared/types'

export async function handleIpc<T extends object>(
  operation: () => Promise<T>,
  errorContext: string
): Promise<IpcResult<T>> {
  try {
    const result = await operation()
    return { success: true, ...result }
  } catch (error) {
    console.error(`${errorContext}:`, error)
    return { success: false, error: String(error) }
  }
}

export function ipcSuccess<T extends object>(data: T): IpcResult<T> {
  return { success: true, ...data }
}

export function ipcError(error: unknown, context?: string): IpcResult<never> {
  if (context) {
    console.error(`${context}:`, error)
  }
  return { success: false, error: String(error) }
}

