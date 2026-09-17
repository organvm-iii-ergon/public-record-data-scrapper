/**
 * EntityResolutionService
 *
 * Enterprise entity resolution engine for the UCC-MCA Intelligence Platform.
 * Deduplicates and links corporate entities and individuals across 50-state filings,
 * identifying cross-state operations, funder overlaps, and principal networks,
 * and assigning deterministic `enrichment_confidence` scores.
 *
 * @module server/services/EntityResolutionService
 */

import { database } from '../database/connection'
import { normalizeCompanyName, normalizePersonName, soundex } from '@public-records/core/identity'
import {
  EntityResolutionModel,
  type CorporateRecordInput,
  type IndividualRecordInput,
  type ModelPrediction
} from './EntityResolutionModel'

export interface FilingEntityInput {
  id: string
  externalId?: string
  filingDate: string | Date
  debtorName: string
  debtorAddress?: string
  debtorCity?: string
  debtorZip?: string
  state: string
  securedParty: string
  lienAmount?: number
  status?: 'active' | 'terminated' | 'lapsed'
  principals?: string[]
  isIndividual?: boolean
  raw_data?: Record<string, unknown>
}

export interface ResolvedEntityCluster {
  clusterId: string
  entityType: 'corporate' | 'individual'
  canonicalName: string
  aliases: string[]
  primaryState: string
  states: string[]
  filingIds: string[]
  recordCount: number
  enrichment_confidence: number
  securedParties: string[]
  principals: string[]
  crossStateLinksCount: number
  explanation: string
  associatedEntities?: Array<{ id: string; name: string; type: string }>
  metadata?: Record<string, unknown>
}

export interface ResolutionSummary {
  totalFilingsProcessed: number
  corporateClusters: ResolvedEntityCluster[]
  individualClusters: ResolvedEntityCluster[]
  crossStateEntities: number
  deduplicationRatio: number
  averageConfidence: number
}

export interface ProspectLinkResult {
  prospectId: string
  filingId: string
  linked: boolean
  isNewLink: boolean
  matchScore: number
  enrichment_confidence: number
  explanation: string
}

/**
 * Union-Find / Disjoint-Set Data Structure for transitive entity clustering.
 */
class DisjointSet {
  private parent: Map<string, string> = new Map()
  private rank: Map<string, number> = new Map()

  find(item: string): string {
    if (!this.parent.has(item)) {
      this.parent.set(item, item)
      this.rank.set(item, 0)
      return item
    }
    const p = this.parent.get(item)!
    if (p !== item) {
      const root = this.find(p)
      this.parent.set(item, root)
      return root
    }
    return p
  }

  union(a: string, b: string): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA === rootB) return

    const rankA = this.rank.get(rootA) ?? 0
    const rankB = this.rank.get(rootB) ?? 0

    if (rankA < rankB) {
      this.parent.set(rootA, rootB)
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA)
    } else {
      this.parent.set(rootB, rootA)
      this.rank.set(rootA, rankA + 1)
    }
  }

  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>()
    for (const key of this.parent.keys()) {
      const root = this.find(key)
      if (!groups.has(root)) {
        groups.set(root, [])
      }
      groups.get(root)!.push(key)
    }
    return groups
  }
}

export class EntityResolutionService {
  private model: EntityResolutionModel

  constructor(model: EntityResolutionModel = new EntityResolutionModel()) {
    this.model = model
  }

