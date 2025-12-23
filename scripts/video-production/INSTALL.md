# Video Production System - Installation Guide

Complete guide for setting up the autonomous video production agent on your system.

## Quick Start

1. **Install System Dependencies**
   ```bash
   # See platform-specific instructions below
   ```

2. **Validate Setup**
   ```bash
   npm run video:validate
   ```

3. **Generate Videos**
   ```bash
   npm run video:generate
   ```

---

## Platform-Specific Installation

### macOS

#### FFmpeg (Required for video rendering)

```bash
# Using Homebrew (recommended)
brew install ffmpeg

# Verify installation
ffmpeg -version
```

#### TTS Engine (Built-in)

macOS includes the `say` command for text-to-speech. No additional installation needed.

```bash
# Test TTS
say "Hello world"

# List available voices
say -v ?
```

---

### Ubuntu/Debian Linux

#### FFmpeg (Required)

```bash
# Install FFmpeg
sudo apt-get update
sudo apt-get install ffmpeg

# Verify installation
ffmpeg -version
```

#### TTS Engine (Choose one)

**Option 1: eSpeak (Recommended - Lightweight)**

```bash
# Install eSpeak
sudo apt-get install espeak espeak-data

# Test TTS
espeak "Hello world"

# Install additional voices (optional)
sudo apt-get install espeak-ng espeak-ng-data
```

**Option 2: Festival (Alternative - Better quality)**

```bash
# Install Festival
sudo apt-get install festival festvox-kallpc16k

# Test TTS
echo "Hello world" | festival --tts

# Install additional voices (optional)
sudo apt-get install festvox-us-slt-hts festvox-us-awb-hts
```

---

### Red Hat/CentOS/Fedora Linux

#### FFmpeg (Required)

```bash
# Enable EPEL repository
sudo dnf install epel-release

# Install FFmpeg
sudo dnf install ffmpeg

# Verify installation
ffmpeg -version
```

#### TTS Engine

```bash
# Install eSpeak
sudo dnf install espeak espeak-ng

# Test TTS
espeak "Hello world"
```

---

### Windows

#### FFmpeg (Required)

**Option 1: Using Chocolatey**

```powershell
# Install Chocolatey if not already installed
# See https://chocolatey.org/install

# Install FFmpeg
choco install ffmpeg

# Verify installation
ffmpeg -version
```

**Option 2: Manual Installation**

1. Download FFmpeg from https://ffmpeg.org/download.html
2. Extract to `C:\ffmpeg`
3. Add `C:\ffmpeg\bin` to PATH environment variable
4. Restart terminal and verify: `ffmpeg -version`

#### TTS Engine

Windows includes built-in TTS via PowerShell:

```powershell
# Test TTS
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Speak("Hello world")
```

**Note:** The current video generator uses Unix-based TTS commands. Windows support requires modifying `video-generator.ts` to use Windows Speech API.

---

## Docker Installation (Cross-Platform)

For a consistent environment across all platforms:

```dockerfile
# Create Dockerfile
FROM node:18-slim

# Install FFmpeg and eSpeak
RUN apt-get update && \
    apt-get install -y ffmpeg espeak espeak-data && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy project files
COPY package*.json ./
RUN npm install

COPY . .

# Validate setup
RUN npm run video:validate

# Default command
CMD ["npm", "run", "video:generate"]
```

Build and run:

```bash
# Build image
docker build -t video-generator .

# Run validation
docker run --rm video-generator npm run video:validate

# Generate videos (with output mounted)
docker run --rm -v $(pwd)/video-output:/app/video-output video-generator
```

---

## Verifying Installation

After installing dependencies, run the validation script:

```bash
npm run video:validate
```

Expected output:

```
✓ Test 1: Configuration Loading
✓ Test 2: Script Directory
✓ Test 3: Demo Script
✓ Test 4: Executive Script
✓ Test 5: Output Directory
✓ Test 6: FFmpeg Availability
✓ Test 7: TTS Engine Availability

✅ All critical tests passed!
```

---

## Troubleshooting

### FFmpeg not found

**Symptom:** `⚠️ FFmpeg not found` in validation

**Solution:**
1. Verify FFmpeg is installed: `which ffmpeg` or `where ffmpeg`
2. Check PATH includes FFmpeg location
3. Restart terminal after installation
4. Try absolute path if needed

### TTS not working

**Symptom:** `⚠️ No TTS engine found` in validation

**Solution:**
- **macOS:** `say` should be built-in. Try: `say "test"`
- **Linux:** Install eSpeak: `sudo apt-get install espeak`
- **Windows:** Use Docker or modify generator for Windows Speech API

**Workaround:** The system will generate silent audio as fallback. You can add narration in post-production.

### Permission denied

**Symptom:** Cannot write to output directory

**Solution:**
```bash
# Create output directory with correct permissions
mkdir -p video-output
chmod 755 video-output

# Or specify different output directory
./scripts/video-production/generate-videos.sh --output-dir ~/Videos
```

### Slow rendering

**Symptom:** Video generation takes very long

**Solution:**
- Use lower resolution: `--resolution 1280x720`
- Reduce FPS: `--fps 24`
- Close other applications to free CPU
- Use faster preset (edit `video-generator.ts`: change `preset medium` to `preset fast`)

---

## Optional Dependencies

### Better TTS Quality (Linux)

For higher quality text-to-speech on Linux:

```bash
# Install piper-tts (neural TTS)
pip install piper-tts

# Or use cloud services (requires modification):
# - Google Cloud Text-to-Speech
# - Amazon Polly
# - Azure Cognitive Services
```

### Enhanced Video Processing

For advanced video effects:

```bash
# Install additional FFmpeg filters
sudo apt-get install frei0r-plugins

# Install subtitle support
sudo apt-get install libass-dev
```

### GPU Acceleration

For faster rendering with NVIDIA GPU:

```bash
# Install CUDA support for FFmpeg
sudo apt-get install ffmpeg-nvidia

# Use hardware encoder in video-generator.ts:
# Change: -c:v libx264
# To: -c:v h264_nvenc
```

---

## Next Steps

After successful installation:

1. **Run validation:**
   ```bash
   npm run video:validate
   ```

2. **Generate demo video:**
   ```bash
   npm run video:generate -- --pattern "DEMO_VIDEO_SCRIPT.md"
   ```

3. **Generate executive video:**
   ```bash
   npm run video:generate -- --pattern "EXECUTIVE_VIDEO_SCRIPT.md"
   ```

4. **Customize scripts:**
   - Edit `docs/video-portfolio/EXECUTIVE_VIDEO_SCRIPT.md`
   - Add your own scripts following the same format
   - Run generator on your custom scripts

5. **Review output:**
   - Check `video-output/` directory for generated videos
   - Review `video-output/render-report.json` for details
   - Share videos or upload to hosting platforms

---

## Getting Help

If you encounter issues:

1. Run validation: `npm run video:validate`
2. Check the troubleshooting section above
3. Review `video-output/render-report.json` for detailed errors
4. Open an issue with:
   - Platform and version (OS, FFmpeg, Node.js)
   - Validation output
   - Render report JSON
   - Any error messages

---

## Resources

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [eSpeak NG](https://github.com/espeak-ng/espeak-ng)
- [Festival TTS](http://www.cstr.ed.ac.uk/projects/festival/)
- [Video Production README](./README.md)
