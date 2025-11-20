import type {
  Prospect,
  GrowthSignal,
  SignalChain,
  ChainedSignal,
  RecursiveSignalConfig,
  SignalType,
} from '../types'

/**
 * RecursiveSignalDetector - Detects signal chains and correlated growth patterns
 * Uses recursive search to find clusters of related signals
 */
export class RecursiveSignalDetector {
  private prospects: Prospect[]
  private signalDatabase: Map<string, GrowthSignal[]> = new Map()
  private detectedChains: Map<string, SignalChain[]> = new Map()

  constructor(prospects: Prospect[]) {
    this.prospects = prospects
    this.buildSignalDatabase()
  }

  /**
   * Build a searchable database of all signals
   */
  private buildSignalDatabase(): void {
    for (const prospect of this.prospects) {
      this.signalDatabase.set(prospect.id, prospect.growthSignals)
    }
  }

  /**
   * Detect signal chains recursively for a prospect
   */
  async detectSignalChains(
    prospectId: string,
    config: RecursiveSignalConfig
  ): Promise<SignalChain[]> {
    const prospect = this.prospects.find((p) => p.id === prospectId)
    if (!prospect) return []

    // Check cache
    const cached = this.detectedChains.get(prospectId)
    if (cached) return cached

    const chains: SignalChain[] = []

    // Start chain detection from each root signal
    for (const rootSignal of prospect.growthSignals) {
      const chain = await this.detectChainRecursively(
        prospect,
        rootSignal,
        [],
        0,
        config,
        new Set()
      )

      if (chain.chainedSignals.length > 0) {
        chains.push(chain)
      }
    }

    // Cache results
    this.detectedChains.set(prospectId, chains)

    return chains.sort((a, b) => b.chainStrength - a.chainStrength)
  }

  /**
   * Recursively detect chained signals
   */
  private async detectChainRecursively(
    prospect: Prospect,
    currentSignal: GrowthSignal,
    chainPath: string[],
    depth: number,
    config: RecursiveSignalConfig,
    visitedSignals: Set<string>
  ): Promise<SignalChain> {
    // Base cases
    if (depth >= config.maxDepth) {
      return this.buildChain(prospect.id, currentSignal, [], depth, chainPath)
    }

    if (visitedSignals.has(currentSignal.id)) {
      return this.buildChain(prospect.id, currentSignal, [], depth, chainPath)
    }

    visitedSignals.add(currentSignal.id)
    chainPath.push(`${currentSignal.type}@depth${depth}`)

    const chainedSignals: ChainedSignal[] = []

    // Get trigger rules for current signal type
    const triggeredTypes = config.signalTriggers[currentSignal.type] || []

    // Search for triggered signals
    for (const triggeredType of triggeredTypes) {
      // Find signals of the triggered type
      const triggeredSignals = prospect.growthSignals.filter(
        (s) =>
          s.type === triggeredType &&
          !visitedSignals.has(s.id) &&
          s.confidence >= config.minConfidence
      )

      for (const triggeredSignal of triggeredSignals) {
        // Calculate relationship confidence
        const relationshipConfidence = this.calculateRelationshipConfidence(
          currentSignal,
          triggeredSignal,
          'triggered_by'
        )

        if (relationshipConfidence >= config.minConfidence) {
          // Add to chain
          const chained: ChainedSignal = {
            signal: triggeredSignal,
            depth: depth + 1,
            parentSignalId: currentSignal.id,
            relationshipType: 'triggered_by',
            confidence: relationshipConfidence,
          }

          chainedSignals.push(chained)

          // Recursively search from this signal
          const subChain = await this.detectChainRecursively(
            prospect,
            triggeredSignal,
            [...chainPath],
            depth + 1,
            config,
            new Set(visitedSignals)
          )

          // Merge sub-chain signals
          chainedSignals.push(...subChain.chainedSignals)
        }
      }
    }

    // Search for correlated signals (same timeframe)
    const correlatedSignals = await this.findCorrelatedSignals(
      prospect,
      currentSignal,
      config,
      visitedSignals
    )

    chainedSignals.push(...correlatedSignals)

    // Search for implied signals (logical consequences)
    const impliedSignals = await this.findImpliedSignals(
      prospect,
      currentSignal,
      config,
      visitedSignals
    )

    chainedSignals.push(...impliedSignals)

    return this.buildChain(prospect.id, currentSignal, chainedSignals, depth, chainPath)
  }