  /**
   * Helper: checks whether a debtor name represents an individual rather than a corporation.
   */
  static isIndividualName(name: string): boolean {
    const lower = name.trim().toLowerCase()
    const corporateKeywords = [
      'llc',
      'inc',
      'corp',
      'ltd',
      'limited',
      'co',
      'company',
      'group',
      'services',
      'solutions',
      'holdings',
      'enterprises',
      'restaurant',
      'logistics',
      'transport',
      'consulting',
      'management',
      'industries'
    ]
    for (const kw of corporateKeywords) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(lower)) return false
    }

    if (lower.includes(',')) {
      // "Smith, John" pattern
      return true
    }

    const words = lower.split(/\s+/).filter(Boolean)
    return words.length >= 2 && words.length <= 3
  }

  /**
   * Deduplicates and links corporate entities and individuals across state filings.
   */
  deduplicateFilings(filings: FilingEntityInput[]): ResolutionSummary {
    if (filings.length === 0) {
      return {
        totalFilingsProcessed: 0,
        corporateClusters: [],
        individualClusters: [],
        crossStateEntities: 0,
        deduplicationRatio: 0,
        averageConfidence: 0
      }
    }

    const corporateRecords: FilingEntityInput[] = []
    const individualRecords: FilingEntityInput[] = []

    for (const f of filings) {
      const isInd = f.isIndividual ?? EntityResolutionService.isIndividualName(f.debtorName)
      if (isInd) {
        individualRecords.push(f)
      } else {
        corporateRecords.push(f)
      }
    }

    const corporateClusters = this.clusterCorporateFilings(corporateRecords)
    const individualClusters = this.clusterIndividualFilings(individualRecords, corporateClusters)

    const allClusters = [...corporateClusters, ...individualClusters]
    const crossStateCount = allClusters.filter((c) => c.states.length > 1).length
    const deduplicationRatio = Number(
      (1 - allClusters.length / Math.max(filings.length, 1)).toFixed(2)
    )

    const avgConfidence =
      allClusters.length > 0
        ? Number(
            (
              allClusters.reduce((acc, c) => acc + c.enrichment_confidence, 0) / allClusters.length
            ).toFixed(2)
          )
        : 1.0

    return {
      totalFilingsProcessed: filings.length,
      corporateClusters,
      individualClusters,
      crossStateEntities: crossStateCount,
      deduplicationRatio: Math.max(0, deduplicationRatio),
      averageConfidence: avgConfidence
    }
  }

  /**
   * Cluster corporate filings across different states using blocking and weighted scoring.
   */
  private clusterCorporateFilings(filings: FilingEntityInput[]): ResolvedEntityCluster[] {
    if (filings.length === 0) return []

    const ds = new DisjointSet()
    filings.forEach((f) => ds.find(f.id))

    // Blocking index: token, prefix, soundex
    const blockIndex = new Map<string, string[]>()
    const addToBlock = (key: string, id: string) => {
      if (!key) return
      if (!blockIndex.has(key)) blockIndex.set(key, [])
      blockIndex.get(key)!.push(id)
    }

    const filingMap = new Map<string, FilingEntityInput>()
    for (const f of filings) {
      filingMap.set(f.id, f)
      const norm = normalizeCompanyName(f.debtorName)
      const snd = soundex(norm)
      const prefix = norm.slice(0, 4)
      const firstToken = norm.split(/\s+/)[0] || ''

      addToBlock(`snd:${snd}`, f.id)
      if (prefix.length >= 3) addToBlock(`pfx:${prefix}`, f.id)
      if (firstToken.length >= 3) addToBlock(`tok:${firstToken}`, f.id)
      if (f.state) addToBlock(`st:${f.state.toUpperCase()}`, f.id)
    }

    // Candidate pairs to evaluate
    const evaluatedPairs = new Set<string>()
    const pairPredictions = new Map<string, ModelPrediction>()

    for (const [, memberIds] of blockIndex.entries()) {
      if (memberIds.length < 2) continue
      // Limit block size to prevent excessive pairwise evaluation
      const maxMembers = Math.min(memberIds.length, 40)

      for (let i = 0; i < maxMembers; i++) {
        for (let j = i + 1; j < maxMembers; j++) {
          const idA = memberIds[i]
          const idB = memberIds[j]
          const pairKey = idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`
          if (evaluatedPairs.has(pairKey)) continue
          evaluatedPairs.add(pairKey)

          const fA = filingMap.get(idA)!
          const fB = filingMap.get(idB)!

          const e1: CorporateRecordInput = {
            id: fA.id,
            name: fA.debtorName,
            state: fA.state,
            address: fA.debtorAddress,
            city: fA.debtorCity,
            zipCode: fA.debtorZip,
            securedParty: fA.securedParty,
            principals: fA.principals,
            filingDate: fA.filingDate
          }

          const e2: CorporateRecordInput = {
            id: fB.id,
            name: fB.debtorName,
            state: fB.state,
            address: fB.debtorAddress,
            city: fB.debtorCity,
            zipCode: fB.debtorZip,
            securedParty: fB.securedParty,
            principals: fB.principals,
            filingDate: fB.filingDate
          }

          const features = this.model.extractCorporateFeatures(e1, e2)
          const prediction = this.model.predictCorporateMatch(features)

          if (prediction.isMatch) {
            ds.union(idA, idB)
            pairPredictions.set(pairKey, prediction)
          }
        }
      }
    }

    // Synthesize clusters
    const groups = ds.getGroups()
    const clusters: ResolvedEntityCluster[] = []
    let clusterIndex = 1

    for (const [, memberIds] of groups.entries()) {
      const clusterFilings = memberIds.map((id) => filingMap.get(id)!).filter(Boolean)
      if (clusterFilings.length === 0) continue

      // Canonical name: select the most common or longest name
      const nameFreq = new Map<string, number>()
      clusterFilings.forEach((f) => {
        nameFreq.set(f.debtorName, (nameFreq.get(f.debtorName) || 0) + 1)
      })
      let canonicalName = clusterFilings[0].debtorName
      let maxCount = 0
      for (const [name, count] of nameFreq.entries()) {
        if (count > maxCount || (count === maxCount && name.length > canonicalName.length)) {
          canonicalName = name
          maxCount = count
        }
      }

      const aliases = Array.from(
        new Set(clusterFilings.map((f) => f.debtorName).filter((n) => n !== canonicalName))
      )
      const states = Array.from(new Set(clusterFilings.map((f) => f.state.toUpperCase())))
      const securedParties = Array.from(
        new Set(clusterFilings.map((f) => f.securedParty).filter(Boolean))
      )
      const principals = Array.from(
        new Set(clusterFilings.flatMap((f) => f.principals || []).filter(Boolean))
      )

      // Calculate cluster confidence
      let clusterConfidence = 0.9
      if (clusterFilings.length > 1) {
        // Find match confidences among members
        let totalPairConf = 0
        let pairCount = 0
        for (let i = 0; i < clusterFilings.length; i++) {
          for (let j = i + 1; j < clusterFilings.length; j++) {
            const idA = clusterFilings[i].id
            const idB = clusterFilings[j].id
            const pairKey = idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`
            const pred = pairPredictions.get(pairKey)
            if (pred) {
              totalPairConf += pred.enrichment_confidence
              pairCount++
            }
          }
        }
        clusterConfidence = pairCount > 0 ? totalPairConf / pairCount : 0.85

        // Multi-state verification bonus: when entity filings span states with corroborating lenders
        if (states.length > 1 && securedParties.length > 0) {
          clusterConfidence = Math.min(1.0, clusterConfidence + 0.05)
        }
      } else {
        clusterConfidence = 0.85 // Baseline confidence for single state filing
      }

      const explanations: string[] = []
      if (states.length > 1) {
        explanations.push(`Linked across ${states.length} states (${states.join(', ')})`)
      }
      if (securedParties.length > 0) {
        explanations.push(`Secured by ${securedParties.slice(0, 2).join(', ')}`)
      }
      if (aliases.length > 0) {
        explanations.push(`Resolved ${aliases.length} name variants`)
      }

      clusters.push({
        clusterId: `corp-cluster-${clusterIndex++}`,
        entityType: 'corporate',
        canonicalName,
        aliases,
        primaryState: states[0] || 'US',
        states,
        filingIds: clusterFilings.map((f) => f.id),
        recordCount: clusterFilings.length,
        enrichment_confidence: Number(clusterConfidence.toFixed(2)),
        securedParties,
        principals,
        crossStateLinksCount: Math.max(0, states.length - 1),
        explanation: explanations.length > 0 ? explanations.join('; ') : 'Single filing verified'
      })
    }

    return clusters
  }

  /**
   * Cluster individual debtor filings (e.g. sole proprietors, personal guarantors).
   */
  private clusterIndividualFilings(
    filings: FilingEntityInput[],
    corporateClusters: ResolvedEntityCluster[]
  ): ResolvedEntityCluster[] {
    if (filings.length === 0) return []

    const ds = new DisjointSet()
    filings.forEach((f) => ds.find(f.id))

    const blockIndex = new Map<string, string[]>()
    const addToBlock = (key: string, id: string) => {
      if (!key) return
      if (!blockIndex.has(key)) blockIndex.set(key, [])
      blockIndex.get(key)!.push(id)
    }

    const filingMap = new Map<string, FilingEntityInput>()
    for (const f of filings) {
      filingMap.set(f.id, f)
      const parsed = normalizePersonName(f.debtorName)
      const snd = soundex(parsed.lastName || f.debtorName)
      addToBlock(`snd:${snd}`, f.id)
      if (parsed.lastName) addToBlock(`last:${parsed.lastName}`, f.id)
      if (f.state) addToBlock(`st:${f.state.toUpperCase()}`, f.id)
    }

    const evaluatedPairs = new Set<string>()
    const pairPredictions = new Map<string, ModelPrediction>()

    for (const [, memberIds] of blockIndex.entries()) {
      if (memberIds.length < 2) continue
      const maxMembers = Math.min(memberIds.length, 30)

      for (let i = 0; i < maxMembers; i++) {
        for (let j = i + 1; j < maxMembers; j++) {
          const idA = memberIds[i]
          const idB = memberIds[j]
          const pairKey = idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`
          if (evaluatedPairs.has(pairKey)) continue
          evaluatedPairs.add(pairKey)

          const fA = filingMap.get(idA)!
          const fB = filingMap.get(idB)!

          const i1: IndividualRecordInput = {
            id: fA.id,
            fullName: fA.debtorName,
            state: fA.state,
            address: fA.debtorAddress,
            city: fA.debtorCity,
            zipCode: fA.debtorZip,
            associatedBusiness: fA.securedParty
          }

          const i2: IndividualRecordInput = {
            id: fB.id,
            fullName: fB.debtorName,
            state: fB.state,
            address: fB.debtorAddress,
            city: fB.debtorCity,
            zipCode: fB.debtorZip,
            associatedBusiness: fB.securedParty
          }

          const features = this.model.extractIndividualFeatures(i1, i2)
          const prediction = this.model.predictIndividualMatch(features)

          if (prediction.isMatch) {
            ds.union(idA, idB)
            pairPredictions.set(pairKey, prediction)
          }
        }
      }
    }

    const groups = ds.getGroups()
    const clusters: ResolvedEntityCluster[] = []
    let clusterIndex = 1

    for (const [, memberIds] of groups.entries()) {
      const clusterFilings = memberIds.map((id) => filingMap.get(id)!).filter(Boolean)
      if (clusterFilings.length === 0) continue

      const canonicalName = clusterFilings[0].debtorName
      const aliases = Array.from(
        new Set(clusterFilings.map((f) => f.debtorName).filter((n) => n !== canonicalName))
      )
      const states = Array.from(new Set(clusterFilings.map((f) => f.state.toUpperCase())))
      const securedParties = Array.from(
        new Set(clusterFilings.map((f) => f.securedParty).filter(Boolean))
      )

      // Find associated corporate entities from corporateClusters
      const associatedEntities: { id: string; name: string; type: string }[] = []
      if (corporateClusters && corporateClusters.length > 0) {
        for (const corp of corporateClusters) {
          if (
            corp.principals.some(
              (p) => normalizePersonName(p).lastName === normalizePersonName(canonicalName).lastName
            ) ||
            corp.securedParties.some((sp) => securedParties.includes(sp))
          ) {
            associatedEntities.push({
              id: corp.clusterId,
              name: corp.canonicalName,
              type: 'corporate'
            })
          }
        }
      }

      let clusterConfidence = 0.85
      if (clusterFilings.length > 1) {
        let totalPairConf = 0
        let pairCount = 0
        for (let i = 0; i < clusterFilings.length; i++) {
          for (let j = i + 1; j < clusterFilings.length; j++) {
            const idA = clusterFilings[i].id
            const idB = clusterFilings[j].id
            const pairKey = idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`
            const pred = pairPredictions.get(pairKey)
            if (pred) {
              totalPairConf += pred.enrichment_confidence
              pairCount++
            }
          }
        }
        clusterConfidence = pairCount > 0 ? totalPairConf / pairCount : 0.82
      }

      clusters.push({
        clusterId: `ind-cluster-${clusterIndex++}`,
        entityType: 'individual',
        canonicalName,
        aliases,
        primaryState: states[0] || 'US',
        states,
        filingIds: clusterFilings.map((f) => f.id),
        recordCount: clusterFilings.length,
        enrichment_confidence: Number(clusterConfidence.toFixed(2)),
        securedParties,
        principals: [canonicalName],
        crossStateLinksCount: Math.max(0, states.length - 1),
        explanation: `Individual debtor resolved across ${clusterFilings.length} filing(s)`,
        associatedEntities: associatedEntities.length > 0 ? associatedEntities : undefined
      })
    }

    return clusters
  }

  /**
   * Evaluates an incoming state filing against a prospect and links it if high confidence.
   * Recalculates and updates `enrichment_confidence` on the prospect row.
   */
  async linkFilingToProspect(
    filing: FilingEntityInput,
    options: {
      prospectId?: string
      orgId?: string
      autoLinkThreshold?: number
    } = {}
  ): Promise<ProspectLinkResult> {
    if (!options.orgId) {
      throw new Error('Organization context is required for prospect linking')
    }
    const threshold = options.autoLinkThreshold ?? 0.75
    let targetProspectId = options.prospectId

    // If prospectId was not provided, look for candidate prospects in DB
    if (!targetProspectId) {
      const normalizedDebtor = normalizeCompanyName(filing.debtorName)
      const candidates = await database.query<{
        id: string
        company_name: string
        state: string
        enrichment_confidence: number | null
      }>(
        `SELECT id, company_name, state, enrichment_confidence
         FROM prospects
         WHERE org_id = $3
           AND (company_name_normalized = $1
            OR company_name % $2)
         LIMIT 5`,
        [normalizedDebtor, filing.debtorName, options.orgId]
      )

      if (candidates.length === 0) {
        return {
          prospectId: '',
          filingId: filing.id,
          linked: false,
          isNewLink: false,
          matchScore: 0,
          enrichment_confidence: 0,
          explanation: 'No candidate prospects found in database'
        }
      }

      // Pick top candidate
      targetProspectId = candidates[0].id
    }

    // Query prospect details
    const prospectRows = await database.query<{
      id: string
      company_name: string
      state: string
      enrichment_confidence: number | null
    }>(
      `SELECT id, company_name, state, enrichment_confidence
       FROM prospects WHERE id = $1 AND org_id = $2`,
      [targetProspectId, options.orgId]
    )

    if (prospectRows.length === 0) {
      return {
        prospectId: targetProspectId,
        filingId: filing.id,
        linked: false,
        isNewLink: false,
        matchScore: 0,
        enrichment_confidence: 0,
        explanation: `Prospect ${targetProspectId} not found`
      }
    }

    const prospect = prospectRows[0]
    const e1: CorporateRecordInput = {
      name: prospect.company_name,
      state: prospect.state
    }
    const e2: CorporateRecordInput = {
      id: filing.id,
      name: filing.debtorName,
      state: filing.state,
      address: filing.debtorAddress,
      city: filing.debtorCity,
      zipCode: filing.debtorZip,
      securedParty: filing.securedParty,
      principals: filing.principals,
      filingDate: filing.filingDate
    }

    const features = this.model.extractCorporateFeatures(e1, e2)
    const prediction = this.model.predictCorporateMatch(features)

    if (prediction.enrichment_confidence < threshold && !prediction.isMatch) {
      return {
        prospectId: targetProspectId,
        filingId: filing.id,
        linked: false,
        isNewLink: false,
        matchScore: prediction.score,
        enrichment_confidence: prediction.enrichment_confidence,
        explanation: `Confidence ${prediction.enrichment_confidence} below threshold ${threshold}: ${prediction.explanation}`
      }
    }

    // Check if link already exists in prospect_ucc_filings
    const existingLinks = await database.query<{ prospect_id: string }>(
      `SELECT prospect_id FROM prospect_ucc_filings
       WHERE prospect_id = $1 AND ucc_filing_id = $2`,
      [targetProspectId, filing.id]
    )

    const isNewLink = existingLinks.length === 0
    if (isNewLink) {
      await database.query(
        `INSERT INTO prospect_ucc_filings (prospect_id, ucc_filing_id)
         VALUES ($1, $2)
         ON CONFLICT (prospect_id, ucc_filing_id) DO NOTHING`,
        [targetProspectId, filing.id]
      )
    }

    // Recalculate combined prospect enrichment_confidence
    // Cross-state presence and multiple linked filings strengthen confidence!
    const linkedFilings = await database.query<{ state: string }>(
      `SELECT u.state
       FROM prospect_ucc_filings puf
       JOIN ucc_filings u ON u.id = puf.ucc_filing_id
       WHERE puf.prospect_id = $1`,
      [targetProspectId]
    )

    const uniqueStates = new Set(linkedFilings.map((r) => r.state.toUpperCase()))
    let updatedConfidence = prediction.enrichment_confidence

    if (uniqueStates.size > 1) {
      // Multi-state presence verified across filings
      updatedConfidence = Math.min(1.0, updatedConfidence + 0.05)
    }
    if (linkedFilings.length >= 3) {
      updatedConfidence = Math.min(1.0, updatedConfidence + 0.03)
    }
    updatedConfidence = Number(Math.min(1.0, Math.max(0.0, updatedConfidence)).toFixed(2))

    // Persist updated enrichment_confidence
    await database.query(
      `UPDATE prospects
       SET enrichment_confidence = $2,
           last_enriched_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND org_id = $3`,
      [targetProspectId, updatedConfidence, options.orgId]
    )

    return {
      prospectId: targetProspectId,
      filingId: filing.id,
      linked: true,
      isNewLink,
      matchScore: prediction.score,
      enrichment_confidence: updatedConfidence,
      explanation: prediction.explanation
    }
  }

  /**
   * Given a prospect ID, performs cross-state entity resolution across the entire
   * ucc_filings table, discovers unlinked filings from other states, creates junction
   * links, and recalculates the updated `enrichment_confidence`.
   */
  async resolveAndEnrichProspect(
    prospectId: string,
    orgId: string
  ): Promise<{
    prospectId: string
    canonicalName: string
    states: string[]
    filingCount: number
    newlyLinkedFilings: number
    enrichment_confidence: number
    explanation: string
  }> {
    const prospectRows = await database.query<{
      id: string
      company_name: string
      company_name_normalized: string
      state: string
      enrichment_confidence: number | null
    }>(
      `SELECT id, company_name, company_name_normalized, state, enrichment_confidence
       FROM prospects WHERE id = $1 AND org_id = $2`,
      [prospectId, orgId]
    )

    if (prospectRows.length === 0) {
      throw new Error(`Prospect ${prospectId} not found`)
    }

    const prospect = prospectRows[0]
    const normalizedName =
      prospect.company_name_normalized || normalizeCompanyName(prospect.company_name)

    // Find candidate filings across ANY state in ucc_filings
    const candidateFilings = await database.query<{
      id: string
      debtor_name: string
      debtor_name_normalized: string
      secured_party: string
      state: string
      filing_date: string
      raw_data: Record<string, unknown> | null
    }>(
      `SELECT id, debtor_name, debtor_name_normalized, secured_party, state, filing_date, raw_data
       FROM ucc_filings
       WHERE debtor_name_normalized = $1
          OR debtor_name % $2
       LIMIT 50`,
      [normalizedName, prospect.company_name]
    )

    let newlyLinked = 0
    const matchedFilingIds: string[] = []
    const statesCovered = new Set<string>([prospect.state.toUpperCase()])

    for (const filing of candidateFilings) {
      const e1: CorporateRecordInput = {
        name: prospect.company_name,
        state: prospect.state
      }
      const e2: CorporateRecordInput = {
        id: filing.id,
        name: filing.debtor_name,
        state: filing.state,
        securedParty: filing.secured_party,
        filingDate: filing.filing_date
      }

      const features = this.model.extractCorporateFeatures(e1, e2)
      const pred = this.model.predictCorporateMatch(features)

      if (pred.isMatch || pred.enrichment_confidence >= 0.75) {
        matchedFilingIds.push(filing.id)
        statesCovered.add(filing.state.toUpperCase())

        // Insert link into prospect_ucc_filings
        const res = await database.query(
          `INSERT INTO prospect_ucc_filings (prospect_id, ucc_filing_id)
           VALUES ($1, $2)
           ON CONFLICT (prospect_id, ucc_filing_id) DO NOTHING`,
          [prospectId, filing.id]
        )
        // If inserted, count as newly linked
        if (res && (res as unknown as { rowCount?: number }).rowCount === 1) {
          newlyLinked++
        }
      }
    }

    // Compute updated confidence
    let confidence = 0.85
    if (statesCovered.size > 1) {
      confidence += 0.08 // Multi-state cross-validation bonus
    }
    if (matchedFilingIds.length >= 2) {
      confidence += 0.05
    }
    const finalConfidence = Number(Math.min(1.0, confidence).toFixed(2))

    await database.query(
      `UPDATE prospects
       SET enrichment_confidence = $2,
           last_enriched_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND org_id = $3`,
      [prospectId, finalConfidence, orgId]
    )

    return {
      prospectId,
      canonicalName: prospect.company_name,
      states: Array.from(statesCovered),
      filingCount: matchedFilingIds.length,
      newlyLinkedFilings: newlyLinked,
      enrichment_confidence: finalConfidence,
      explanation:
        statesCovered.size > 1
          ? `Multi-state enterprise resolved across ${statesCovered.size} states (${Array.from(statesCovered).join(', ')}) with ${matchedFilingIds.length} filings`
          : `Entity resolved with ${matchedFilingIds.length} state filings`
    }
  }

  /**
   * Pure entity-pair comparison for ad-hoc matching APIs or verification.
   */
  matchPair(e1: CorporateRecordInput, e2: CorporateRecordInput): ModelPrediction {
    const features = this.model.extractCorporateFeatures(e1, e2)
    return this.model.predictCorporateMatch(features)
  }
}

export const entityResolutionService = new EntityResolutionService()
