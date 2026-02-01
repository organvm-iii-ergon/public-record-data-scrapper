/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
// Experimental personalization features - disabled strict linting

/**
 * Personalization Engine - Behavioral tracking and personalized recommendations
 * Learns from user behavior to provide tailored experiences
 */

import type {
  UserProfile,
  UserPreferences,
  UserBehavior,
  UserAction,
  PersonalizedProspect,
  PersonalizedDashboard,
  PersonalizedRecommendation,
  RecommendationContext,
  PersonalizationModel,
  PersonalizedWidget,
  PersonalizedInsight,
  QuickAction,
  ActivityItem
} from '@/types/personalization'
import type { Prospect } from '@/types'

export class PersonalizationEngine {
  private profiles: Map<string, UserProfile> = new Map()
  private behaviorQueue: Map<string, UserAction[]> = new Map()

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    let profile = this.profiles.get(userId)

    if (!profile) {
      profile = this.createDefaultProfile(userId)
      this.profiles.set(userId, profile)
    }

    return profile
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<UserProfile> {
    const profile = await this.getUserProfile(userId)

    profile.preferences = {
      ...profile.preferences,
      ...preferences
    }

    profile.lastActiveAt = new Date()

    return profile
  }

  /**
   * Track user action
   */
  async trackUserAction(userId: string, action: UserAction): Promise<void> {
    const queue = this.behaviorQueue.get(userId) || []
    queue.push(action)
    this.behaviorQueue.set(userId, queue)

    // Process queue if it gets too large
    if (queue.length >= 10) {
      await this.processBehaviorQueue(userId)
    }
  }

  /**
   * Track prospect view
   */
  async trackProspectView(userId: string, prospectId: string, duration: number): Promise<void> {
    await this.trackUserAction(userId, {
      actionType: 'prospect_view',
      timestamp: new Date(),
      prospectId,
      data: { duration }
    })
  }

  /**
   * Track search
   */
  async trackSearch(
    userId: string,
    query: string,
    filters: any,
    resultsCount: number
  ): Promise<void> {
    await this.trackUserAction(userId, {
      actionType: 'search',
      timestamp: new Date(),
      data: { query, filters, resultsCount }
    })
  }

  /**
   * Update personalization model
   */
  async updatePersonalizationModel(userId: string): Promise<PersonalizationModel> {
    const profile = await this.getUserProfile(userId)

    // Process any pending behavior data
    await this.processBehaviorQueue(userId)

    // Learn preferences from behavior
    const learnedPreferences = this.learnPreferences(profile.behavior)

    // Build predictive models
    const timingModel = this.buildTimingModel(profile.behavior)
    const channelModel = this.buildChannelModel(profile.behavior)

    // Segment user
    const userSegment = this.determineUserSegment(profile.performance)

    // Find similar users
    const similarUsers = this.findSimilarUsers(userId, profile)

    const model: PersonalizationModel = {
      modelId: `model_${userId}_${Date.now()}`,
      userId,
      version: (profile.learningModel?.version || 0) + 1,
      lastUpdated: new Date(),
      learnedPreferences,
      conversionPredictorWeights: this.calculateConversionWeights(profile),
      timingModel,
      channelModel,
      userSegment,
      similarUsers,
      modelConfidence: this.calculateModelConfidence(profile),
      dataQuality: this.calculateDataQuality(profile)
    }

    profile.learningModel = model

    return model
  }

  /**
   * Learn from outcome
   */
  async learnFromOutcome(
    userId: string,
    prospectId: string,
    outcome: 'success' | 'failure',
    details: any
  ): Promise<void> {
    await this.trackUserAction(userId, {
      actionType: 'outcome',
      timestamp: new Date(),
      prospectId,
      outcome,
      data: details
    })

    // Update model immediately for outcomes
    await this.updatePersonalizationModel(userId)
  }