  /**
   * Find signals correlated with the current signal
   */
  private async findCorrelatedSignals(
    prospect: Prospect,
    currentSignal: GrowthSignal,
    config: RecursiveSignalConfig,
    visitedSignals: Set<string>
  ): Promise<ChainedSignal[]> {
    const correlated: ChainedSignal[] = []

    // Find signals detected around the same time (within 30 days)
    const currentDate = new Date(currentSignal.detectedDate)
    const timeWindow = 30 * 24 * 60 * 60 * 1000 // 30 days in ms

    for (const signal of prospect.growthSignals) {
      if (visitedSignals.has(signal.id) || signal.id === currentSignal.id) continue

      const signalDate = new Date(signal.detectedDate)
      const timeDiff = Math.abs(currentDate.getTime() - signalDate.getTime())

      if (timeDiff <= timeWindow && signal.confidence >= config.minConfidence) {
        // Calculate correlation strength
        const correlation = this.calculateCorrelation(currentSignal, signal)

        if (correlation >= config.correlationThreshold) {
          correlated.push({
            signal,
            depth: 1,
            parentSignalId: currentSignal.id,
            relationshipType: 'correlated_with',
            confidence: correlation,
          })
        }
      }
    }

    return correlated
  }

  /**
   * Find signals implied by the current signal
   */
  private async findImpliedSignals(
    prospect: Prospect,
    currentSignal: GrowthSignal,
    config: RecursiveSignalConfig,
    visitedSignals: Set<string>
  ): Promise<ChainedSignal[]> {
    const implied: ChainedSignal[] = []

    // Define implication rules
    const implications: Record<SignalType, SignalType[]> = {
      hiring: ['expansion', 'equipment'], // Hiring implies need for space/equipment
      expansion: ['equipment', 'permit'], // Expansion needs equipment and permits
      permit: ['equipment'], // Permits often lead to equipment purchases
      contract: ['hiring', 'expansion'], // New contracts drive hiring and expansion
      equipment: [], // Equipment doesn't directly imply other signals
    }

    const impliedTypes = implications[currentSignal.type] || []

    for (const impliedType of impliedTypes) {
      const impliedSignals = prospect.growthSignals.filter(
        (s) =>
          s.type === impliedType &&
          !visitedSignals.has(s.id) &&
          s.confidence >= config.minConfidence
      )

      for (const impliedSignal of impliedSignals) {
        // Check if signal was detected after the implying signal
        const currentDate = new Date(currentSignal.detectedDate)
        const impliedDate = new Date(impliedSignal.detectedDate)

        if (impliedDate >= currentDate) {
          const implicationConfidence = this.calculateRelationshipConfidence(
            currentSignal,
            impliedSignal,
            'implies'
          )

          if (implicationConfidence >= config.minConfidence) {
            implied.push({
              signal: impliedSignal,
              depth: 1,
              parentSignalId: currentSignal.id,
              relationshipType: 'implies',
              confidence: implicationConfidence,
            })
          }
        }
      }
    }

    return implied
  }

  /**
   * Build a signal chain from collected signals
   */
  private buildChain(
    prospectId: string,
    rootSignal: GrowthSignal,
    chainedSignals: ChainedSignal[],
    maxDepth: number,
    discoveryPath: string[]
  ): SignalChain {
    // Calculate chain strength (weighted by confidence and depth)
    let totalConfidence = rootSignal.confidence
    let chainStrength = rootSignal.confidence

    for (const chained of chainedSignals) {
      const depthWeight = 1 / (chained.depth + 1) // Deeper signals weighted less
      totalConfidence += chained.confidence * depthWeight
      chainStrength += chained.signal.confidence * chained.confidence * depthWeight
    }

    // Normalize chain strength
    chainStrength = chainStrength / (chainedSignals.length + 1)
    totalConfidence = totalConfidence / (chainedSignals.length + 1)

    return {
      id: `chain-${prospectId}-${rootSignal.id}-${Date.now()}`,
      prospectId,
      rootSignal,
      chainedSignals,
      totalConfidence,
      chainStrength,
      discoveryPath,
      detectedAt: new Date().toISOString(),
    }
  }

