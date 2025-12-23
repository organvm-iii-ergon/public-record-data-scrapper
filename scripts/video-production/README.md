# Autonomous Video Production Agent

An automated system for generating professional MP4 videos from markdown scripts using local-first, fully automated workflows.

## Overview

This video production agent transforms finalized narration scripts into finished, shareable videos suitable for non-technical audiences. It handles:

- ✅ Script scanning and scene detection
- ✅ Local text-to-speech narration generation
- ✅ Visual asset creation (title cards, diagrams, metrics)
- ✅ Demo capture (when available)
- ✅ Audio-visual synchronization
- ✅ FFmpeg-based video rendering
- ✅ Comprehensive error handling and fallbacks
- ✅ Detailed render logs

## Features

### Fully Automated Pipeline

The agent executes a 7-step process:

1. **Script Scanning**: Discovers all scripts matching the configured pattern
2. **Scene Detection**: Parses markdown structure to identify scene boundaries
3. **Audio Generation**: Creates narration using local TTS engines
4. **Visual Generation**: Produces title cards, diagrams, or captures demos
5. **Timeline Synchronization**: Aligns audio and visuals on a timeline
6. **Video Rendering**: Uses FFmpeg to create the final MP4
7. **Report Generation**: Outputs detailed logs and summaries

### Intelligent Fallbacks

The system gracefully handles failures:

- **TTS Failure**: Retries with chunked generation or silent audio
- **Demo Capture Failure**: Falls back to static visuals
- **Complex Rendering Failure**: Uses simple single-image video
- **Platform Differences**: Adapts TTS engine based on OS

### Professional Output

Videos are production-ready:

- High-quality 1080p or 4K resolution
- 30 or 60 FPS options
- H.264 encoding for wide compatibility
- AAC audio at 192kbps
- Clean scene transitions with crossfades

## Requirements

### System Dependencies

**Required:**
- Node.js 18+ (for TypeScript execution)
- FFmpeg 4.0+ (for video rendering)
- TSX (TypeScript execution engine)

**Text-to-Speech (choose one):**
- macOS: `say` command (built-in)
- Linux: `espeak` or `festival`
  ```bash
  sudo apt-get install espeak
  # or
  sudo apt-get install festival festvox-kallpc16k
  ```

### Installation

1. Install FFmpeg:
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt-get install ffmpeg
   
   # Windows (with Chocolatey)
   choco install ffmpeg
   ```

2. Install Node dependencies (already in project):
   ```bash
   npm install
   ```

3. Verify installation:
   ```bash
   ffmpeg -version
   tsx --version
   ```

## Usage

### Quick Start

Generate videos from the default script:

```bash
./scripts/video-production/generate-videos.sh
```

This will:
- Process `docs/video-portfolio/EXECUTIVE_VIDEO_SCRIPT.md`
- Output to `video-output/` directory
- Generate narration audio, visuals, and final MP4

### Custom Configuration

Use command-line options:

```bash
./scripts/video-production/generate-videos.sh \
  --script-dir docs/video-portfolio \
  --pattern "*.md" \
  --output-dir /path/to/output \
  --resolution 3840x2160 \
  --fps 60 \
  --demo-url https://example.com/demo
```

### Environment Variables

For advanced control, set environment variables:

```bash
export REPO_ROOT=/path/to/repo
export SCRIPT_DIR=docs/video-portfolio
export SCRIPT_PATTERN="EXECUTIVE_VIDEO_SCRIPT.md"
export VIDEO_OUT_DIR=/path/to/output
export DEMO_URL=https://example.com/demo
export VIDEO_RESOLUTION=1920x1080
export FPS=30
export VOICE_MODE=local_tts
export HEADLESS=true

tsx scripts/video-production/video-generator.ts
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--script-dir <dir>` | Directory containing scripts | `docs/video-portfolio` |
| `--pattern <pattern>` | Glob pattern for scripts | `EXECUTIVE_VIDEO_SCRIPT.md` |
| `--output-dir <dir>` | Output directory for videos | `video-output` |
| `--demo-url <url>` | URL for demo capture | None |
| `--resolution <res>` | Video resolution (WxH) | `1920x1080` |
| `--fps <fps>` | Frames per second | `30` |
| `--help` | Show help message | - |

## Script Format

### Required Structure

Scripts must be markdown files with this structure:

```markdown
# Video Title

## 1. SCENE NAME (0:00 - 0:30)

### Voiceover:
*"This is the narration text that will be spoken."*

[PAUSE]

*"More narration after a pause."*

### Visual Plan:
- Description of what should appear on screen
- Can include ON SCREEN or TEXT OVERLAY notes

## 2. NEXT SCENE (0:30 - 1:00)

### Voiceover:
*"Next scene narration..."*
```

### Scene Detection

The agent detects scenes using:
- H2 headings (`##`) as major scene boundaries
- H3 `### Voiceover:` sections for narration extraction
- Text between `*"..."*` as spoken content
- `[PAUSE]` markers for timing

### Visual Type Inference

Based on scene headings:
- **Title cards**: Hook, CTA, Why Me sections
- **Diagrams**: Solution, Architecture, Layer descriptions
- **Demo**: Dashboard, Demo sections (requires `--demo-url`)
- **Metrics**: Impact, Results, Metrics sections

## Output Structure

After execution, the output directory contains:

