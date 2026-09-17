#!/usr/bin/env tsx
/**
 * Autonomous Video Production Agent
 *
 * Generates finished MP4 videos from repository-provided scripts using
 * a fully automated, local-first workflow.
 *
 * Environment Variables:
 * - REPO_ROOT: Absolute path to repository
 * - SCRIPT_DIR: Path containing finalized scripts
 * - SCRIPT_PATTERN: Pattern to match scripts (e.g., *.md)
 * - DEMO_URL: Optional deployed app URL
 * - VIDEO_OUT_DIR: Output directory for videos
 * - VOICE_MODE: TTS mode (local_tts)
 * - VIDEO_RESOLUTION: Resolution (default: 1920x1080)
 * - FPS: Frames per second (default: 30)
 * - HEADLESS: Browser headless mode (default: true)
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

// Constants
const WORDS_PER_MINUTE = 150
const DEFAULT_CROSSFADE_DURATION = 0.5 // seconds

interface Config {
  repoRoot: string
  scriptDir: string
  scriptPattern: string
  demoUrl?: string
  videoOutDir: string
  voiceMode: string
  videoResolution: string
  fps: number
  headless: boolean
}

interface ScriptMetadata {
  filePath: string
  fileName: string
  content: string
  scenes: SceneInfo[]
  duration: number
}

interface SceneInfo {
  index: number
  heading: string
  content: string
  startTime: number
  endTime: number
  visualType: 'title' | 'diagram' | 'demo' | 'metrics'
}

interface RenderLog {
  scriptFile: string
  startTime: Date
  endTime?: Date
  fallbacksUsed: string[]
  outputPath?: string
  errors: string[]
  success: boolean
}

interface TimelineScene {
  index: number
  startTime: number
  endTime: number
  visual: string
  heading: string
}

interface Timeline {
  audio: string
  scenes: TimelineScene[]
}

/**
 * Escape string for safe use in shell commands
 */