  /**
   * Calculate relationship confidence between two signals
   */
  private calculateRelationshipConfidence(
    signal1: GrowthSignal,
    signal2: GrowthSignal,
    relationshipType: 'triggered_by' | 'correlated_with' | 'implies'
  ): number {
    let confidence = 0

    // Base confidence from individual signals
    confidence += (signal1.confidence + signal2.confidence) / 2

    // Adjust based on relationship type
    if (relationshipType === 'triggered_by') {
      // Check temporal ordering (signal2 should be after signal1)
      const date1 = new Date(signal1.detectedDate)
      const date2 = new Date(signal2.detectedDate)

      if (date2 > date1) {
        const daysDiff = (date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)
        // Optimal trigger window is 0-90 days
        if (daysDiff <= 90) {
          confidence *= 1.2 // Boost for good timing
        }
      } else {
        confidence *= 0.5 // Penalize reverse order
      }
    } else if (relationshipType === 'correlated_with') {
      // Already checked in findCorrelatedSignals
      confidence *= 1.0
    } else if (relationshipType === 'implies') {
      // Check logical consistency
      confidence *= 0.9 // Slightly conservative for implications
    }

    return Math.min(confidence, 1.0)
  }

  /**
   * Calculate correlation between two signals
   */
  private calculateCorrelation(signal1: GrowthSignal, signal2: GrowthSignal): number {
    let correlation = 0

    // Time proximity (closer = higher correlation)
    const date1 = new Date(signal1.detectedDate)
    const date2 = new Date(signal2.detectedDate)
    const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24)

    const timeCorrelation = Math.max(0, 1 - daysDiff / 30) // Max 30 days
    correlation += timeCorrelation * 0.4

    // Confidence similarity
    const confidenceDiff = Math.abs(signal1.confidence - signal2.confidence)
    const confidenceCorrelation = 1 - confidenceDiff
    correlation += confidenceCorrelation * 0.3

    // Signal type synergy
    const synergyScore = this.calculateSignalSynergy(signal1.type, signal2.type)
    correlation += synergyScore * 0.3

