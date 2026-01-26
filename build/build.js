#!/usr/bin/env node
/**
 * Local test build script - builds macOS ARM64 only without signing
 * For production builds, use build-prod.js
 */

const { execSync } = require('child_process');

console.log('🧪 Test build for local development (macOS ARM64 only, no signing)');

// Generate build info first
console.log('📝 Generating build info...');
execSync('node ./build/generate-build-info.js .', { stdio: 'inherit' });

// Build frontend with Vite
console.log('🏗️  Building frontend...');
execSync('vite build', { stdio: 'inherit' });

// Build for macOS ARM64 without signing
const builderArgs = '--config electron-builder.test.json --mac --arm64 --publish never -c.mac.identity=null';

console.log(`🔨 Building for macOS ARM64 (test build)...`);
try {
  execSync(`electron-builder ${builderArgs}`, { stdio: 'inherit' });
  console.log('✅ Test build completed successfully!');
} catch (error) {
  console.error('❌ Build failed');
  process.exit(1);
}
