const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VENDOR_DIR = path.join(__dirname, '..', 'vendor');
const WHISPER_DIR = path.join(VENDOR_DIR, 'whisper.cpp');
const REPO_URL = 'https://github.com/ggerganov/whisper.cpp.git';
const TARGET_TAG = 'v1.5.4'; // Last known version to support simple 'make main' without mandatory cmake

if (!fs.existsSync(VENDOR_DIR)) {
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
}

function runCommand(command, cwd) {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { cwd, stdio: 'inherit' });
  } catch (error) {
    console.error(`Failed to execute: ${command}`);
    process.exit(1);
  }
}

if (!fs.existsSync(WHISPER_DIR)) {
  console.log('Cloning whisper.cpp...');
  // Clone full depth to get tags, or fetch tags after
  runCommand(`git clone ${REPO_URL}`, VENDOR_DIR);
} else {
  console.log('whisper.cpp already exists.');
}

// Ensure we are on the correct tag
console.log(`Checking out ${TARGET_TAG}...`);
runCommand(`git fetch --tags`, WHISPER_DIR);
runCommand(`git checkout ${TARGET_TAG}`, WHISPER_DIR);

console.log('Building whisper.cpp...');
const makeCommand = process.platform === 'win32' ? 'make main.exe' : 'make main';
runCommand(makeCommand, WHISPER_DIR);

console.log('whisper.cpp setup complete.');
