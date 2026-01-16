#!/bin/bash
# Icon generation script for Dodo Recorder
# This script generates all required icon sizes for macOS, Windows, and Linux
# from the source image at src/assets/saurus.png

set -e

echo "🎨 Generating icons for Dodo Recorder..."

# Source image
SOURCE="src/assets/saurus.png"

# Check if source image exists
if [ ! -f "$SOURCE" ]; then
    echo "❌ Error: Source image not found at $SOURCE"
    exit 1
fi

# Create iconset directory
echo "📁 Creating iconset directory..."
rm -rf build/icon.iconset
mkdir -p build/icon.iconset

# Generate macOS iconset sizes
echo "📐 Generating macOS iconset sizes..."
sips -z 16 16 "$SOURCE" --out build/icon.iconset/icon_16x16.png
sips -z 32 32 "$SOURCE" --out build/icon.iconset/icon_16x16@2x.png
sips -z 32 32 "$SOURCE" --out build/icon.iconset/icon_32x32.png
sips -z 64 64 "$SOURCE" --out build/icon.iconset/icon_32x32@2x.png
sips -z 128 128 "$SOURCE" --out build/icon.iconset/icon_128x128.png
sips -z 256 256 "$SOURCE" --out build/icon.iconset/icon_128x128@2x.png
sips -z 256 256 "$SOURCE" --out build/icon.iconset/icon_256x256.png
sips -z 512 512 "$SOURCE" --out build/icon.iconset/icon_256x256@2x.png
sips -z 512 512 "$SOURCE" --out build/icon.iconset/icon_512x512.png
sips -z 1024 1024 "$SOURCE" --out build/icon.iconset/icon_512x512@2x.png

# Create .icns file for macOS
echo "🍎 Creating macOS .icns file..."
iconutil -c icns build/icon.iconset -o build/icon.icns

# Generate Windows .ico (512x512)
echo "🪟 Generating Windows .ico file..."
sips -z 512 512 "$SOURCE" --out build/icon.png
# Note: For .ico generation, you may need ImageMagick or other tools
# convert build/icon.png -define icon:auto-resize=256,128,96,64,48,32,16 build/icon.ico

# Generate Linux icon (512x512)
echo "🐧 Generating Linux icon file..."
sips -z 512 512 "$SOURCE" --out build/icon.png

echo ""
echo "✅ Icon generation complete!"
echo ""
echo "Generated files:"
echo "  - build/icon.icns (macOS)"
echo "  - build/icon.ico (Windows - requires ImageMagick)"
echo "  - build/icon.png (Linux, 512x512)"
echo "  - build/icon.iconset/ (macOS iconset source)"
echo ""
echo "To rebuild the app with new icons, run:"
echo "  npm run build"