    return Math.min(correlation, 1.0)
  }

  /**
   * Calculate synergy between signal types
   */
  private calculateSignalSynergy(type1: SignalType, type2: SignalType): number {
    // Define synergy matrix
    const synergy: Record<SignalType, Partial<Record<SignalType, number>>> = {
      hiring: {
        expansion: 0.9,
        equipment: 0.8,
        contract: 0.7,
        permit: 0.6,
      },
      expansion: {
        hiring: 0.9,
        equipment: 0.8,
        permit: 0.9,
        contract: 0.6,
      },
      equipment: {
        expansion: 0.8,
        hiring: 0.7,
        permit: 0.7,
        contract: 0.5,
      },
      permit: {
        expansion: 0.9,
        equipment: 0.7,
        hiring: 0.6,
        contract: 0.5,
      },
      contract: {
        hiring: 0.8,
        expansion: 0.7,
        equipment: 0.6,
        permit: 0.5,
      },
    }

    return synergy[type1]?.[type2] || 0.3 // Default low synergy
  }

  /**
   * Analyze signal clusters across multiple prospects
   */
  async analyzeSignalClusters(
    config: RecursiveSignalConfig
  ): Promise<{
    clusters: Map<string, Prospect[]>
    patterns: {
      signalCombination: SignalType[]
      frequency: number
      avgConfidence: number
      prospects: string[]
    }[]
  }> {
    const clusters = new Map<string, Prospect[]>()
    const patternMap = new Map<string, {
      frequency: number
      totalConfidence: number
      prospects: string[]
    }>()

    // Analyze each prospect
    for (const prospect of this.prospects) {
      const chains = await this.detectSignalChains(prospect.id, config)

      // Group by signal combinations
      for (const chain of chains) {
        const signalTypes = [
          chain.rootSignal.type,
          ...chain.chainedSignals.map((s) => s.signal.type),
        ].sort()

        const key = signalTypes.join('+')

        // Add to cluster
        if (!clusters.has(key)) {
          clusters.set(key, [])
        }
        clusters.get(key)!.push(prospect)

        // Track pattern
        if (!patternMap.has(key)) {
          patternMap.set(key, {
            frequency: 0,
            totalConfidence: 0,
            prospects: [],
          })
        }

        const pattern = patternMap.get(key)!
        pattern.frequency++
        pattern.totalConfidence += chain.totalConfidence
        pattern.prospects.push(prospect.id)
      }
    }

    // Convert pattern map to array
    const patterns = Array.from(patternMap.entries())
      .map(([key, data]) => ({
        signalCombination: key.split('+') as SignalType[],
        frequency: data.frequency,
        avgConfidence: data.totalConfidence / data.frequency,
        prospects: data.prospects,
      }))
      .sort((a, b) => b.frequency - a.frequency)

    return { clusters, patterns }
  }

  /**
   * Predict likely next signals based on current signals
   */
  async predictNextSignals(
    prospectId: string,
    config: RecursiveSignalConfig
  ): Promise<{
    signalType: SignalType
    probability: number
    reasoning: string
    basedOn: GrowthSignal[]
  }[]> {
    const prospect = this.prospects.find((p) => p.id === prospectId)
    if (!prospect) return []

    const predictions: {
      signalType: SignalType
      probability: number
      reasoning: string
      basedOn: GrowthSignal[]
    }[] = []

    // Analyze current signals
    const currentSignalTypes = new Set(prospect.growthSignals.map((s) => s.type))

    // Check each possible signal type
    const allSignalTypes: SignalType[] = ['hiring', 'expansion', 'equipment', 'permit', 'contract']

    for (const signalType of allSignalTypes) {
      if (currentSignalTypes.has(signalType)) continue // Already detected

      // Calculate probability based on existing signals
      let probability = 0
      const basedOn: GrowthSignal[] = []
      const reasons: string[] = []

      for (const signal of prospect.growthSignals) {
        const triggers = config.signalTriggers[signal.type] || []

        if (triggers.includes(signalType)) {
          const contribution = signal.confidence * 0.3
          probability += contribution
          basedOn.push(signal)
          reasons.push(
            `${signal.type} signal (confidence: ${signal.confidence}) often triggers ${signalType}`
          )
        }

        // Check synergy
        const synergy = this.calculateSignalSynergy(signal.type, signalType)
        if (synergy > 0.6) {
          probability += synergy * 0.2
          reasons.push(`Strong synergy with ${signal.type} (${synergy.toFixed(2)})`)
        }
      }

      // Analyze historical patterns
      const historicalProbability = await this.calculateHistoricalProbability(
        currentSignalTypes,
        signalType
      )

      probability += historicalProbability * 0.3

      if (probability > 0.3) {
        predictions.push({
          signalType,
          probability: Math.min(probability, 1.0),
          reasoning: reasons.join('; '),
          basedOn,
        })
      }
    }

    return predictions.sort((a, b) => b.probability - a.probability)
  }

  /**
   * Calculate historical probability of signal appearing
   */
  private async calculateHistoricalProbability(
    currentSignals: Set<SignalType>,
    targetSignal: SignalType
  ): Promise<number> {
    let matchCount = 0
    let totalCount = 0

    for (const prospect of this.prospects) {
      const prospectSignals = new Set(prospect.growthSignals.map((s) => s.type))

      // Check if prospect has similar current signals
      const overlap = [...currentSignals].filter((s) => prospectSignals.has(s)).length
      const similarity = overlap / Math.max(currentSignals.size, prospectSignals.size)

      if (similarity > 0.5) {
        totalCount++
        if (prospectSignals.has(targetSignal)) {
          matchCount++
        }
      }
    }

    return totalCount > 0 ? matchCount / totalCount : 0
  }

  /**
   * Get default signal trigger configuration
   */
  static getDefaultConfig(): RecursiveSignalConfig {
    return {
      maxDepth: 3,
      minConfidence: 0.5,
      signalTriggers: {
        hiring: ['expansion', 'equipment'],
        expansion: ['equipment', 'permit', 'hiring'],
        equipment: ['hiring'],
        permit: ['equipment', 'expansion'],
        contract: ['hiring', 'expansion'],
      },
      correlationThreshold: 0.6,
    }
  }
}
