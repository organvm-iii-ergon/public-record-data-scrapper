/**
 * Performance Monitoring and Metrics
 *
 * Provides comprehensive metrics tracking:
 * - Performance timers
 * - Counters and gauges
 * - Histogram tracking
 * - Custom metrics
 * - Prometheus-compatible output
 */

import { logger } from '../logging/logger'

export type MetricType = 'counter' | 'gauge' | 'histogram'

export interface Metric {
  name: string
  type: MetricType
  value: number
  labels?: Record<string, string>
  timestamp: number
}

export interface PerformanceMetric {
  operation: string
  duration: number
  timestamp: number
  labels?: Record<string, string>
}

export interface CounterMetric {
  name: string
  value: number
  labels?: Record<string, string>
}

export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map()
  private histograms: Map<string, number[]> = new Map()
  private timers: Map<string, number> = new Map()

  /**
   * Start a performance timer
   */
  startTimer(operation: string): () => number {
    const startTime = Date.now()
    const timerId = `${operation}-${startTime}`
    this.timers.set(timerId, startTime)

    return () => {
      const duration = Date.now() - startTime
      this.timers.delete(timerId)
      this.recordDuration(operation, duration)
      return duration
    }
  }

  /**
   * Record operation duration
   */
  recordDuration(operation: string, duration: number, labels?: Record<string, string>): void {
    const metricName = `operation_duration_ms_${operation}`

    // Store as histogram
    if (!this.histograms.has(metricName)) {
      this.histograms.set(metricName, [])
    }
    this.histograms.get(metricName)!.push(duration)

    // Also store as gauge for current value
    this.setGauge(metricName, duration, labels)

    // Log if slow
    if (duration > 1000) {
      logger.warn(`Slow operation detected: ${operation}`, {
        duration: `${duration}ms`,
        labels
      })
    }
  }

  /**
   * Increment counter
   */
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels)
    const existing = this.metrics.get(key)

    if (existing) {
      existing.value += value
      existing.timestamp = Date.now()
    } else {
      this.metrics.set(key, {
        name,
        type: 'counter',
        value,
        labels,
        timestamp: Date.now()
      })
    }
  }

  /**
   * Set gauge value
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels)
    this.metrics.set(key, {
      name,
      type: 'gauge',
      value,
      labels,
      timestamp: Date.now()
    })
  }

  /**
   * Record histogram value
   */
  recordHistogram(name: string, value: number): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, [])
    }
    this.histograms.get(name)!.push(value)

    // Keep only last 1000 values
    const values = this.histograms.get(name)!
    if (values.length > 1000) {
      values.shift()
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): Metric[] {
    return Array.from(this.metrics.values())
  }

  /**
   * Get specific metric
   */
  getMetric(name: string, labels?: Record<string, string>): Metric | undefined {
    const key = this.getMetricKey(name, labels)
    return this.metrics.get(key)
  }

  /**
   * Get histogram statistics
   */
  getHistogramStats(name: string): {
    count: number
    sum: number
    avg: number
    min: number
    max: number
    p50: number
    p95: number
    p99: number
  } | null {
    const values = this.histograms.get(name)
    if (!values || values.length === 0) return null

    const sorted = [...values].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)

    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99)
    }
  }

  /**
   * Export metrics in Prometheus format
   */
  toPrometheus(): string {
    const lines: string[] = []

    // Export counters and gauges
    this.metrics.forEach((metric) => {
      const labelsStr = metric.labels
        ? `{${Object.entries(metric.labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',')}}`
        : ''

      lines.push(`# TYPE ${metric.name} ${metric.type}`)
      lines.push(`${metric.name}${labelsStr} ${metric.value}`)
    })

    // Export histograms
    this.histograms.forEach((values, name) => {
      const stats = this.getHistogramStats(name)
      if (!stats) return

      lines.push(`# TYPE ${name} histogram`)
      lines.push(`${name}_count ${stats.count}`)
      lines.push(`${name}_sum ${stats.sum}`)
      lines.push(`${name}_bucket{le="50"} ${stats.p50}`)
      lines.push(`${name}_bucket{le="95"} ${stats.p95}`)
      lines.push(`${name}_bucket{le="99"} ${stats.p99}`)
      lines.push(`${name}_bucket{le="+Inf"} ${stats.max}`)
    })

    return lines.join('\n')
  }

  /**
   * Export metrics as JSON
   */
  toJSON(): {
    metrics: Metric[]
    histograms: Record<string, ReturnType<MetricsCollector['getHistogramStats']>>
    timestamp: string
  } {
    const histogramStats: Record<string, ReturnType<MetricsCollector['getHistogramStats']>> = {}
    this.histograms.forEach((_, name) => {
      histogramStats[name] = this.getHistogramStats(name)
    })

    return {
      metrics: this.getMetrics(),
      histograms: histogramStats,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear()
    this.histograms.clear()
    this.timers.clear()
  }

  /**
   * Get percentile value
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1
    return sorted[Math.max(0, index)]
  }

  /**
   * Generate metric key
   */
  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name
    }

    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',')

    return `${name}{${labelStr}}`
  }
}

/**
 * Application-specific metrics
 */
export class AppMetrics {
  private collector: MetricsCollector

  constructor() {
    this.collector = new MetricsCollector()
  }

  // ============================================================================
  // DATA PIPELINE METRICS
  // ============================================================================

