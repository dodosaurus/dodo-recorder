#!/usr/bin/env node
/**
 * Cross-platform script to install Playwright browsers to a local project directory
 * This allows us to bundle the browsers with the Electron app
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// The directory where browsers will be installed
const BROWSERS_DIR = 'playwright-browsers';

console.log(`🎭 Installing Playwright browsers to local directory: ${BROWSERS_DIR}`);

// Create the browsers directory if it doesn't exist
const browsersPath = path.join(process.cwd(), BROWSERS_DIR);
if (!fs.existsSync(browsersPath)) {
  fs.mkdirSync(browsersPath, { recursive: true });
}

// Set PLAYWRIGHT_BROWSERS_PATH to the local directory
process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;

try {
  // Install Chromium browser for the current platform
  console.log(`📦 Installing Chromium for current platform (${process.platform})...`);
  
  execSync('npx playwright install chromium --with-deps', {
    stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersPath }
  });

  console.log('');
  console.log(`✅ Playwright Chromium installed to: ${BROWSERS_DIR}`);
  console.log('📦 This directory will be bundled with the Electron app');
  console.log('');
  
  // List installed platforms
  console.log('📋 Installed platforms:');
  try {
    const files = fs.readdirSync(browsersPath);
    const chromiumDirs = files.filter(f => f.startsWith('chromium-'));
    if (chromiumDirs.length > 0) {
      chromiumDirs.forEach(dir => console.log(`  ${dir}`));
    } else {
      console.log('  (No chromium versions found)');
    }
  } catch (e) {
    console.log('  (Unable to list installed versions)');
  }
  
  console.log('');
  console.log('💡 Tip: For cross-platform builds, run this script on each target platform.');
  console.log('   Each platform\'s browser will be added to the same directory.');
  
} catch (error) {
  console.error('❌ Failed to install Playwright browsers:', error.message);
  process.exit(1);
}
