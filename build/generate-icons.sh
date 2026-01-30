#!/bin/bash
# Icon generation script for Dodo Recorder
# This script generates all required icon sizes for macOS and Windows

set -e

# Source image
SOURCE="src/assets/saurus.png"

# Check if source image exists
if [ ! -f "$SOURCE" ]; then
  echo "❌ Error: Source image not found at $SOURCE"
  exit 1
fi

# Create iconset directory
echo "🎨 Generating icons for Dodo Recorder..."
rm -rf build/icon.iconset
mkdir -p build/icon.iconset

# Generate macOS iconset sizes
echo "📐 Generating macOS iconset sizes..."
sips -z 16 16 "$SOURCE" --out build/icon.iconset/icon_16x16.png
sips -z 32 32 "$SOURCE" --out build/icon.iconset/icon_16x16@2x.png
sips -z 32 32 "$SOURCE" --out build/icon.iconset/icon_32x32.png
sips -z 64 64 "$SOURCE" --out build/icon.iconset/icon_64x64.png
sips -z 128 128 "$SOURCE" --out build/icon.iconset/icon_128x128.png
sips -z 256 256 "$SOURCE" --out build/icon.iconset/icon_256x256.png
sips -z 256 256 "$SOURCE" --out build/icon.iconset/icon_256x256@2x.png
sips -z 512 512 "$SOURCE" --out build/icon.iconset/icon_512x512.png
sips -z 512 512 "$SOURCE" --out build/icon.iconset/icon_512x512@2x.png
sips -z 1024 1024 "$SOURCE" --out build/icon.iconset/icon_1024x1024.png
sips -z 1024 1024 "$SOURCE" --out build/icon.iconset/icon_1024x1024@2x.png

# Create .icns file for macOS
echo "🍎 Creating macOS .icns file..."
iconutil -c icns build/icon.iconset -o build/icon.icns

# Generate Windows .ico (512x512) if ImageMagick is available
echo "🪟 Generating Windows .ico file..."
if command -v magick &> /dev/null; then
  magick build/icon.png -define icon:auto-resize=256,128,96,64,48,32,16 build/icon.ico
  echo "  ✅ Generated build/icon.ico"
else
  echo "  ⚠️  ImageMagick not found - .ico file not generated"
fi

echo ""
echo "✅ Icon generation complete!"
echo ""
echo "Generated files:"
echo "  - build/icon.icns (macOS)"
echo "  - build/icon.ico (Windows - requires ImageMagick)"
echo ""
echo "To rebuild the app with new icons, run:"
echo "  npm run build"
