#!/usr/bin/env tsx
/**
 * Validation script for video production agent
 * Tests basic functionality without requiring full test infrastructure
 */

import fs from 'fs/promises';
import path from 'path';
import { loadConfig } from './video-generator';

async function validate() {
  console.log('🔍 Validating Video Production Agent Setup...\n');
  
  let allPassed = true;
  
  // Test 1: Configuration loading
  console.log('✓ Test 1: Configuration Loading');
  try {
    const config = loadConfig();
    console.log(`  Repository: ${config.repoRoot}`);
    console.log(`  Script Dir: ${config.scriptDir}`);
    console.log(`  Resolution: ${config.videoResolution}`);
    console.log(`  FPS: ${config.fps}`);
    console.log('  ✅ Configuration loaded successfully\n');
  } catch (error) {
    console.log(`  ❌ Configuration loading failed: ${error}\n`);
    allPassed = false;
  }
  
  // Test 2: Script directory exists
  console.log('✓ Test 2: Script Directory');
  try {
    const config = loadConfig();
    const scriptDir = path.join(config.repoRoot, config.scriptDir);
    await fs.access(scriptDir);
    const files = await fs.readdir(scriptDir);
    console.log(`  Found ${files.length} files in ${scriptDir}`);
    console.log('  ✅ Script directory accessible\n');
  } catch (error) {
    console.log(`  ❌ Script directory not accessible: ${error}\n`);
    allPassed = false;
  }
  
  // Test 3: Demo script exists
  console.log('✓ Test 3: Demo Script');
  try {
    const config = loadConfig();
    const demoPath = path.join(config.repoRoot, config.scriptDir, 'DEMO_VIDEO_SCRIPT.md');
    await fs.access(demoPath);
    const content = await fs.readFile(demoPath, 'utf-8');
    const sceneCount = (content.match(/^##\s+\d+\./gm) || []).length;
    console.log(`  Found demo script with ${sceneCount} scenes`);
    console.log('  ✅ Demo script validated\n');
  } catch (error) {
    console.log(`  ❌ Demo script not found: ${error}\n`);
    allPassed = false;
  }
  
  // Test 4: Executive script exists
  console.log('✓ Test 4: Executive Script');
  try {
    const config = loadConfig();
    const execPath = path.join(config.repoRoot, config.scriptDir, 'EXECUTIVE_VIDEO_SCRIPT.md');
    await fs.access(execPath);
    const content = await fs.readFile(execPath, 'utf-8');
    const sceneCount = (content.match(/^##\s+\d+\./gm) || []).length;
    const voiceoverCount = (content.match(/### Voiceover:/g) || []).length;
    console.log(`  Found executive script with ${sceneCount} major sections`);
    console.log(`  Contains ${voiceoverCount} voiceover sections`);
    console.log('  ✅ Executive script validated\n');
  } catch (error) {
    console.log(`  ❌ Executive script not found: ${error}\n`);
    allPassed = false;
  }
  
  // Test 5: Output directory can be created
  console.log('✓ Test 5: Output Directory');
  try {
    const config = loadConfig();
    const testDir = path.join(config.videoOutDir, 'test');
    await fs.mkdir(testDir, { recursive: true });
    await fs.rmdir(testDir);
    console.log(`  Can create directories in ${config.videoOutDir}`);
    console.log('  ✅ Output directory writable\n');
  } catch (error) {
    console.log(`  ❌ Cannot create output directory: ${error}\n`);
    allPassed = false;
  }
  
  // Test 6: Check for FFmpeg (optional)
  console.log('✓ Test 6: FFmpeg Availability (optional)');
  try {
    const { execSync } = await import('child_process');
    execSync('ffmpeg -version', { stdio: 'pipe' });
    console.log('  ✅ FFmpeg is available\n');
  } catch (error) {
    console.log('  ⚠️  FFmpeg not found - videos will use fallback rendering\n');
  }
  
  // Test 7: Check for TTS (optional)
  console.log('✓ Test 7: TTS Engine Availability (optional)');
  try {
    const { execSync } = await import('child_process');
    if (process.platform === 'darwin') {
      execSync('which say', { stdio: 'pipe' });
      console.log('  ✅ macOS "say" command is available\n');
    } else if (process.platform === 'linux') {
      try {
        execSync('which espeak', { stdio: 'pipe' });
        console.log('  ✅ Linux "espeak" is available\n');
      } catch {
        try {
          execSync('which festival', { stdio: 'pipe' });
          console.log('  ✅ Linux "festival" is available\n');
        } catch {
          console.log('  ⚠️  No TTS engine found - will generate silent audio\n');
        }
      }
    }
  } catch (error) {
    console.log('  ⚠️  TTS engine not found - will generate silent audio\n');
  }
  
  // Summary
  console.log('═'.repeat(60));
  if (allPassed) {
    console.log('✅ All critical tests passed!');
    console.log('\nReady to generate videos. Run:');
    console.log('  npm run video:generate');
    console.log('  or');
    console.log('  ./scripts/video-production/generate-videos.sh');
  } else {
    console.log('❌ Some tests failed. Please check the errors above.');
    process.exit(1);
  }
  console.log('═'.repeat(60));
}

validate().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});
