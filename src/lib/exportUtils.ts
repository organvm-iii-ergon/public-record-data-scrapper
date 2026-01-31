import { Prospect } from './types'

export type ExportFormat = 'json' | 'csv'

/**
 * Converts a value to a CSV-safe string
 * Handles commas, quotes, and newlines properly
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = String(value)

  // If the value contains comma, quote, or newline, wrap it in quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Escape existing quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

/**
 * Converts an array of prospects to CSV format
 */
function prospectsToCsv(prospects: Prospect[]): string {
  if (prospects.length === 0) {
    return ''
  }

  // Define CSV headers
  const headers = [
    'Company Name',
    'Industry',
    'State',
    'Priority Score',
    'Health Grade',
    'Health Score',
    'Sentiment Trend',
    'Status',
    'Growth Signals',
    'Signal Types',
    'Estimated Revenue',
    'Default Date',
    'Days Since Default',
    'Violation Count',
    'Last Updated',
    'Claimed By',
    'Claimed Date',
    'Narrative'
  ]

  // Build CSV rows
  const rows = prospects.map((prospect) => {
    const signalTypes = [...new Set(prospect.growthSignals.map((s) => s.type))].join('; ')

    return [
      prospect.companyName,
      prospect.industry,
      prospect.state,
      prospect.priorityScore,
      prospect.healthScore.grade,
      prospect.healthScore.score,
      prospect.healthScore.sentimentTrend,
      prospect.status,
      prospect.growthSignals.length,
      signalTypes,
      prospect.estimatedRevenue || '',
      prospect.defaultDate,
      prospect.timeSinceDefault,
      prospect.healthScore.violationCount,
      prospect.healthScore.lastUpdated,
      prospect.claimedBy || '',
      prospect.claimedDate || '',
      prospect.narrative
    ].map(escapeCsvValue)
  })

  // Combine headers and rows
  const csvContent = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => row.join(','))
  ].join('\n')

  return csvContent
}

/**
 * Converts prospects to JSON format (existing functionality)
 */
function prospectsToJson(prospects: Prospect[]): string {
  const exportData = prospects.map((prospect) => ({
    company: prospect.companyName,
    industry: prospect.industry,
    state: prospect.state,
    priorityScore: prospect.priorityScore,
    healthGrade: prospect.healthScore.grade,
    healthScore: prospect.healthScore.score,
    sentimentTrend: prospect.healthScore.sentimentTrend,
    growthSignals: prospect.growthSignals.length,
    signalTypes: [...new Set(prospect.growthSignals.map((s) => s.type))],
    estimatedRevenue: prospect.estimatedRevenue,
    defaultDate: prospect.defaultDate,
    daysSinceDefault: prospect.timeSinceDefault,
    violationCount: prospect.healthScore.violationCount,
    lastUpdated: prospect.healthScore.lastUpdated,
    narrative: prospect.narrative,
    status: prospect.status,
    claimedBy: prospect.claimedBy,
    claimedDate: prospect.claimedDate
  }))

  return JSON.stringify(exportData, null, 2)
}

/**
 * Exports prospects to the specified format and triggers download
 */
export function exportProspects(
  prospects: Prospect[],
  format: ExportFormat = 'json',
  filterInfo?: string
): void {
  if (prospects.length === 0) {
    throw new Error('No prospects to export')
  }

  let content: string
  let mimeType: string
  let extension: string

  switch (format) {
    case 'csv':
      content = prospectsToCsv(prospects)
      mimeType = 'text/csv'
      extension = 'csv'
      break
    case 'json':
    default:
      content = prospectsToJson(prospects)
      mimeType = 'application/json'
      extension = 'json'
  }

  // Create and download file
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url

  // Generate filename
  // Use ISO string, remove milliseconds and 'Z', replace colons with dashes for filename safety
  const timestamp = new Date().toISOString().split('.')[0].replace(/[:]/g, '-')
  const filterSuffix = filterInfo ? `-${filterInfo}` : ''

  const filename =
    prospects.length === 1
      ? `prospect-${prospects[0].companyName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${timestamp}.${extension}`
      : `prospects-export${filterSuffix}-${timestamp}.${extension}`

  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