```
video-output/
├── EXECUTIVE_VIDEO_SCRIPT.mp4          # Final rendered video
├── audio/
│   └── EXECUTIVE_VIDEO_SCRIPT-narration.mp3
├── visuals/
│   ├── scene-0-title.png
│   ├── scene-1-diagram.png
│   └── ...
├── timelines/
│   └── EXECUTIVE_VIDEO_SCRIPT-timeline.json
└── render-report.json                  # Detailed execution log
```

### Render Report

The `render-report.json` includes:
- Timestamp and configuration
- Per-script results with success/failure status
- Fallbacks used during generation
- Errors encountered
- Execution duration

Example:

```json
{
  "timestamp": "2024-12-23T00:00:00.000Z",
  "config": { ... },
  "results": [
    {
      "scriptFile": "EXECUTIVE_VIDEO_SCRIPT.md",
      "startTime": "2024-12-23T00:00:00.000Z",
      "endTime": "2024-12-23T00:05:30.000Z",
      "fallbacksUsed": ["tts_festival_fallback"],
      "outputPath": "/path/to/video-output/EXECUTIVE_VIDEO_SCRIPT.mp4",
      "errors": [],
      "success": true
    }
  ],
  "summary": {
    "total": 1,
    "successful": 1,
    "failed": 0
  }
}
```

## Customization

### Adding New Scripts

1. Create a markdown file in `docs/video-portfolio/`
2. Follow the required script format
3. Run the generator with `--pattern "*.md"` to process all scripts

### Custom Visual Generation

To add custom visual types:

1. Edit `video-generator.ts`
2. Modify `determineVisualType()` to recognize new types
3. Implement generation in `generateStaticVisual()`

### Different TTS Voices

**macOS:**
```bash
# List available voices
say -v ?

# Use specific voice
# Edit video-generator.ts line with 'say -v Samantha' to 'say -v <VoiceName>'
```

**Linux:**
```bash
# Adjust speaking rate in video-generator.ts
# Change '-s 150' to desired speed (100-300)
```

### Video Quality Settings

In `video-generator.ts`, modify FFmpeg parameters:

```typescript
// Higher quality (larger file)
`-c:v libx264 -preset slow -crf 18`

// Lower quality (smaller file)
`-c:v libx264 -preset fast -crf 28`

// Audio bitrate
`-c:a aac -b:a 256k`  // Higher quality
`-c:a aac -b:a 128k`  // Lower quality
```

## Troubleshooting

### TTS Not Working

**macOS:**
```bash
# Test 'say' command
say "Hello world"

# If not working, check System Preferences > Accessibility > Spoken Content
```

**Linux:**
```bash
# Test espeak
espeak "Hello world"

# Install if missing
sudo apt-get install espeak espeak-data

# Or use festival
echo "Hello world" | festival --tts
```

### FFmpeg Not Found

```bash
# Check installation
which ffmpeg

# Install if missing
brew install ffmpeg  # macOS
sudo apt-get install ffmpeg  # Linux
```

### Out of Memory

For large scripts:

```bash
# Reduce resolution
./generate-videos.sh --resolution 1280x720

# Or process one script at a time
./generate-videos.sh --pattern "SPECIFIC_SCRIPT.md"
```

### Slow Rendering

FFmpeg rendering is CPU-intensive. To speed up:

```bash
# Use faster preset (lower quality)
# Edit video-generator.ts: 'preset medium' → 'preset fast'

# Or reduce resolution/FPS
./generate-videos.sh --resolution 1280x720 --fps 24
```

## Architecture

### Component Flow

```
┌─────────────────┐
│  CLI Entry      │
│  generate-      │
│  videos.sh      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Video          │
│  Production     │
│  Agent          │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│ Script │ │ Config │
│ Parser │ │ Loader │
└───┬────┘ └───┬────┘
    │          │
    └────┬─────┘
         │
         ▼
┌─────────────────┐
│  Scene          │
│  Detector       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│  TTS   │ │ Visual │
│ Engine │ │  Gen   │
└───┬────┘ └───┬────┘
    │          │
    └────┬─────┘
         │
         ▼
┌─────────────────┐
│  Timeline       │
│  Builder        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  FFmpeg         │
│  Renderer       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MP4 Output     │
│  + Report       │
└─────────────────┘
```

### Key Design Decisions

1. **Local-First**: No cloud services required for privacy and cost
2. **Markdown-Based**: Uses standard format for easy authoring
3. **Graceful Degradation**: Multiple fallback mechanisms
4. **Deterministic Output**: Same script always produces same video
5. **Comprehensive Logging**: Full traceability for debugging

## Contributing

To extend the video production agent:

1. **Add New Visual Types**:
   - Modify `determineVisualType()` in `video-generator.ts`
   - Implement generation logic in `generateStaticVisual()`

2. **Improve TTS**:
   - Add new TTS engines in `generateTTSAudio()`
   - Implement voice selection or quality improvements

3. **Enhanced Demo Capture**:
   - Implement Puppeteer-based capture in `captureDemoFootage()`
   - Add interaction recording for complex demos

4. **Custom Transitions**:
   - Modify `buildFilterComplex()` for different transition styles
   - Add dissolves, wipes, or custom effects

## License

This video production agent is part of the public-record-data-scrapper repository.
See the main repository LICENSE file for details.

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review the render-report.json for detailed error information
3. Open an issue in the repository with logs and configuration

## Credits

Built using:
- [FFmpeg](https://ffmpeg.org/) - Video processing
- [espeak](http://espeak.sourceforge.net/) - Linux TTS
- macOS `say` - macOS TTS
- [TSX](https://github.com/esbuild-kit/tsx) - TypeScript execution
