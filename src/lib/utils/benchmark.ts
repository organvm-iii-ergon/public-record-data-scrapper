/**
 * Performance Benchmarking Utilities
 *
 * Tools for measuring and analyzing data pipeline performance
 */

export interface BenchmarkResult {
  name: string
  duration: number // milliseconds
  operations: number
  operationsPerSecond: number
  memoryUsed: number // bytes
  timestamp: string
  metadata?: Record<string, any>
}

export interface BenchmarkSummary {
  totalTests: number
  totalDuration: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  totalOperations: number
  avgOperationsPerSecond: number
  results: BenchmarkResult[]
}

/**
 * Simple benchmark runner
 */
export class Benchmark {
  private results: BenchmarkResult[] = []

  /**
   * Run a single benchmark
   */
  async run<T>(
    name: string,
    fn: () => Promise<T>,
    options: {
      operations?: number
      warmup?: boolean
      metadata?: Record<string, any>
    } = {}
  ): Promise<BenchmarkResult> {
    const operations = options.operations || 1

    // Warmup run to avoid cold start penalties
    if (options.warmup) {
      await fn()
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }

    const startMemory = process.memoryUsage().heapUsed
    const startTime = performance.now()

    for (let i = 0; i < operations; i++) {
      await fn()
    }

    const endTime = performance.now()
    const endMemory = process.memoryUsage().heapUsed

    const duration = endTime - startTime
    const memoryUsed = endMemory - startMemory

    const result: BenchmarkResult = {
      name,
      duration,
      operations,
      operationsPerSecond: (operations / duration) * 1000,
      memoryUsed,
      timestamp: new Date().toISOString(),
      metadata: options.metadata
    }

    this.results.push(result)
    return result
  }

  /**
   * Run multiple benchmarks
   */
  async suite(
    benchmarks: Array<{
      name: string
      fn: () => Promise<any>
      operations?: number
    }>
  ): Promise<BenchmarkSummary> {
    console.log(`Running ${benchmarks.length} benchmarks...\n`)

    for (const benchmark of benchmarks) {
      console.log(`Running: ${benchmark.name}...`)
      const result = await this.run(benchmark.name, benchmark.fn, {
        operations: benchmark.operations,
        warmup: true
      })

      console.log(`  Duration: ${result.duration.toFixed(2)}ms`)
      console.log(`  Ops/sec: ${result.operationsPerSecond.toFixed(2)}`)
      console.log(`  Memory: ${(result.memoryUsed / 1024 / 1024).toFixed(2)}MB\n`)
    }

    return this.getSummary()
  }

  /**
   * Get benchmark summary
   */
  getSummary(): BenchmarkSummary {
    if (this.results.length === 0) {
      return {
        totalTests: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        totalOperations: 0,
        avgOperationsPerSecond: 0,
        results: []
      }
    }

    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0)
    const totalOperations = this.results.reduce((sum, r) => sum + r.operations, 0)
    const durations = this.results.map(r => r.duration)

    return {
      totalTests: this.results.length,
      totalDuration,
      avgDuration: totalDuration / this.results.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalOperations,
      avgOperationsPerSecond:
        (totalOperations / totalDuration) * 1000,
      results: [...this.results]
    }
  }

  /**
   * Compare two benchmark results
   */
  static compare(baseline: BenchmarkResult, current: BenchmarkResult): {
    durationDiff: number
    durationDiffPercent: number
    opsDiff: number
    opsDiffPercent: number
    faster: boolean
  } {
    const durationDiff = current.duration - baseline.duration
    const durationDiffPercent = (durationDiff / baseline.duration) * 100

    const opsDiff = current.operationsPerSecond - baseline.operationsPerSecond
    const opsDiffPercent = (opsDiff / baseline.operationsPerSecond) * 100

    return {
      durationDiff,
      durationDiffPercent,
      opsDiff,
      opsDiffPercent,
      faster: current.duration < baseline.duration
    }
  }

  /**
   * Export results to JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.getSummary(), null, 2)
  }

  /**
   * Clear results
   */
  clear(): void {
    this.results = []
  }
}

/**
 * Performance profiler for detailed analysis
 */
export class Profiler {
  private marks: Map<string, number> = new Map()
  private measures: Array<{
    name: string
    startMark: string
    endMark: string
    duration: number
    timestamp: string
  }> = []

  /**
   * Mark a point in time
   */
  mark(name: string): void {
    this.marks.set(name, performance.now())
  }

