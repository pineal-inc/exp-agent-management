#!/bin/bash

set -e  # Exit on any error

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Map architecture names
case "$ARCH" in
  x86_64)
    ARCH="x64"
    ;;
  arm64|aarch64)
    ARCH="arm64"
    ;;
  *)
    echo "⚠️  Warning: Unknown architecture $ARCH, using as-is"
    ;;
esac

# Map OS names
case "$OS" in
  linux)
    OS="linux"
    ;;
  darwin)
    OS="macos"
    ;;
  *)
    echo "⚠️  Warning: Unknown OS $OS, using as-is"
    ;;
esac

PLATFORM="${OS}-${ARCH}"

# Set CARGO_TARGET_DIR if not defined
if [ -z "$CARGO_TARGET_DIR" ]; then
  CARGO_TARGET_DIR="target"
fi

echo "🔍 Detected platform: $PLATFORM"
echo "🔧 Using target directory: $CARGO_TARGET_DIR"
echo "🧹 Cleaning previous builds..."
rm -rf npx-cli/dist
mkdir -p npx-cli/dist/$PLATFORM

echo "🔨 Building frontend..."
(cd frontend && npm run build)

echo "🔨 Building Rust binaries..."
cargo build --release --manifest-path Cargo.toml
cargo build --release --bin mcp_task_server --manifest-path Cargo.toml

echo "📦 Creating distribution package..."

# Copy the main binary
cp ${CARGO_TARGET_DIR}/release/server crew
zip -q crew.zip crew
rm -f crew
mv crew.zip npx-cli/dist/$PLATFORM/crew.zip

# Copy the MCP binary
cp ${CARGO_TARGET_DIR}/release/mcp_task_server crew-mcp
zip -q crew-mcp.zip crew-mcp
rm -f crew-mcp
mv crew-mcp.zip npx-cli/dist/$PLATFORM/crew-mcp.zip

# Copy the Review CLI binary
cp ${CARGO_TARGET_DIR}/release/review crew-review
zip -q crew-review.zip crew-review
rm -f crew-review
mv crew-review.zip npx-cli/dist/$PLATFORM/crew-review.zip

echo "✅ Build complete!"
echo "📁 Files created:"
echo "   - npx-cli/dist/$PLATFORM/crew.zip"
echo "   - npx-cli/dist/$PLATFORM/crew-mcp.zip"
echo "   - npx-cli/dist/$PLATFORM/crew-review.zip"
echo ""
echo "🚀 To test locally, run:"
echo "   cd npx-cli && node bin/cli.js"
