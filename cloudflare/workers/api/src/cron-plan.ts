/** One trigger preserves the union of all existing UTC job schedules. */
export const PIPELINE_CRON = '0 0,2,6,12,18 * * *'
export type ScheduledTask = 'ingestion' | 'enrichment' | 'health'

export function scheduledTasks(cron: string, scheduledTime: number): ScheduledTask[] {
  switch (cron) {
    case '0 2 * * *':
      return ['ingestion']
    case '0 */6 * * *':
      return ['enrichment']
    case '0 */12 * * *':
      return ['health']
    case PIPELINE_CRON: {
      if (!Number.isFinite(scheduledTime)) throw new Error('Invalid scheduled execution time')
      const time = new Date(scheduledTime)
      if (Number.isNaN(time.getTime()) || time.getUTCMinutes() !== 0)
        throw new Error('Invalid pipeline trigger minute')
      const hour = time.getUTCHours()
      const tasks: ScheduledTask[] = []
      if (hour === 2) tasks.push('ingestion')
      if (hour % 6 === 0) tasks.push('enrichment')
      if (hour % 12 === 0) tasks.push('health')
      return tasks
    }
    default:
      return []
  }
}