  /**
   * Measure duration between two marks
   */
  measure(name: string, startMark: string, endMark: string): number {
    const start = this.marks.get(startMark)
    const end = this.marks.get(endMark)

    if (!start || !end) {
      throw new Error(`Marks not found: ${startMark} or ${endMark}`)
    }

    const duration = end - start

    this.measures.push({
      name,
      startMark,
      endMark,
      duration,
      timestamp: new Date().toISOString()
    })

    return duration
  }

  /**
   * Get all measurements
   */
  getMeasures(): typeof this.measures {
    return [...this.measures]
  }

  /**
   * Clear all marks and measures
   */
  clear(): void {
    this.marks.clear()
    this.measures = []
  }

  /**
   * Print measures to console
   */
  print(): void {
    console.log('\nPerformance Profile:')
    console.log('='.repeat(60))

    this.measures.forEach(measure => {
      console.log(`${measure.name}: ${measure.duration.toFixed(2)}ms`)
    })

    console.log('='.repeat(60))
  }
}

/**
 * Memory profiler
 */
export class MemoryProfiler {
  private snapshots: Array<{
    name: string
    heapUsed: number
    heapTotal: number
    external: number
    arrayBuffers: number
    timestamp: string
  }> = []

  /**
   * Take a memory snapshot
   */
  snapshot(name: string): void {
    const mem = process.memoryUsage()

    this.snapshots.push({
      name,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Compare two snapshots
   */
  compare(startName: string, endName: string): {
    heapUsedDiff: number
    heapTotalDiff: number
    externalDiff: number
    arrayBuffersDiff: number
  } | null {
    const start = this.snapshots.find(s => s.name === startName)
    const end = this.snapshots.find(s => s.name === endName)

    if (!start || !end) {
      return null
    }

    return {
      heapUsedDiff: end.heapUsed - start.heapUsed,
      heapTotalDiff: end.heapTotal - start.heapTotal,
      externalDiff: end.external - start.external,
      arrayBuffersDiff: end.arrayBuffers - start.arrayBuffers
    }
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): typeof this.snapshots {
    return [...this.snapshots]
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.snapshots = []
  }

  /**
   * Print memory usage
   */
  print(): void {
    console.log('\nMemory Profile:')
    console.log('='.repeat(60))

    this.snapshots.forEach(snapshot => {
      console.log(`\n${snapshot.name}:`)
      console.log(`  Heap Used: ${(snapshot.heapUsed / 1024 / 1024).toFixed(2)}MB`)
      console.log(`  Heap Total: ${(snapshot.heapTotal / 1024 / 1024).toFixed(2)}MB`)
      console.log(`  External: ${(snapshot.external / 1024 / 1024).toFixed(2)}MB`)
      console.log(`  Array Buffers: ${(snapshot.arrayBuffers / 1024 / 1024).toFixed(2)}MB`)
    })

    console.log('='.repeat(60))
  }
}

/**
 * Async operation timer
 */
export async function timeAsync<T>(
  fn: () => Promise<T>,
  label?: string
): Promise<{ result: T; duration: number }> {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start

  if (label) {
    console.log(`${label}: ${duration.toFixed(2)}ms`)
  }

  return { result, duration }
}

/**
 * Sync operation timer
 */
export function timeSync<T>(fn: () => T, label?: string): { result: T; duration: number } {
  const start = performance.now()
  const result = fn()
  const duration = performance.now() - start

  if (label) {
    console.log(`${label}: ${duration.toFixed(2)}ms`)
  }

  return { result, duration }
}

/**
 * Statistical analysis of benchmark results
 */
export class BenchmarkStats {
  static median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2
    }

    return sorted[mid]
  }

  static percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b)
    const index = (p / 100) * (sorted.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index - lower

    if (lower === upper) {
      return sorted[lower]
    }

    return sorted[lower] * (1 - weight) + sorted[upper] * weight
  }

  static standardDeviation(values: number[]): number {
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length
    const squareDiffs = values.map(v => Math.pow(v - avg, 2))
    const avgSquareDiff = squareDiffs.reduce((sum, v) => sum + v, 0) / values.length
    return Math.sqrt(avgSquareDiff)
  }

  static analyze(results: BenchmarkResult[]): {
    count: number
    mean: number
    median: number
    min: number
    max: number
    stdDev: number
    p50: number
    p95: number
    p99: number
  } {
    const durations = results.map(r => r.duration)

    return {
      count: durations.length,
      mean: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      median: this.median(durations),
      min: Math.min(...durations),
      max: Math.max(...durations),
      stdDev: this.standardDeviation(durations),
      p50: this.percentile(durations, 50),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99)
    }
  }
}