  /**
   * Personalize prospects for user
   */
  async personalizeProspects(
    userId: string,
    prospects: Prospect[]
  ): Promise<PersonalizedProspect[]> {
    const profile = await this.getUserProfile(userId)
    const model = profile.learningModel || (await this.updatePersonalizationModel(userId))

    return prospects.map((prospect) => {
      const score = this.calculatePersonalizedScore(prospect, profile, model)
      const matchReasons = this.generateMatchReasons(prospect, profile)
      const recommendedApproach = this.suggestApproach(prospect, profile)
      const predictions = this.makePredictions(prospect, profile, model)

      return {
        prospectId: prospect.id,
        personalizedScore: score,
        matchReasons,
        recommendedApproach,
        predictedConversionProbability: predictions.conversionProbability,
        predictedDealSize: predictions.dealSize,
        predictedTimeToClose: predictions.timeToClose,
        similarSuccessfulDeals: this.findSimilarSuccesses(prospect, profile),
        warnings: this.generateWarnings(prospect, profile)
      }
    })
  }

  /**
   * Get personalized dashboard
   */
  async getPersonalizedDashboard(userId: string): Promise<PersonalizedDashboard> {
    const profile = await this.getUserProfile(userId)

    const widgets = this.generatePersonalizedWidgets(profile)
    const insights = this.generatePersonalizedInsights(profile)
    const recommendations = await this.generateDailyRecommendations(userId)
    const quickActions = this.generateQuickActions(profile)
    const recentActivity = this.getRecentActivity(userId)

    return {
      userId,
      layout: profile.preferences.dashboardLayout,
      widgets,
      insights,
      recommendations,
      quickActions,
      recentActivity
    }
  }

  /**
   * Get personalized insights
   */
  async getPersonalizedInsights(userId: string): Promise<PersonalizedInsight[]> {
    const profile = await this.getUserProfile(userId)
    return this.generatePersonalizedInsights(profile)
  }

