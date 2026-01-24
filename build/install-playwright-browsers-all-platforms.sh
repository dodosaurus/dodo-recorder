#!/bin/bash
# Script to install Playwright browsers for ALL platforms
# This allows us to bundle the browsers with the Electron app for cross-platform builds
#
# This script downloads browser packages directly from Playwright's CDN
# for all platforms: macOS ARM64, macOS x64, Windows x64, Linux x64

set -e

# The directory where browsers will be installed
BROWSERS_DIR="playwright-browsers"

# Playwright version (should match package.json)
PLAYWRIGHT_VERSION="1.40.0"
CHROMIUM_VERSION="1200"

# Playwright CDN base URL
CDN_BASE="https://playwright.azureedge.net/builds/chromium"

echo "🎭 Installing Playwright browsers for ALL platforms to: $BROWSERS_DIR"
echo "📋 Playwright version: $PLAYWRIGHT_VERSION"
echo "📋 Chromium version: $CHROMIUM_VERSION"
echo ""

# Create the browsers directory if it doesn't exist
mkdir -p "$BROWSERS_DIR"

# Function to download and extract browser
download_browser() {
  local platform_name=$1
  local platform_dir=$2
  local zip_file=$3
  local url="$CDN_BASE/$CHROMIUM_VERSION/$platform_dir/$zip_file"
  
  local target_dir="$BROWSERS_DIR/chromium-$CHROMIUM_VERSION/$platform_dir"
  local temp_zip="/tmp/$zip_file"
  
  echo "📦 Downloading $platform_name..."
  
  # Download
  if curl -L -o "$temp_zip" "$url"; then
    echo "  ✅ Downloaded to: $temp_zip"
  else
    echo "  ❌ Failed to download $platform_name"
    return 1
  fi
  
  # Create target directory
  mkdir -p "$target_dir"
  
  # Extract
  echo "  📂 Extracting to: $target_dir"
  if unzip -q -o "$temp_zip" -d "$target_dir"; then
    echo "  ✅ Extracted successfully"
  else
    echo "  ❌ Failed to extract $platform_name"
    rm -f "$temp_zip"
    return 1
  fi
  
  # Clean up
  rm -f "$temp_zip"
  echo "  ✅ $platform_name installed"
  echo ""
  return 0
}

# Download browsers for all platforms
# macOS ARM64
download_browser "macOS ARM64" "mac-arm64" "chrome-mac-arm64.zip" || true

# macOS x64
download_browser "macOS x64" "mac-x64" "chrome-mac-x64.zip" || true

# Windows x64
download_browser "Windows x64" "win64" "chrome-win64.zip" || true

# Linux x64
download_browser "Linux x64" "linux" "chrome-linux.zip" || true

echo "=========================================="
echo "✅ All Playwright browsers installed"
echo "=========================================="
echo ""
echo "📋 Installed platforms:"
ls -1 "$BROWSERS_DIR/chromium-$CHROMIUM_VERSION/" 2>/dev/null || echo "  (No platforms found)"
echo ""
echo "📦 This directory will be bundled with the Electron app"
echo "💡 You can now build for any platform without needing to re-run this script"
