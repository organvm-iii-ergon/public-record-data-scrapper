#!/bin/bash
# Package script for creating a shareable distribution
# Creates a standalone package that can be shared with field experts

echo "==================================="
echo "UCC Scraper - Package Builder"
echo "==================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js version: $(node --version)"
echo ""

# Clean previous builds
echo "📦 Cleaning previous builds..."
rm -rf dist-package
mkdir -p dist-package

# Create package structure
echo "📁 Creating package structure..."
cp -r scripts dist-package/
cp -r src dist-package/
cp package.json dist-package/
cp package-lock.json dist-package/
cp tsconfig.json dist-package/
cp scraper.sh dist-package/
cp example-companies.csv dist-package/
cp README.md dist-package/
cp CLI_USAGE.md dist-package/
cp QUICK_START.md dist-package/
cp LICENSE dist-package/ 2>/dev/null || echo "MIT License" > dist-package/LICENSE

# Create installation script
cat > dist-package/install.sh << 'EOF'
#!/bin/bash
echo "==================================="
echo "UCC Scraper - Installation"
echo "==================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Installation complete!"
    echo ""
    echo "Quick start:"
    echo "  npm run scrape -- list-states"
    echo "  npm run scrape -- scrape-ucc -c \"Company Name\" -s CA"
    echo ""
    echo "For full documentation, see:"
    echo "  - QUICK_START.md (beginner guide)"
    echo "  - CLI_USAGE.md (complete reference)"
    echo "  - README.md (web application)"
else
    echo ""
    echo "❌ Installation failed"
    echo "Please check the error messages above"
    exit 1
fi
EOF

chmod +x dist-package/install.sh

# Create README for distribution
cat > dist-package/INSTALL.md << 'EOF'
# Installation Instructions

## Quick Install

1. Extract this package to a directory
2. Open terminal/command prompt in that directory
3. Run the installation script:

### On Mac/Linux:
```bash
chmod +x install.sh
./install.sh
```

### On Windows:
```bash
npm install --legacy-peer-deps
```

## Verify Installation

```bash
npm run scrape -- --version
```

You should see version `1.0.0`

## Quick Start

```bash
# List available states
npm run scrape -- list-states

# Scrape UCC filings
npm run scrape -- scrape-ucc -c "Company Name" -s CA

# Get help
npm run scrape -- --help
```

## Documentation

- **QUICK_START.md** - Beginner's guide for field data collection
- **CLI_USAGE.md** - Complete command reference
- **README.md** - Full platform documentation

## Requirements

- Node.js 18 or higher
- Internet connection
- 500MB free disk space (for dependencies)

## Support

For issues, check the documentation files or contact your team lead.
EOF

# Create archive
echo "📦 Creating distribution archive..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_NAME="ucc-scraper-${TIMESTAMP}.tar.gz"

cd dist-package
tar -czf "../${ARCHIVE_NAME}" .
cd ..

echo ""
echo "✅ Package created successfully!"
echo ""
echo "Distribution file: ${ARCHIVE_NAME}"
echo "Size: $(du -h ${ARCHIVE_NAME} | cut -f1)"
echo ""
echo "To share this package:"
echo "1. Send the ${ARCHIVE_NAME} file to field experts"
echo "2. They should extract it and run install.sh (Mac/Linux) or 'npm install --legacy-peer-deps' (Windows)"
echo "3. They can start using it immediately"
echo ""
echo "Files included:"
echo "  - All scraper scripts and agents"
echo "  - Documentation (QUICK_START.md, CLI_USAGE.md, README.md)"
echo "  - Example files and configuration"
echo "  - Installation script"
echo ""