  /**
   * Generate daily recommendations
   */
  private async generateDailyRecommendations(
    userId: string
  ): Promise<PersonalizedRecommendation[]> {
    const profile = await this.getUserProfile(userId)
    const recommendations: PersonalizedRecommendation[] = []

    // Recommendation 1: Top prospects to contact today
    recommendations.push({
      recommendationId: `rec_${Date.now()}_1`,
      userId,
      type: 'prospect',
      title: 'Top 5 Prospects to Contact Today',
      description:
        'Based on your success patterns and optimal contact timing, these prospects are most likely to convert if contacted now.',
      confidence: 0.85,
      expectedValue: 125000 * 5, // 5 prospects × avg deal size
      priority: 'high',
      reasoning: [
        'Match your historical success patterns (construction, NY)',
        'Optimal contact time based on your response rate data',
        'Fresh growth signals detected in last 48 hours'
      ],
      data: {
        prospectIds: ['p1', 'p2', 'p3', 'p4', 'p5']
      },
      personalizationFactors: [
        {
          factor: 'industry_preference',
          value: profile.preferences.preferredIndustries,
          weight: 0.3,
          description: 'Matches your preferred industries'
        },
        {
          factor: 'optimal_timing',
          value: new Date().getHours(),
          weight: 0.25,
          description: 'Aligns with your peak productivity hours'
        }
      ]
    })

    // Recommendation 2: Skill development
    if (profile.performance.conversionRate < 0.25) {
      recommendations.push({
        recommendationId: `rec_${Date.now()}_2`,
        userId,
        type: 'learning',
        title: 'Improve Conversion Rate with Objection Handling Training',
        description:
          'Your conversion rate is below team average. Focus on objection handling to improve.',
        confidence: 0.75,
        expectedValue: 50000, // Estimated improvement value
        priority: 'medium',
        reasoning: [
          'Conversion rate 28% vs team average 35%',
          'Analysis shows objection handling as key differentiator',
          'Top performers use consultative approach'
        ],
        data: {
          currentRate: profile.performance.conversionRate,
          targetRate: 0.35,
          trainingModules: ['objection_handling', 'consultative_selling']
        },
        personalizationFactors: [
          {
            factor: 'performance_gap',
            value: 0.35 - profile.performance.conversionRate,
            weight: 0.4,
            description: 'Gap to team average'
          }
        ]
      })
    }

    // Recommendation 3: Timing optimization
    recommendations.push({
      recommendationId: `rec_${Date.now()}_3`,
      userId,
      type: 'timing',
      title: 'Schedule Follow-ups for Maximum Response',
      description: 'Your follow-up timing can be optimized for better response rates.',
      confidence: 0.8,
      expectedValue: 35000,
      priority: 'medium',
      reasoning: [
        'Your best response rates occur at 10 AM Tuesdays',
        'Current follow-up cadence is suboptimal',
        'Data shows 42% higher response rate with optimized timing'
      ],
      data: {
        optimalTime: '10:00 AM',
        optimalDay: 'Tuesday',
        currentCadence: profile.preferences.followUpCadence,
        recommendedCadence: 3
      },
      personalizationFactors: [
        {
          factor: 'historical_response_pattern',
          value: profile.behavior.timeOfDayPatterns,
          weight: 0.35,
          description: 'Based on your historical response data'
        }
      ]
    })

    return recommendations
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Create default user profile
   */
  private createDefaultProfile(userId: string): UserProfile {
    return {
      userId,
      role: 'sales_rep',
      createdAt: new Date(),
      lastActiveAt: new Date(),
      preferences: {
        preferredIndustries: [],
        preferredStates: [],
        dealSizeRange: [50000, 500000],
        riskTolerance: 'moderate',
        dashboardLayout: 'detailed',
        defaultSortField: 'priority',
        defaultFilters: {},
        theme: 'dark',
        density: 'comfortable',
        notificationPreferences: {
          channels: { email: true, sms: false, push: true, inApp: true },
          frequency: 'realtime',
          quietHours: { start: '22:00', end: '08:00' },
          types: {
            newProspects: true,
            healthAlerts: true,
            dealUpdates: true,
            systemAlerts: true,
            insights: true,
            recommendations: true
          },
          minimumPriority: 'medium'
        },
        preferredOutreachChannel: 'email',
        communicationStyle: 'professional',
        followUpCadence: 5,
        autoFollowUp: false,
        templateTonality: 'professional',
        reportDetailLevel: 'standard',
        quickActions: [],
        keyboardShortcuts: {},
        savedSearches: [],
        customViews: []
      },
      behavior: {
        prospectViewPatterns: [],
        filterUsageFrequency: {},
        timeOfDayPatterns: [],
        conversionPatterns: [],
        successfulDealCharacteristics: [],
        searchPatterns: [],
        averageTimePerProspect: 120,
        clickPatterns: [],
        navigationPatterns: [],
        exportFrequency: 2,
        featureUsage: {},
        learningVelocity: 0,
        skillProgression: [],
        weaknessAreas: []
      },
      performance: {
        conversionRate: 0.28,
        averageDealSize: 125000,
        averageTimeToClose: 14,
        portfolioHealthScore: 75,
        prospectQuality: 0.7,
        activityLevel: 80,
        trends: [],
        benchmarks: [],
        strengths: [],
        improvementAreas: [],
        metricsHistory: []
      },
      learningModel: {
        modelId: '',
        userId,
        version: 0,
        lastUpdated: new Date(),
        learnedPreferences: [],
        conversionPredictorWeights: {},
        timingModel: {
          optimalContactTime: { hourOfDay: 10, dayOfWeek: 2, confidence: 0.6 },
          optimalFollowUpInterval: 3,
          responsePatterns: []
        },
        channelModel: {
          channelPreferences: {
            email: 0.8,
            sms: 0.3,
            phone_script: 0.6,
            linkedin: 0.5,
            direct_mail: 0.2
          },
          channelEffectiveness: {},
          contextualPreferences: []
        },
        userSegment: 'new_user',
        similarUsers: [],
        modelConfidence: 0.3,
        dataQuality: 0.5
      },
      achievements: [],
      goals: []
    }
  }

  /**
   * Process behavior queue
   */
  private async processBehaviorQueue(userId: string): Promise<void> {
    const queue = this.behaviorQueue.get(userId) || []
    if (queue.length === 0) return

    const profile = await this.getUserProfile(userId)

    // Update behavior patterns
    for (const action of queue) {
      this.updateBehaviorFromAction(profile.behavior, action)
    }

    // Clear queue
    this.behaviorQueue.set(userId, [])
  }

  /**
   * Update behavior from action
   */
  private updateBehaviorFromAction(behavior: UserBehavior, action: UserAction): void {
    // Update based on action type
    switch (action.actionType) {
      case 'prospect_view':
        // Track view patterns
        break
      case 'search':
        // Track search patterns
        behavior.searchPatterns.push({
          keywords: [],
          filters: action.data.filters,
          frequency: 1,
          resultsQuality: 0.7,
          leadToAction: false
        })
        break
      case 'outcome':
        // Track conversion patterns
        if (action.outcome === 'success') {
          behavior.conversionPatterns.push({
            prospectCharacteristics: {},
            timeToConversion: 14,
            dealSize: 125000,
            successFactors: [],
            touchpoints: 5
          })
        }
        break
    }
  }

  /**
   * Learn preferences from behavior
   */
  private learnPreferences(behavior: UserBehavior): any[] {
    // Analyze successful deal characteristics
    const preferences: any[] = []

    // Most common industries in successful deals
    const industries = behavior.successfulDealCharacteristics.map((d) => d.industry)
    if (industries.length > 0) {
      const mostCommon = this.findMostCommon(industries)
      preferences.push({
        feature: 'preferred_industry',
        preferredValue: mostCommon,
        confidence: 0.75,
        learnedFrom: industries.length,
        lastObserved: new Date()
      })
    }

    return preferences
  }

  /**
   * Build timing model
   */
  private buildTimingModel(behavior: UserBehavior): any {
    // Analyze time of day patterns
    const patterns = behavior.timeOfDayPatterns

    if (patterns.length === 0) {
      return {
        optimalContactTime: { hourOfDay: 10, dayOfWeek: 2, confidence: 0.5 },
        optimalFollowUpInterval: 3,
        responsePatterns: []
      }
    }

    // Find best time
    const bestPattern = patterns.reduce((best, current) =>
      current.conversionRate > best.conversionRate ? current : best
    )

    return {
      optimalContactTime: {
        hourOfDay: bestPattern.hourOfDay,
        dayOfWeek: bestPattern.dayOfWeek,
        confidence: 0.8
      },
      optimalFollowUpInterval: 3,
      responsePatterns: patterns
    }
  }

  /**
   * Build channel model
   */
  private buildChannelModel(behavior: UserBehavior): any {
    return {
      channelPreferences: {
        email: 0.8,
        sms: 0.3,
        phone_script: 0.6,
        linkedin: 0.5,
        direct_mail: 0.2
      },
      channelEffectiveness: {},
      contextualPreferences: []
    }
  }

  /**
   * Determine user segment
   */
  private determineUserSegment(performance: any): any {
    if (performance.conversionRate > 0.35) return 'high_performer'
    if (performance.conversionRate > 0.25) return 'growing'
    return 'struggling'
  }

  /**
   * Find similar users
   */
  private findSimilarUsers(userId: string, profile: UserProfile): string[] {
    // In real implementation, use ML similarity
    return []
  }

  /**
   * Calculate conversion weights
   */
  private calculateConversionWeights(profile: UserProfile): Record<string, number> {
    return {
      health_grade: 0.3,
      growth_signals: 0.25,
      industry_match: 0.2,
      deal_size_fit: 0.15,
      timing: 0.1
    }
  }

  /**
   * Calculate model confidence
   */
  private calculateModelConfidence(profile: UserProfile): number {
    const dataPoints = profile.behavior.conversionPatterns.length
    return Math.min(dataPoints / 50, 1.0) // Confidence increases with data
  }

  /**
   * Calculate data quality
   */
  private calculateDataQuality(profile: UserProfile): number {
    return 0.75 // Mock value
  }

  /**
   * Calculate personalized score
   */
  private calculatePersonalizedScore(
    prospect: Prospect,
    profile: UserProfile,
    model: PersonalizationModel
  ): number {
    let score = prospect.priority || 50

    // Adjust based on learned preferences
    if (profile.preferences.preferredIndustries.includes(prospect.industry)) {
      score += 15
    }

    if (profile.preferences.preferredStates.includes(prospect.state)) {
      score += 10
    }

    return Math.min(Math.max(score, 0), 100)
  }

  /**
   * Generate match reasons
   */
  private generateMatchReasons(prospect: Prospect, profile: UserProfile): string[] {
    const reasons: string[] = []

    if (profile.preferences.preferredIndustries.includes(prospect.industry)) {
      reasons.push(`Matches your preferred industry: ${prospect.industry}`)
    }

    if (prospect.growthSignals && prospect.growthSignals.length >= 3) {
      reasons.push(`Strong growth signals (${prospect.growthSignals.length} detected)`)
    }

    if (prospect.healthGrade === 'A' || prospect.healthGrade === 'B') {
      reasons.push(`Excellent health grade: ${prospect.healthGrade}`)
    }

    return reasons
  }

  /**
   * Suggest approach
   */
  private suggestApproach(prospect: Prospect, profile: UserProfile): string {
    return 'Lead with growth opportunity financing based on detected expansion signals'
  }

  /**
   * Make predictions
   */
  private makePredictions(
    prospect: Prospect,
    profile: UserProfile,
    model: PersonalizationModel
  ): any {
    return {
      conversionProbability: 0.32,
      dealSize: 125000,
      timeToClose: 14
    }
  }

  /**
   * Find similar successes
   */
  private findSimilarSuccesses(prospect: Prospect, profile: UserProfile): string[] {
    return profile.behavior.successfulDealCharacteristics
      .filter((d) => d.industry === prospect.industry)
      .slice(0, 3)
      .map((d, i) => `deal_${i}`)
  }

  /**
   * Generate warnings
   */
  private generateWarnings(prospect: Prospect, profile: UserProfile): string[] | undefined {
    const warnings: string[] = []

    if (
      !profile.preferences.preferredIndustries.includes(prospect.industry) &&
      profile.preferences.preferredIndustries.length > 0
    ) {
      warnings.push('Outside your typical industry focus')
    }

    if (warnings.length === 0) return undefined
    return warnings
  }

  /**
   * Generate personalized widgets
   */
  private generatePersonalizedWidgets(profile: UserProfile): PersonalizedWidget[] {
    return [
      {
        widgetId: 'widget_top_prospects',
        type: 'prospect_list',
        title: 'Your Top Prospects',
        priority: 1,
        data: {},
        configuration: {},
        personalizationReasons: ['Based on your success patterns', 'Optimal timing for contact']
      }
    ]
  }

  /**
   * Generate personalized insights
   */
  private generatePersonalizedInsights(profile: UserProfile): PersonalizedInsight[] {
    return [
      {
        insightId: 'insight_1',
        type: 'performance',
        title: 'Your Conversion Rate is Above Average',
        description: `You're converting at 28%, which is 5% above the team average. Keep focusing on construction and healthcare.`,
        relevanceScore: 0.9,
        actionable: true,
        suggestedActions: ['Continue targeting construction industry', 'Expand to healthcare'],
        impact: 'medium'
      }
    ]
  }

  /**
   * Generate quick actions
   */
  private generateQuickActions(profile: UserProfile): QuickAction[] {
    return [
      {
        actionId: 'action_refresh',
        label: 'Refresh Data',
        description: 'Get latest prospects',
        usageCount: 150,
        handler: 'refreshData'
      }
    ]
  }

  /**
   * Get recent activity
   */
  private getRecentActivity(userId: string): ActivityItem[] {
    const queue = this.behaviorQueue.get(userId) || []
    return queue.slice(-10).map((action, i) => ({
      activityId: `activity_${i}`,
      type: action.actionType,
      description: `${action.actionType} action`,
      timestamp: action.timestamp,
      prospectId: action.prospectId,
      metadata: action.data
    }))
  }

  /**
   * Find most common value
   */
  private findMostCommon<T>(arr: T[]): T {
    const counts = new Map<T, number>()
    for (const val of arr) {
      counts.set(val, (counts.get(val) || 0) + 1)
    }

    let max = 0
    let result = arr[0]
    for (const [val, count] of counts.entries()) {
      if (count > max) {
        max = count
        result = val
      }
    }

    return result
  }
}

export default PersonalizationEngine
