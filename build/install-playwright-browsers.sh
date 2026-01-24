#!/bin/bash
# Script to install Playwright browsers to a local project directory
# This allows us to bundle the browsers with the Electron app
#
# For cross-platform builds, run this script on each target platform:
# - macOS ARM64: Run on M1/M2/M3 Mac
# - macOS x64: Run on Intel Mac
# - Windows: Run on Windows machine
# - Linux: Run on Linux machine
#
# Each platform's browser will be added to the same playwright-browsers directory

set -e

# The directory where browsers will be installed
BROWSERS_DIR="playwright-browsers"

echo "🎭 Installing Playwright browsers to local directory: $BROWSERS_DIR"

# Create the browsers directory if it doesn't exist
mkdir -p "$BROWSERS_DIR"

# Set PLAYWRIGHT_BROWSERS_PATH to the local directory
export PLAYWRIGHT_BROWSERS_PATH="$(pwd)/$BROWSERS_DIR"

# Install Chromium browser for the current platform
echo "📦 Installing Chromium for current platform ($OSTYPE)..."
npx playwright install chromium --with-deps

echo ""
echo "✅ Playwright Chromium installed to: $BROWSERS_DIR"
echo "📦 This directory will be bundled with the Electron app"
echo ""
echo "📋 Installed platforms:"
ls -1 "$BROWSERS_DIR/chromium-"* 2>/dev/null | sed 's|chromium-||' | sed 's|-||' || echo "  (No chromium versions found)"
echo ""
echo "💡 Tip: For cross-platform builds, run this script on each target platform."
echo "   Each platform's browser will be added to the same directory."
