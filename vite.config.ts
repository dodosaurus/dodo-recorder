import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'
import fs from 'fs'

// Generate build info at config load time
const buildInfoPath = path.join(__dirname, 'build-info.json')
if (!fs.existsSync(buildInfoPath)) {
  // Generate build info if it doesn't exist
  const { execSync } = require('child_process')
  try {
    execSync('node ./build/generate-build-info.js .', { stdio: 'inherit' })
  } catch (e) {
    console.warn('Failed to generate build info:', e)
  }
}

// Read build info
let buildInfo: Record<string, string | boolean> = {}
try {
  const buildInfoContent = fs.readFileSync(buildInfoPath, 'utf-8')
  buildInfo = JSON.parse(buildInfoContent)
} catch (e) {
  console.warn('Failed to read build info:', e)
}

export default defineConfig({
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo)
  },
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(args) {
          args.startup()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['playwright', 'ffmpeg-static', 'fluent-ffmpeg']
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
