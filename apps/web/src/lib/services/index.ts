/**
 * Data Pipeline Services
 *
 * Central export for all data ingestion, enrichment, and refresh services
 */

export {
  DataIngestionService,
  defaultIngestionConfig,
  type DataSource,
  type IngestionConfig,
  type IngestionResult
} from './DataIngestionService'

export {
  DataEnrichmentService,
  defaultEnrichmentSources,
  type EnrichmentSource,
  type EnrichmentResult
} from './DataEnrichmentService'

export {
  DataRefreshScheduler,
  defaultScheduleConfig,
  type ScheduleConfig,
  type SchedulerStatus,
  type SchedulerEvent,
  type SchedulerEventType,
  type SchedulerEventHandler
} from './DataRefreshScheduler'

export {
  initDatabaseService,
  fetchProspects,
  fetchProspectById,
  searchProspects,
  updateProspectStatus,
  fetchDashboardStats,
  fetchCompetitorData,
  fetchPortfolioCompanies,
  hasDatabaseData
} from './databaseService'
