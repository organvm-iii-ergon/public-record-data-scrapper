/**
 * CRM Integrations — barrel export
 *
 * Re-exports all CRM adapters and the shared interface/types.
 * Usage:
 *   import { HubSpotAdapter, GoHighLevelAdapter, type CrmAdapter } from '../integrations/crm'
 */

export { HubSpotAdapter } from './HubSpotAdapter'
export { GoHighLevelAdapter } from './GoHighLevelAdapter'
export type { CrmAdapter, CrmConfig, CrmPushResult } from './types'
