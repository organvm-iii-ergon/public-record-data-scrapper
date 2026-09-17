#!/usr/bin/env bash
#
# Video Production Automation CLI
#
# This script provides a convenient way to run the autonomous video production agent
# with environment variable configuration.
#
# Usage:
#   ./generate-videos.sh [options]
#
# Options:
#   --script-dir <dir>        Directory containing scripts (default: docs/video-portfolio)
#   --pattern <pattern>       Script pattern to match (default: EXECUTIVE_VIDEO_SCRIPT.md)
#   --output-dir <dir>        Output directory (default: video-output)
#   --demo-url <url>          Optional demo URL for capture
#   --resolution <res>        Video resolution (default: 1920x1080)
#   --fps <fps>               Frames per second (default: 30)
#   --help                    Show this help message
#

set -e

# Default configuration
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="docs/video-portfolio"
SCRIPT_PATTERN="EXECUTIVE_VIDEO_SCRIPT.md"
VIDEO_OUT_DIR="${REPO_ROOT}/video-output"
DEMO_URL=""
VIDEO_RESOLUTION="1920x1080"
FPS="30"
VOICE_MODE="local_tts"
HEADLESS="true"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --script-dir)
      SCRIPT_DIR="$2"
      shift 2
      ;;
    --pattern)
      SCRIPT_PATTERN="$2"
      shift 2
      ;;
    --output-dir)
      VIDEO_OUT_DIR="$2"
      shift 2
      ;;
    --demo-url)
      DEMO_URL="$2"
      shift 2
      ;;
    --resolution)
      VIDEO_RESOLUTION="$2"
      shift 2
      ;;
    --fps)
      FPS="$2"
      shift 2
      ;;
    --help)
      sed -n '2,/^$/p' "$0" | sed 's/^# //' | sed 's/^#//'
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Check for required dependencies
echo "🔍 Checking dependencies..."

check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo "⚠️  Warning: $1 is not installed"
    echo "   The system will use fallback mechanisms where possible"
    return 1
  fi
  return 0
}

check_command ffmpeg

# Check for TTS engine
if [[ "$OSTYPE" == "darwin"* ]]; then
  check_command say
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  if ! command -v espeak &> /dev/null && ! command -v festival &> /dev/null; then
    echo "⚠️  Warning: No TTS engine found (espeak or festival recommended on Linux)"
    echo "   The system will generate silent audio as fallback"
  fi
fi

echo "✓ Core dependencies checked"
echo ""

# Export environment variables
export REPO_ROOT
export SCRIPT_DIR
export SCRIPT_PATTERN
export VIDEO_OUT_DIR
export DEMO_URL
export VIDEO_RESOLUTION
export FPS
export VOICE_MODE
export HEADLESS

# Print configuration
echo "📋 Configuration:"
echo "   Repository: $REPO_ROOT"
echo "   Script Directory: $SCRIPT_DIR"
echo "   Script Pattern: $SCRIPT_PATTERN"
echo "   Output Directory: $VIDEO_OUT_DIR"
echo "   Resolution: $VIDEO_RESOLUTION"
echo "   FPS: $FPS"
if [[ -n "$DEMO_URL" ]]; then
  echo "   Demo URL: $DEMO_URL"
fi
echo ""

# Run the video production agent
cd "$REPO_ROOT"
npx tsx scripts/video-production/video-generator.ts
