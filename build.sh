#!/bin/bash
# Render.com build script - installs ODA File Converter for DWG AC1032 conversion
set -e

echo "Installing Node.js dependencies..."
npm install

echo "Installing ODA File Converter..."
apt-get update -y 2>/dev/null || true
apt-get install -y libqt5core5a libqt5gui5 libqt5widgets5 2>/dev/null || true

# Download ODA File Converter (free, no registration needed for this version)
ODA_DIR="/opt/oda"
mkdir -p "$ODA_DIR"

if [ ! -f "$ODA_DIR/ODAFileConverter" ]; then
  echo "Downloading ODA File Converter..."
  wget -q "https://storage.googleapis.com/oda-cloud/converter/ODAFileConverter_QT5_lnxX64_8.3dll_25.5.1.tar.gz" \
    -O /tmp/oda.tar.gz 2>/dev/null || \
  wget -q "https://download.opendesign.com/guestfiles/ODA_File_Converter/ODAFileConverter_QT5_lnxX64_8.3dll_24.12.tar.gz" \
    -O /tmp/oda.tar.gz 2>/dev/null || \
  echo "ODA download skipped (will use fallback parser)"
  
  if [ -f /tmp/oda.tar.gz ]; then
    tar -xzf /tmp/oda.tar.gz -C "$ODA_DIR" --strip-components=1 2>/dev/null || true
    chmod +x "$ODA_DIR/ODAFileConverter" 2>/dev/null || true
    echo "ODA File Converter installed!"
  fi
fi

echo "Build complete!"
