/// <reference types="vite/client" />

interface BuildInfo {
  version: string
  commitHash: string
  commitFull: string
  branch: string
  isDirty: boolean
  buildTime: string
  nodeVersion: string
}

declare const __BUILD_INFO__: BuildInfo

declare module '*.png' {
  const value: string
  export default value
}

declare module '*.jpg' {
  const value: string
  export default value
}

declare module '*.jpeg' {
  const value: string
  export default value
}

declare module '*.svg' {
  const value: string
  export default value
}
