#!/usr/bin/env node
/**
 * Cross-platform build script for Electron
 * Detects the current platform and runs the appropriate electron-builder command
 */

const { execSync } = require('child_process');
const path = require('path');

// Generate build info first
console.log('📝 Generating build info...');
execSync('node ./build/generate-build-info.js .', { stdio: 'inherit' });

// Build frontend with Vite
console.log('🏗️  Building frontend...');
execSync('vite build', { stdio: 'inherit' });

// Determine platform-specific electron-builder arguments
let builderArgs = '--config electron-builder.test.json --publish never';

const platform = process.platform;
const arch = process.env.TARGET_ARCH || process.arch;

console.log(`🔨 Building for platform: ${platform}, arch: ${arch}`);

if (platform === 'darwin') {
  // macOS
  builderArgs += ' --mac';
  if (arch === 'x64') {
    builderArgs += ' --x64';
  } else {
    builderArgs += ' --arm64';
  }
  // Don't sign in test builds
  builderArgs += ' -c.mac.identity=null';
} else if (platform === 'win32') {
  // Windows
  builderArgs += ' --win --x64';
} else if (platform === 'linux') {
  // Linux
  builderArgs += ' --linux --x64';
} else {
  console.error(`Unsupported platform: ${platform}`);
  process.exit(1);
}

// Run electron-builder
console.log(`🚀 Running electron-builder with args: ${builderArgs}`);
try {
  execSync(`electron-builder ${builderArgs}`, { stdio: 'inherit' });
  console.log('✅ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed');
  process.exit(1);
}
