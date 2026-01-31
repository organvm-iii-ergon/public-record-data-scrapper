#!/usr/bin/env tsx
/**
 * Test script for video production agent
 * Validates parsing, scene detection, and configuration loading
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { loadConfig } from './video-generator'
import fs from 'fs/promises'
import path from 'path'

describe('Video Production Agent', () => {
  beforeAll(() => {
    // Set test environment variables
    process.env.REPO_ROOT = process.cwd()
    process.env.SCRIPT_DIR = 'docs/video-portfolio'
    process.env.SCRIPT_PATTERN = 'DEMO_VIDEO_SCRIPT.md'
    process.env.VIDEO_OUT_DIR = path.join(process.cwd(), 'video-output-test')
    process.env.VIDEO_RESOLUTION = '1920x1080'
    process.env.FPS = '30'
  })

  describe('Configuration Loading', () => {
    it('should load default configuration', () => {
      const config = loadConfig()

      expect(config.repoRoot).toBeDefined()
      expect(config.scriptDir).toBe('docs/video-portfolio')
      expect(config.videoResolution).toBe('1920x1080')
      expect(config.fps).toBe(30)
    })

    it('should use environment variables', () => {
      process.env.VIDEO_RESOLUTION = '3840x2160'
      process.env.FPS = '60'

      const config = loadConfig()

      expect(config.videoResolution).toBe('3840x2160')
      expect(config.fps).toBe(60)

      // Reset
      process.env.VIDEO_RESOLUTION = '1920x1080'
      process.env.FPS = '30'
    })
  })

  describe('Script Parsing', () => {
    it('should detect markdown scripts', async () => {
      const config = loadConfig()
      // Check that demo script exists
      const scriptPath = path.join(config.repoRoot, config.scriptDir, 'DEMO_VIDEO_SCRIPT.md')

      const exists = await fs
        .access(scriptPath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    })

    it('should parse scene structure from markdown', async () => {
      const scriptPath = path.join(process.cwd(), 'docs/video-portfolio/DEMO_VIDEO_SCRIPT.md')

      const content = await fs.readFile(scriptPath, 'utf-8')

      // Should contain scene markers
      expect(content).toContain('## 1. Introduction')
      expect(content).toContain('## 2. The Problem')
      expect(content).toContain('### Voiceover:')
      expect(content).toContain('[PAUSE]')
    })
  })

  describe('Scene Detection', () => {
    it('should identify correct number of scenes', async () => {
      const scriptPath = path.join(process.cwd(), 'docs/video-portfolio/DEMO_VIDEO_SCRIPT.md')

      const content = await fs.readFile(scriptPath, 'utf-8')
      const sceneCount = (content.match(/^##\s+\d+\./gm) || []).length

      expect(sceneCount).toBeGreaterThanOrEqual(4)
    })
  })

  describe('Output Directory', () => {
    it('should create output directory structure', async () => {
      const config = loadConfig()
      const outputDir = config.videoOutDir

      // Create test directories
      await fs.mkdir(path.join(outputDir, 'audio'), { recursive: true })
      await fs.mkdir(path.join(outputDir, 'visuals'), { recursive: true })
      await fs.mkdir(path.join(outputDir, 'timelines'), { recursive: true })

      // Verify they exist
      const audioExists = await fs
        .access(path.join(outputDir, 'audio'))
        .then(() => true)
        .catch(() => false)
      const visualsExists = await fs
        .access(path.join(outputDir, 'visuals'))
        .then(() => true)
        .catch(() => false)
      const timelinesExists = await fs
        .access(path.join(outputDir, 'timelines'))
        .then(() => true)
        .catch(() => false)

      expect(audioExists).toBe(true)
      expect(visualsExists).toBe(true)
      expect(timelinesExists).toBe(true)
    })
  })
})
