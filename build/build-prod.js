#!/usr/bin/env node
/**
 * Production build script for Electron
 * Detects the current platform and runs the appropriate electron-builder command
 * with full signing and notarization for production releases
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env file if it exists (for signing credentials)
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log('📋 Loading environment variables from .env file...');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) return;
    
    // Parse KEY="VALUE" or KEY=VALUE format
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
} else if (process.platform === 'darwin') {
  console.warn('⚠️  Warning: .env file not found. macOS builds will not be signed/notarized.');
  console.warn('    Copy .env.example to .env and fill in your Apple Developer credentials.');
}

// Generate build info first
console.log('📝 Generating build info...');
execSync('node ./build/generate-build-info.js .', { stdio: 'inherit' });

// Build frontend with Vite
console.log('🏗️  Building frontend...');
execSync('vite build', { stdio: 'inherit' });

// Determine platform-specific electron-builder arguments
let builderArgs = '--config electron-builder.json --publish never';

const platform = process.platform;
const arch = process.env.TARGET_ARCH || process.arch;

console.log(`🔨 Building for platform: ${platform}, arch: ${arch}`);

if (platform === 'darwin') {
  // macOS - with signing and notarization
  builderArgs += ' --mac';
  if (arch === 'x64') {
    builderArgs += ' --x64';
  } else {
    builderArgs += ' --arm64';
  }
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

// Verify macOS signing/notarization setup
if (platform === 'darwin') {
  console.log('\n🔐 macOS Signing & Notarization Setup:');
  console.log(`   APPLE_ID: ${process.env.APPLE_ID ? '✅ Set' : '❌ Not set'}`);
  console.log(`   APPLE_APP_SPECIFIC_PASSWORD: ${process.env.APPLE_APP_SPECIFIC_PASSWORD ? '✅ Set' : '❌ Not set'}`);
  console.log(`   APPLE_TEAM_ID: ${process.env.APPLE_TEAM_ID ? '✅ Set' : '❌ Not set'}`);
  console.log(`   CSC_LINK: ${process.env.CSC_LINK ? '✅ Set (p12 file)' : '⚠️  Not set (will use Keychain)'}`);
  
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.error('\n❌ ERROR: Missing Apple credentials for notarization!');
    console.error('   The app will be signed but NOT notarized.');
    console.error('   Users will see "macOS cannot verify that this app is free from malware"');
    console.error('\n   To fix: Copy .env.example to .env and fill in your Apple Developer credentials.\n');
    // Don't fail, but warn loudly
  }
  
  console.log('');
}

// Run electron-builder
console.log(`🚀 Running electron-builder with args: ${builderArgs}`);
try {
  execSync(`electron-builder ${builderArgs}`, {
    stdio: 'inherit',
    env: process.env  // Explicitly pass environment variables
  });
  console.log('\n✅ Production build completed successfully!');
  
  if (platform === 'darwin' && (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID)) {
    console.log('✅ App should be signed and notarized');
  } else if (platform === 'darwin') {
    console.warn('⚠️  App is signed but NOT notarized - users will see security warnings');
  }
} catch (error) {
  console.error('❌ Build failed');
  process.exit(1);
}
