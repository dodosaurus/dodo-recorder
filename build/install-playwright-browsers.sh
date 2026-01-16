#!/bin/bash
# Script to install Playwright browsers to a local project directory
# This allows us to bundle the browsers with the Electron app

set -e

# The directory where browsers will be installed
BROWSERS_DIR="playwright-browsers"

echo "🎭 Installing Playwright browsers to local directory: $BROWSERS_DIR"

# Create the browsers directory if it doesn't exist
mkdir -p "$BROWSERS_DIR"

# Set PLAYWRIGHT_BROWSERS_PATH to the local directory
export PLAYWRIGHT_BROWSERS_PATH="$(pwd)/$BROWSERS_DIR"

# Install Chromium browser to the local directory
npx playwright install chromium --with-deps

echo "✅ Playwright Chromium installed to: $BROWSERS_DIR"
echo "📦 This directory will be bundled with the Electron app"
