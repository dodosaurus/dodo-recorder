#!/usr/bin/env node
/**
 * Generate build info file with git commit hash and build timestamp
 * This file is read by the Electron app to display build information
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get output directory from first argument, default to current directory
const outputDir = process.argv[2] || '.';
const outputFile = path.join(outputDir, 'build-info.json');

/**
 * Execute a git command and return the output
 * @param {string} command - Git command to execute
 * @returns {string|null} Command output or null if failed
 */
function execGit(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

// Check if git is available and we're in a git repository
function isGitAvailable() {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

// Get git information
let commitHash = 'unknown';
let commitFull = 'unknown';
let branchName = 'unknown';
let isDirty = false;

if (isGitAvailable()) {
  commitHash = execGit('git rev-parse --short HEAD') || 'unknown';
  commitFull = execGit('git rev-parse HEAD') || 'unknown';
  branchName = execGit('git rev-parse --abbrev-ref HEAD') || 'unknown';
  
  // Check if working directory is dirty
  try {
    execSync('git diff --quiet', { stdio: 'ignore' });
    isDirty = false;
  } catch (e) {
    isDirty = true;
  }
}

// Build timestamp (ISO 8601 UTC format)
const buildTime = new Date().toISOString();

// Node version
const nodeVersion = process.version;

// Read version from package.json
let version = 'unknown';
try {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  version = packageJson.version || 'unknown';
} catch (e) {
  console.warn('Could not read version from package.json:', e.message);
}

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create build info object
const buildInfo = {
  version,
  commitHash,
  commitFull,
  branch: branchName,
  isDirty,
  buildTime,
  nodeVersion
};

// Write build info JSON
fs.writeFileSync(outputFile, JSON.stringify(buildInfo, null, 2) + '\n');

console.log(`Build info written to: ${outputFile}`);
if (isDirty) {
  console.log(`Commit: ${commitHash} (dirty)`);
} else {
  console.log(`Commit: ${commitHash}`);
}