  recordIngestionJob(
    state: string,
    recordsProcessed: number,
    duration: number,
    success: boolean
  ): void {
    this.collector.incrementCounter('ingestion_jobs_total', 1, {
      state,
      status: success ? 'success' : 'failure'
    })
    this.collector.incrementCounter('ingestion_records_total', recordsProcessed, { state })
    this.collector.recordDuration('ingestion_job', duration, { state })
  }

  recordEnrichmentJob(
    prospectId: string,
    fieldsEnriched: number,
    duration: number,
    success: boolean
  ): void {
    this.collector.incrementCounter('enrichment_jobs_total', 1, {
      status: success ? 'success' : 'failure'
    })
    this.collector.incrementCounter('enrichment_fields_total', fieldsEnriched)
    this.collector.recordDuration('enrichment_job', duration)
  }

  recordDataSourceCall(source: string, duration: number, success: boolean, cost?: number): void {
    this.collector.incrementCounter('data_source_calls_total', 1, {
      source,
      status: success ? 'success' : 'failure'
    })
    this.collector.recordDuration('data_source_call', duration, { source })

    if (cost !== undefined) {
      this.collector.incrementCounter('data_source_cost_total', cost, { source })
    }
  }

  // ============================================================================
  // DATABASE METRICS
  // ============================================================================

  recordQuery(duration: number, success: boolean): void {
    this.collector.incrementCounter('db_queries_total', 1, {
      status: success ? 'success' : 'failure'
    })
    this.collector.recordDuration('db_query', duration)
  }

  recordSlowQuery(query: string, duration: number): void {
    this.collector.incrementCounter('db_slow_queries_total', 1)
    logger.warn('Slow database query detected', { query, duration: `${duration}ms` })
  }

  setDatabasePoolSize(active: number, idle: number, waiting: number): void {
    this.collector.setGauge('db_pool_active_connections', active)
    this.collector.setGauge('db_pool_idle_connections', idle)
    this.collector.setGauge('db_pool_waiting_connections', waiting)
  }

  // ============================================================================
  // API METRICS
  // ============================================================================

  recordAPIRequest(endpoint: string, method: string, statusCode: number, duration: number): void {
    this.collector.incrementCounter('api_requests_total', 1, {
      endpoint,
      method,
      status: String(statusCode)
    })
    this.collector.recordDuration('api_request', duration, { endpoint, method })
  }

  recordAPIError(endpoint: string, method: string, errorType: string): void {
    this.collector.incrementCounter('api_errors_total', 1, { endpoint, method, errorType })
  }

  // ============================================================================
  // CACHE METRICS
  // ============================================================================

  recordCacheHit(key: string): void {
    void key
    this.collector.incrementCounter('cache_hits_total', 1)
  }

  recordCacheMiss(key: string): void {
    void key
    this.collector.incrementCounter('cache_misses_total', 1)
  }

  getCacheHitRate(): number {
    const hits = this.collector.getMetric('cache_hits_total')?.value || 0
    const misses = this.collector.getMetric('cache_misses_total')?.value || 0
    const total = hits + misses

    return total > 0 ? (hits / total) * 100 : 0
  }

  // ============================================================================
  // BUSINESS METRICS
  // ============================================================================

  recordProspectCreated(industry: string, priorityScore: number): void {
    this.collector.incrementCounter('prospects_created_total', 1, { industry })
    this.collector.recordHistogram('prospect_priority_scores', priorityScore)
  }

  recordProspectStatusChange(from: string, to: string): void {
    this.collector.incrementCounter('prospect_status_changes_total', 1, { from, to })
  }

  setActiveProspectsCount(count: number): void {
    this.collector.setGauge('active_prospects_count', count)
  }

  recordGrowthSignalDetected(signalType: string, confidence: number): void {
    this.collector.incrementCounter('growth_signals_detected_total', 1, { type: signalType })
    this.collector.recordHistogram('growth_signal_confidence', confidence)
  }

  // ============================================================================
  // SYSTEM METRICS
  // ============================================================================

  recordMemoryUsage(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      this.collector.setGauge('system_memory_heap_used_bytes', usage.heapUsed)
      this.collector.setGauge('system_memory_heap_total_bytes', usage.heapTotal)
      this.collector.setGauge('system_memory_rss_bytes', usage.rss)
    }
  }

  recordCPUUsage(usage: number): void {
    this.collector.setGauge('system_cpu_usage_percent', usage)
  }

  // ============================================================================
  // EXPORTS
  // ============================================================================

  getCollector(): MetricsCollector {
    return this.collector
  }

  toPrometheus(): string {
    return this.collector.toPrometheus()
  }

  toJSON(): ReturnType<MetricsCollector['toJSON']> {
    return this.collector.toJSON()
  }

  clear(): void {
    this.collector.clear()
  }
}

// Singleton instance
export const metrics = new AppMetrics()

/**
 * Performance decorator
 */
export function measurePerformance(metricName: string) {
  return function (target: object, propertyKey: string, descriptor: PropertyDescriptor) {
    void target
    void propertyKey
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown> | unknown

    descriptor.value = async function (...args: unknown[]) {
      const endTimer = metrics.getCollector().startTimer(metricName)

      try {
        const result = await originalMethod.apply(this, args)
        endTimer()
        return result
      } catch (error) {
        endTimer()
        throw error
      }
    }

    return descriptor
  }
}

export default metrics