function escapeShellArg(arg: string): string {
  return arg.replace(/'/g, "'\\''")
}

/**
 * Convert glob pattern to regex
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`)
}

class VideoProductionAgent {
  private config: Config
  private logs: RenderLog[] = []

  constructor(config: Config) {
    this.config = config
  }

  /**
   * Main execution entry point
   */
  async execute(): Promise<void> {
    console.log('🎬 Starting Autonomous Video Production Agent')
    console.log(`📂 Script Directory: ${this.config.scriptDir}`)
    console.log(`📹 Output Directory: ${this.config.videoOutDir}`)
    console.log()

    try {
      // Step 1: Scan for scripts
      const scripts = await this.scanScripts()
      console.log(`✓ Found ${scripts.length} script(s) to process\n`)

      // Step 2: Process each script
      for (const scriptPath of scripts) {
        await this.processScript(scriptPath)
      }

      // Step 3: Generate summary report
      await this.generateSummaryReport()

      console.log('\n✅ Video production complete!')
    } catch (error) {
      console.error('❌ Fatal error in video production:', error)
      process.exit(1)
    }
  }

  /**
   * Step 1: Scan script directory for matching files
   */
  private async scanScripts(): Promise<string[]> {
    console.log('📋 Step 1: Scanning for scripts...')

    const scriptDir = path.resolve(this.config.repoRoot, this.config.scriptDir)

    try {
      const files = await fs.readdir(scriptDir)
      const regex = globToRegex(this.config.scriptPattern)

      const matchingFiles = files
        .filter((file) => regex.test(file))
        .map((file) => path.join(scriptDir, file))

      return matchingFiles
    } catch (error) {
      console.error(`Error scanning directory ${scriptDir}:`, error)
      return []
    }
  }

  /**
   * Process a single script through the entire pipeline
   */
  private async processScript(scriptPath: string): Promise<void> {
    const fileName = path.basename(scriptPath)
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎥 Processing: ${fileName}`)
    console.log(`${'='.repeat(60)}\n`)

    const log: RenderLog = {
      scriptFile: fileName,
      startTime: new Date(),
      fallbacksUsed: [],
      errors: [],
      success: false
    }

    try {
      // Step 2: Parse script and detect scenes
      const metadata = await this.parseScript(scriptPath)
      console.log(`✓ Parsed script: ${metadata.scenes.length} scenes detected\n`)

      // Step 3: Generate narration audio
      const audioPath = await this.generateNarration(metadata, log)
      console.log(`✓ Generated narration audio: ${audioPath}\n`)

      // Step 4: Generate visual footage
      const visualPaths = await this.generateVisuals(metadata, log)
      console.log(`✓ Generated ${visualPaths.length} visual assets\n`)

      // Step 5: Synchronize audio and visuals
      const timelinePath = await this.createTimeline(metadata, audioPath, visualPaths)
      console.log(`✓ Created synchronized timeline\n`)

      // Step 6: Render final video
      const outputPath = await this.renderVideo(metadata, timelinePath, log)
      console.log(`✓ Rendered final video: ${outputPath}\n`)

      log.success = true
      log.outputPath = outputPath
      log.endTime = new Date()
    } catch (error) {
      log.errors.push(String(error))
      log.endTime = new Date()
      console.error(`❌ Failed to process ${fileName}:`, error)
    }

    this.logs.push(log)
  }

  /**
   * Step 2: Parse script structure and detect scene boundaries
   */
  private async parseScript(scriptPath: string): Promise<ScriptMetadata> {
    console.log('📝 Step 2: Parsing script structure...')

    const content = await fs.readFile(scriptPath, 'utf-8')
    const fileName = path.basename(scriptPath)

    // Detect scenes based on markdown headings
    const scenes = this.detectSceneBoundaries(content)

    // Calculate approximate duration
    const wordCount = content.split(/\s+/).length
    const duration = Math.ceil((wordCount / WORDS_PER_MINUTE) * 60) // seconds

    return {
      filePath: scriptPath,
      fileName,
      content,
      scenes,
      duration
    }
  }

  /**
   * Detect scene boundaries from markdown structure
   */
  private detectSceneBoundaries(content: string): SceneInfo[] {
    const scenes: SceneInfo[] = []
    const lines = content.split('\n')

    let currentScene: Partial<SceneInfo> | null = null
    let currentContent: string[] = []
    let sceneIndex = 0
    let currentTime = 0

    for (const line of lines) {
      // Detect H2 headings or H3 Voiceover sections as scene markers
      const h2Match = line.match(/^##\s+(.+)/)
      const h3VoiceoverMatch = line.match(/^###\s+Voiceover:/)

      if (h2Match || h3VoiceoverMatch) {
        // Save previous scene if exists
        if (currentScene) {
          const text = currentContent.join('\n')
          const wordCount = text.split(/\s+/).length
          const duration = (wordCount / WORDS_PER_MINUTE) * 60 // seconds

          currentScene.content = text
          currentScene.startTime = currentTime
          currentScene.endTime = currentTime + duration
          scenes.push(currentScene as SceneInfo)

          currentTime += duration
        }

        // Start new scene
        const heading = h2Match ? h2Match[1] : 'Voiceover'
        currentScene = {
          index: sceneIndex++,
          heading,
          visualType: this.determineVisualType(heading)
        }
        currentContent = []
      } else if (currentScene && line.trim() && !line.startsWith('#')) {
        // Add content to current scene (only narration text)
        if (line.startsWith('*"') || line.includes('Voiceover:')) {
          currentContent.push(line)
        }
      }
    }

    // Save final scene
    if (currentScene) {
      const text = currentContent.join('\n')
      const wordCount = text.split(/\s+/).length
      const duration = (wordCount / WORDS_PER_MINUTE) * 60

      currentScene.content = text
      currentScene.startTime = currentTime
      currentScene.endTime = currentTime + duration
      scenes.push(currentScene as SceneInfo)
    }

    return scenes.filter((s) => s.content && s.content.trim().length > 0)
  }

  /**
   * Determine visual type from heading
   */
  private determineVisualType(heading: string): 'title' | 'diagram' | 'demo' | 'metrics' {
    const lower = heading.toLowerCase()

    if (lower.includes('hook') || lower.includes('cta') || lower.includes('why')) {
      return 'title'
    } else if (
      lower.includes('solution') ||
      lower.includes('architecture') ||
      lower.includes('layer')
    ) {
      return 'diagram'
    } else if (lower.includes('demo') || lower.includes('dashboard')) {
      return 'demo'
    } else if (lower.includes('impact') || lower.includes('metrics') || lower.includes('results')) {
      return 'metrics'
    }

    return 'title'
  }

  /**
   * Step 3: Generate narration audio using local TTS
   */
  private async generateNarration(metadata: ScriptMetadata, log: RenderLog): Promise<string> {
    console.log('🎙️  Step 3: Generating narration audio...')

    const audioDir = path.join(this.config.videoOutDir, 'audio')
    await fs.mkdir(audioDir, { recursive: true })

    const outputFileName = metadata.fileName.replace(/\.(md|txt)$/, '-narration.mp3')
    const outputPath = path.join(audioDir, outputFileName)

    try {
      // Extract clean narration text (remove markdown formatting)
      const narrationText = this.extractNarrationText(metadata.content)

      // Use say command (macOS) or espeak (Linux) for local TTS
      await this.generateTTSAudio(narrationText, outputPath, log)

      return outputPath
    } catch (error) {
      log.errors.push(`TTS generation failed: ${error}`)

      // Retry with smaller chunks
      try {
        console.log('⚠️  Retrying with chunked audio generation...')
        log.fallbacksUsed.push('chunked_audio_generation')

        const chunks = this.chunkText(this.extractNarrationText(metadata.content), 500)
        const chunkPaths: string[] = []

        for (let i = 0; i < chunks.length; i++) {
          const chunkPath = outputPath.replace('.mp3', `-chunk${i}.mp3`)
          await this.generateTTSAudio(chunks[i], chunkPath, log)
          chunkPaths.push(chunkPath)
        }

        // Concatenate audio chunks
        await this.concatenateAudio(chunkPaths, outputPath)

        return outputPath
      } catch (retryError) {
        log.errors.push(`TTS retry failed: ${retryError}`)
        throw new Error('Failed to generate narration audio')
      }
    }
  }

  /**
   * Extract narration text from markdown content
   */
  private extractNarrationText(content: string): string {
    const lines = content.split('\n')
    const narrationLines: string[] = []

    for (const line of lines) {
      // Extract text between asterisks (voiceover sections)
      const match = line.match(/^\*"(.+?)"\*?$/)
      if (match) {
        const cleanLine = match[1]
          .replace(/\[PAUSE\]/g, '... ')
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .trim()

        if (cleanLine) {
          narrationLines.push(cleanLine)
        }
      }
    }

    return narrationLines.join(' ')
  }

  /**
   * Generate TTS audio file
   */
  private async generateTTSAudio(text: string, outputPath: string, log: RenderLog): Promise<void> {
    // Try different TTS engines based on platform
    const platform = process.platform

    // Sanitize text for shell safety
    const safeText = escapeShellArg(text)
    const safeOutputPath = escapeShellArg(outputPath)

    try {
      if (platform === 'darwin') {
        // macOS: use 'say' command
        const tempPath = outputPath.replace('.mp3', '.aiff')
        const safeTempPath = escapeShellArg(tempPath)
        execSync(`say -v Samantha -o '${safeTempPath}' '${safeText}'`)
        // Convert to mp3
        execSync(`ffmpeg -i '${safeTempPath}' -acodec libmp3lame -y '${safeOutputPath}'`)
        await fs.unlink(tempPath)
      } else if (platform === 'linux') {
        // Linux: use espeak
        try {
          const tempPath = outputPath.replace('.mp3', '.wav')
          const safeTempPath = escapeShellArg(tempPath)
          execSync(`espeak -v en-us -s 150 -w '${safeTempPath}' '${safeText}'`)
          execSync(`ffmpeg -i '${safeTempPath}' -acodec libmp3lame -y '${safeOutputPath}'`)
          await fs.unlink(tempPath)
        } catch {
          // Fallback to festival
          log.fallbacksUsed.push('tts_festival_fallback')
          const tempFile = outputPath.replace('.mp3', '.txt')
          await fs.writeFile(tempFile, text)
          const tempPath = outputPath.replace('.mp3', '.wav')
          const safeTempFile = escapeShellArg(tempFile)
          const safeTempPath = escapeShellArg(tempPath)
          execSync(`text2wave '${safeTempFile}' -o '${safeTempPath}'`)
          execSync(`ffmpeg -i '${safeTempPath}' -acodec libmp3lame -y '${safeOutputPath}'`)
          await fs.unlink(tempFile)
          await fs.unlink(tempPath)
        }
      } else {
        throw new Error('Unsupported platform for TTS')
      }
    } catch {
      log.fallbacksUsed.push('silent_audio_fallback')
      // Generate silent audio as last resort
      const duration = Math.ceil((text.split(/\s+/).length / WORDS_PER_MINUTE) * 60)
      execSync(`ffmpeg -f lavfi -i anullsrc=r=48000:cl=mono -t ${duration} -y '${safeOutputPath}'`)
    }
  }

  /**
   * Chunk text into smaller pieces
   */
  private chunkText(text: string, maxWords: number): string[] {
    const words = text.split(/\s+/)
    const chunks: string[] = []

    for (let i = 0; i < words.length; i += maxWords) {
      chunks.push(words.slice(i, i + maxWords).join(' '))
    }

    return chunks
  }

  /**
   * Concatenate multiple audio files
   */
  private async concatenateAudio(inputPaths: string[], outputPath: string): Promise<void> {
    const listFile = outputPath.replace('.mp3', '-list.txt')
    const listContent = inputPaths.map((p) => `file '${p}'`).join('\n')
    await fs.writeFile(listFile, listContent)

    execSync(`ffmpeg -f concat -safe 0 -i "${listFile}" -c copy -y "${outputPath}"`)

    // Clean up
    await fs.unlink(listFile)
    for (const filePath of inputPaths) {
      await fs.unlink(filePath)
    }
  }

  /**
   * Step 4: Generate visual footage
   */
  private async generateVisuals(metadata: ScriptMetadata, log: RenderLog): Promise<string[]> {
    console.log('🎨 Step 4: Generating visual assets...')

    const visualDir = path.join(this.config.videoOutDir, 'visuals')
    await fs.mkdir(visualDir, { recursive: true })

    const visualPaths: string[] = []

    for (const scene of metadata.scenes) {
      try {
        let visualPath: string

        if (scene.visualType === 'demo' && this.config.demoUrl) {
          // Try to capture demo
          visualPath = await this.captureDemoFootage(scene, visualDir, log)
        } else {
          // Generate static visual
          visualPath = await this.generateStaticVisual(scene, visualDir)
        }

        visualPaths.push(visualPath)
      } catch (error) {
        log.errors.push(`Visual generation failed for scene ${scene.index}: ${error}`)
        log.fallbacksUsed.push(`static_visual_scene_${scene.index}`)

        // Fallback to simple title card
        const fallbackPath = await this.generateTitleCard(scene, visualDir)
        visualPaths.push(fallbackPath)
      }
    }

    return visualPaths
  }

  /**
   * Capture demo footage using browser automation
   */
  private async captureDemoFootage(
    scene: SceneInfo,
    outputDir: string,
    log: RenderLog
  ): Promise<string> {
    console.log(`  📹 Capturing demo footage for scene ${scene.index}...`)

    // This would use puppeteer to capture the demo
    // For now, fall back to static visual
    log.fallbacksUsed.push(`demo_capture_unavailable_scene_${scene.index}`)
    return this.generateStaticVisual(scene, outputDir)
  }

  /**
   * Generate static visual (diagram, chart, or title card)
   */
  private async generateStaticVisual(scene: SceneInfo, outputDir: string): Promise<string> {
    console.log(`  🎨 Generating static visual for scene ${scene.index}...`)

    const outputPath = path.join(outputDir, `scene-${scene.index}-${scene.visualType}.png`)

    // Generate based on visual type
    switch (scene.visualType) {
      case 'diagram':
        await this.generateDiagram(scene, outputPath)
        break
      case 'metrics':
        await this.generateMetricsCard(scene, outputPath)
        break
      default:
        await this.generateTitleCard(scene, outputPath)
    }

    return outputPath
  }

  /**
   * Generate a title card
   */
  private async generateTitleCard(scene: SceneInfo, outputPath: string): Promise<string> {
    const [width, height] = this.config.videoResolution.split('x').map(Number)

    // Use FFmpeg to generate title card with safe escaping
    const title = scene.heading.replace(/[^\w\s]/g, '').substring(0, 50)
    const safeTitle = escapeShellArg(title)
    const safeOutputPath = escapeShellArg(outputPath)

    const cmd =
      `ffmpeg -f lavfi -i color=c=0x1e2b5c:s=${width}x${height}:d=1 ` +
      `-vf "drawtext=text='${safeTitle}':fontcolor=white:fontsize=72:` +
      `x=(w-text_w)/2:y=(h-text_h)/2" ` +
      `-frames:v 1 -y '${safeOutputPath}'`

    try {
      execSync(cmd, { stdio: 'pipe' })
    } catch {
      // Fallback to solid color without text
      execSync(
        `ffmpeg -f lavfi -i color=c=0x1e2b5c:s=${width}x${height}:d=1 -frames:v 1 -y '${safeOutputPath}'`,
        { stdio: 'pipe' }
      )
    }

    return outputPath
  }

  /**
   * Generate a diagram
   */
  private async generateDiagram(scene: SceneInfo, outputPath: string): Promise<string> {
    // For now, generate a title card with diagram label
    return this.generateTitleCard(scene, outputPath)
  }

  /**
   * Generate a metrics card
   */
  private async generateMetricsCard(scene: SceneInfo, outputPath: string): Promise<string> {
    // For now, generate a title card with metrics label
    return this.generateTitleCard(scene, outputPath)
  }

  /**
   * Step 5: Create synchronized timeline
   */
  private async createTimeline(
    metadata: ScriptMetadata,
    audioPath: string,
    visualPaths: string[]
  ): Promise<string> {
    console.log('⏱️  Step 5: Creating synchronized timeline...')

    const timelineDir = path.join(this.config.videoOutDir, 'timelines')
    await fs.mkdir(timelineDir, { recursive: true })

    const timelinePath = path.join(
      timelineDir,
      metadata.fileName.replace(/\.(md|txt)$/, '-timeline.json')
    )

    const timeline = {
      audio: audioPath,
      scenes: metadata.scenes.map((scene, i) => ({
        index: scene.index,
        startTime: scene.startTime,
        endTime: scene.endTime,
        visual: visualPaths[i] || visualPaths[0],
        heading: scene.heading
      }))
    }

    await fs.writeFile(timelinePath, JSON.stringify(timeline, null, 2))

    return timelinePath
  }

  /**
   * Step 6: Render final video using FFmpeg
   */
  private async renderVideo(
    metadata: ScriptMetadata,
    timelinePath: string,
    log: RenderLog
  ): Promise<string> {
    console.log('🎬 Step 6: Rendering final video...')

    const timeline: Timeline = JSON.parse(await fs.readFile(timelinePath, 'utf-8'))
    const outputFileName = metadata.fileName.replace(/\.(md|txt)$/, '.mp4')
    const outputPath = path.join(this.config.videoOutDir, outputFileName)

    try {
      // Build FFmpeg filter complex for scene transitions
      const filterComplex = this.buildFilterComplex(timeline, this.config.fps)

      // Create FFmpeg command with safe escaping
      const inputs = [timeline.audio, ...timeline.scenes.map((s) => s.visual)]
      const inputArgs = inputs.map((i) => `-i '${escapeShellArg(i)}'`).join(' ')

      const [width, height] = this.config.videoResolution.split('x').map(Number)
      const safeOutputPath = escapeShellArg(outputPath)

      const cmd =
        `ffmpeg ${inputArgs} ` +
        `-filter_complex '${filterComplex}' ` +
        `-map "[outv]" -map 0:a ` +
        `-c:v libx264 -preset medium -crf 23 ` +
        `-c:a aac -b:a 192k ` +
        `-r ${this.config.fps} ` +
        `-s ${width}x${height} ` +
        `-y '${safeOutputPath}'`

      console.log('  Executing FFmpeg render (this may take a while)...')
      // Note: Large maxBuffer for video rendering. For very large videos, consider streaming approach
      execSync(cmd, { stdio: 'inherit', maxBuffer: 1024 * 1024 * 100 })

      return outputPath
    } catch (error) {
      log.errors.push(`Video rendering failed: ${error}`)

      // Try simpler fallback - just audio with single image
      try {
        console.log('⚠️  Falling back to simple video with single image...')
        log.fallbacksUsed.push('simple_video_fallback')

        const firstVisual = timeline.scenes[0].visual
        const safeFirstVisual = escapeShellArg(firstVisual)
        const safeAudio = escapeShellArg(timeline.audio)
        const safeOutputPath = escapeShellArg(outputPath)

        const cmd =
          `ffmpeg -loop 1 -i '${safeFirstVisual}' -i '${safeAudio}' ` +
          `-c:v libx264 -tune stillimage -c:a aac -b:a 192k ` +
          `-shortest -pix_fmt yuv420p -y '${safeOutputPath}'`

        execSync(cmd, { stdio: 'inherit' })
        return outputPath
      } catch (fallbackError) {
        log.errors.push(`Fallback rendering failed: ${fallbackError}`)
        throw error
      }
    }
  }

  /**
   * Build FFmpeg filter complex for scene transitions
   */
  private buildFilterComplex(timeline: Timeline, fps: number): string {
    const filters: string[] = []

    // Scale and pad each input image
    timeline.scenes.forEach((scene, i) => {
      const inputIndex = i + 1 // +1 because 0 is audio
      filters.push(
        `[${inputIndex}:v]scale=1920:1080:force_original_aspect_ratio=decrease,` +
          `pad=1920:1080:(ow-iw)/2:(oh-ih)/2,` +
          `setsar=1,fps=${fps}[v${i}]`
      )
    })

    // Concatenate scenes with crossfade
    if (timeline.scenes.length === 1) {
      filters.push(`[v0]null[outv]`)
    } else {
      let currentLabel = 'v0'

      for (let i = 1; i < timeline.scenes.length; i++) {
        const duration = timeline.scenes[i].startTime - timeline.scenes[i - 1].startTime
        const offset = Math.max(0, duration - DEFAULT_CROSSFADE_DURATION)

        const nextLabel = i === timeline.scenes.length - 1 ? 'outv' : `t${i}`
        filters.push(
          `[${currentLabel}][v${i}]xfade=transition=fade:duration=${DEFAULT_CROSSFADE_DURATION}:offset=${offset}[${nextLabel}]`
        )
        currentLabel = nextLabel
      }
    }

    return filters.join(';')
  }

  /**
   * Step 7: Generate summary report
   */
  private async generateSummaryReport(): Promise<void> {
    console.log('\n📊 Generating summary report...')

    const reportPath = path.join(this.config.videoOutDir, 'render-report.json')
    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      results: this.logs,
      summary: {
        total: this.logs.length,
        successful: this.logs.filter((l) => l.success).length,
        failed: this.logs.filter((l) => !l.success).length
      }
    }

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))

    console.log(`✓ Report saved to: ${reportPath}`)
    console.log(`\n📈 Summary:`)
    console.log(`   Total scripts: ${report.summary.total}`)
    console.log(`   Successful: ${report.summary.successful}`)
    console.log(`   Failed: ${report.summary.failed}`)

    // Print individual logs
    this.logs.forEach((log) => {
      console.log(`\n   ${log.scriptFile}:`)
      console.log(`     Status: ${log.success ? '✅ Success' : '❌ Failed'}`)
      if (log.outputPath) {
        console.log(`     Output: ${log.outputPath}`)
      }
      if (log.fallbacksUsed.length > 0) {
        console.log(`     Fallbacks: ${log.fallbacksUsed.join(', ')}`)
      }
      if (log.errors.length > 0) {
        console.log(`     Errors: ${log.errors.join('; ')}`)
      }
      const duration =
        log.endTime && log.startTime
          ? ((log.endTime.getTime() - log.startTime.getTime()) / 1000).toFixed(1)
          : 'N/A'
      console.log(`     Duration: ${duration}s`)
    })
  }
}

/**
 * Load configuration from environment variables
 */
function loadConfig(): Config {
  const repoRoot = process.env.REPO_ROOT || process.cwd()
  const scriptDir = process.env.SCRIPT_DIR || 'docs/video-portfolio'
  const scriptPattern = process.env.SCRIPT_PATTERN || 'EXECUTIVE_VIDEO_SCRIPT.md'
  const demoUrl = process.env.DEMO_URL
  const videoOutDir = process.env.VIDEO_OUT_DIR || path.join(repoRoot, 'video-output')
  const voiceMode = process.env.VOICE_MODE || 'local_tts'
  const videoResolution = process.env.VIDEO_RESOLUTION || '1920x1080'
  const fps = parseInt(process.env.FPS || '30', 10)
  const headless = process.env.HEADLESS !== 'false'

  return {
    repoRoot,
    scriptDir,
    scriptPattern,
    demoUrl,
    videoOutDir,
    voiceMode,
    videoResolution,
    fps,
    headless
  }
}

/**
 * Main entry point
 */
async function main() {
  const config = loadConfig()
  const agent = new VideoProductionAgent(config)

  try {
    await agent.execute()
    process.exit(0)
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { VideoProductionAgent, loadConfig }
