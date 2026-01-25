/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  UserProfile,
  SavedFilter,
  DashboardLayout,
  NotificationSettings,
  ClaimPattern,
  IndustryType,
  HealthGrade,
  SignalType,
  ProspectStatus
} from '../types'
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * UserProfileManager - Manages user profiles, preferences, and personalization
 * Provides persistence and learning from user behavior
 */
export class UserProfileManager {
  private profiles: Map<string, UserProfile> = new Map()
  private storageKey = 'user-profiles'

  constructor() {
    this.loadProfiles()
  }

  /**
   * Get or create user profile
   */
  getUserProfile(userId: string): UserProfile {
    let profile = this.profiles.get(userId)

    if (!profile) {
      profile = this.createDefaultProfile(userId)
      this.profiles.set(userId, profile)
      this.saveProfiles()
    }

    return profile
  }

  /**
   * Create default user profile
   */
  private createDefaultProfile(userId: string): UserProfile {
    return {
      userId,
      preferences: {
        industries: [],
        states: [],
        minPriorityScore: 60,
        minHealthGrade: 'C',
        preferredSignalTypes: [],
        riskTolerance: 'medium'
      },
      behavior: {
        claimPatterns: [],
        conversionRate: 0,
        avgTimeToContact: 0,
        successfulIndustries: [],
        preferredDealSize: { min: 100000, max: 5000000 }
      },
      customFilters: [],
      dashboardLayout: this.getDefaultDashboardLayout(),
      notificationSettings: this.getDefaultNotificationSettings(),
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    }
  }

  /**
   * Update user preferences
   */
  updatePreferences(userId: string, preferences: Partial<UserProfile['preferences']>): UserProfile {
    const profile = this.getUserProfile(userId)

    profile.preferences = {
      ...profile.preferences,
      ...preferences
    }

    profile.lastActive = new Date().toISOString()
    this.saveProfiles()

    return profile
  }

  /**
   * Record user action for behavior learning
   */
  recordAction(
    userId: string,
    action: {
      type: 'claim' | 'unclaim' | 'contact' | 'qualify' | 'dismiss'
      prospectId: string
      prospectData: {
        industry: IndustryType
        priorityScore: number
        signalTypes: SignalType[]
        estimatedRevenue?: number
      }
      outcome?: 'success' | 'failure'
    }
  ): UserProfile {
    const profile = this.getUserProfile(userId)

    // Update claim patterns
    if (action.type === 'claim') {
      this.updateClaimPatterns(profile, action.prospectData)
    }

    // Update conversion rate
    if (action.type === 'qualify' && action.outcome) {
      this.updateConversionRate(profile, action.outcome === 'success')

      if (action.outcome === 'success') {
        // Add to successful industries
        if (!profile.behavior.successfulIndustries.includes(action.prospectData.industry)) {
          profile.behavior.successfulIndustries.push(action.prospectData.industry)
        }
      }
    }

    // Update preferred deal size
    if (action.prospectData.estimatedRevenue) {
      this.updatePreferredDealSize(profile, action.prospectData.estimatedRevenue)
    }

    profile.lastActive = new Date().toISOString()
    this.saveProfiles()

    return profile
  }

  /**
   * Update claim patterns
   */
  private updateClaimPatterns(
    profile: UserProfile,
    prospectData: {
      industry: IndustryType
      priorityScore: number
      signalTypes: SignalType[]
    }
  ): void {
    // Find matching pattern
    const existingPattern = profile.behavior.claimPatterns.find((p) =>
      p.industries.includes(prospectData.industry)
    )

    if (existingPattern) {
      // Update existing pattern
      existingPattern.frequency++
      existingPattern.avgScore =
        (existingPattern.avgScore * (existingPattern.frequency - 1) + prospectData.priorityScore) /
        existingPattern.frequency

      // Merge signal types
      existingPattern.signalTypes = [
        ...new Set([...existingPattern.signalTypes, ...prospectData.signalTypes])
      ]
    } else {
      // Create new pattern
      profile.behavior.claimPatterns.push({
        industries: [prospectData.industry],
        avgScore: prospectData.priorityScore,
        signalTypes: prospectData.signalTypes,
        outcomeRate: 0.5, // Neutral until we have outcomes
        frequency: 1
      })
    }
  }

  /**
   * Update conversion rate
   */
  private updateConversionRate(profile: UserProfile, success: boolean): void {
    const totalClaims = profile.behavior.claimPatterns.reduce((sum, p) => sum + p.frequency, 0)

    if (totalClaims === 0) {
      profile.behavior.conversionRate = success ? 1 : 0
    } else {
      const successCount = profile.behavior.conversionRate * totalClaims
      profile.behavior.conversionRate = (successCount + (success ? 1 : 0)) / (totalClaims + 1)
    }
  }

  /**
   * Update preferred deal size
   */
  private updatePreferredDealSize(profile: UserProfile, dealSize: number): void {
    const current = profile.behavior.preferredDealSize

    // Expand range to include new deal size
    if (dealSize < current.min) {
      current.min = Math.floor(dealSize * 0.9) // 10% buffer
    }

    if (dealSize > current.max) {
      current.max = Math.ceil(dealSize * 1.1) // 10% buffer
    }
  }

  /**
   * Save a custom filter
   */
  saveFilter(
    userId: string,
    filter: {
      name: string
      filters: SavedFilter['filters']
      isDefault?: boolean
    }
  ): UserProfile {
    const profile = this.getUserProfile(userId)

    // If setting as default, unset other defaults
    if (filter.isDefault) {
      profile.customFilters.forEach((f) => (f.isDefault = false))
    }

    const savedFilter: SavedFilter = {
      id: `filter-${Date.now()}`,
      name: filter.name,
      filters: filter.filters,
      isDefault: filter.isDefault || false,
      createdAt: new Date().toISOString(),
      usageCount: 0
    }

    profile.customFilters.push(savedFilter)
    profile.lastActive = new Date().toISOString()
    this.saveProfiles()

    return profile
  }

  /**
   * Delete a saved filter
   */
  deleteFilter(userId: string, filterId: string): UserProfile {
    const profile = this.getUserProfile(userId)

    profile.customFilters = profile.customFilters.filter((f) => f.id !== filterId)
    profile.lastActive = new Date().toISOString()
    this.saveProfiles()

    return profile
  }

  /**
   * Increment filter usage
   */
  useFilter(userId: string, filterId: string): void {
    const profile = this.getUserProfile(userId)
    const filter = profile.customFilters.find((f) => f.id === filterId)

    if (filter) {
      filter.usageCount++
      this.saveProfiles()
    }
  }

  /**
   * Update dashboard layout
   */
  updateDashboardLayout(userId: string, layout: DashboardLayout): UserProfile {
    const profile = this.getUserProfile(userId)

    profile.dashboardLayout = layout
    profile.lastActive = new Date().toISOString()
    this.saveProfiles()

    return profile
  }

  /**
   * Update notification settings
   */
  updateNotificationSettings(userId: string, settings: Partial<NotificationSettings>): UserProfile {
    const profile = this.getUserProfile(userId)

    profile.notificationSettings = {
      ...profile.notificationSettings,
      ...settings
    }

    profile.lastActive = new Date().toISOString()
    this.saveProfiles()

    return profile
  }

  /**
   * Get default dashboard layout
   */
  private getDefaultDashboardLayout(): DashboardLayout {
    return {
      widgets: [
        {
          id: 'prospects',
          type: 'prospects',
          position: { x: 0, y: 0 },
          size: { width: 12, height: 6 },
          config: {}
        },
        {
          id: 'stats',
          type: 'stats',
          position: { x: 0, y: 6 },
          size: { width: 6, height: 3 },
          config: {}
        },
        {
          id: 'signals',
          type: 'signals',
          position: { x: 6, y: 6 },
          size: { width: 6, height: 3 },
          config: {}
        }
      ],
      columns: 12,
      theme: 'auto'
    }
  }

  /**
   * Get default notification settings
   */
  private getDefaultNotificationSettings(): NotificationSettings {
    return {
      newProspects: true,
      healthAlerts: true,
      signalDetection: true,
      portfolioUpdates: true,
      competitorActivity: false,
      requalificationOpportunities: true,
      aiInsights: true,
      channels: {
        email: false,
        inApp: true,
        push: false
      }
    }
  }

  /**
   * Learn preferences from behavior
   */
  learnPreferences(userId: string): UserProfile {
    const profile = this.getUserProfile(userId)

    // Learn preferred industries from claim patterns
    const industryFrequency = new Map<IndustryType, number>()
    for (const pattern of profile.behavior.claimPatterns) {
      for (const industry of pattern.industries) {
        industryFrequency.set(industry, (industryFrequency.get(industry) || 0) + pattern.frequency)
      }
    }

    // Set top 3 industries as preferred
    const topIndustries = Array.from(industryFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([industry]) => industry)

    if (topIndustries.length > 0) {
      profile.preferences.industries = topIndustries
    }

    // Learn preferred signal types from successful patterns
    const signalFrequency = new Map<SignalType, number>()
    for (const pattern of profile.behavior.claimPatterns) {
      if (pattern.outcomeRate > 0.6) {
        // Only successful patterns
        for (const signalType of pattern.signalTypes) {
          signalFrequency.set(
            signalType,
            (signalFrequency.get(signalType) || 0) + pattern.frequency
          )
        }
      }
    }

    const topSignals = Array.from(signalFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([signal]) => signal)

    if (topSignals.length > 0) {
      profile.preferences.preferredSignalTypes = topSignals
    }

    // Learn minimum priority score from successful claims
    const successfulPatterns = profile.behavior.claimPatterns.filter((p) => p.outcomeRate > 0.6)
    if (successfulPatterns.length > 0) {
      const avgSuccessScore =
        successfulPatterns.reduce((sum, p) => sum + p.avgScore, 0) / successfulPatterns.length
      profile.preferences.minPriorityScore = Math.floor(avgSuccessScore * 0.9) // 10% buffer
    }

    profile.lastActive = new Date().toISOString()
    this.saveProfiles()

    return profile
  }

  /**
   * Get profile analytics
   */
  getProfileAnalytics(userId: string): {
    totalActions: number
    mostFrequentIndustry: IndustryType | null
    avgClaimScore: number
    preferredSignals: SignalType[]
    conversionRate: number
  } {
    const profile = this.getUserProfile(userId)

    const totalActions = profile.behavior.claimPatterns.reduce((sum, p) => sum + p.frequency, 0)

    let mostFrequentIndustry: IndustryType | null = null
    let maxFrequency = 0

    for (const pattern of profile.behavior.claimPatterns) {
      if (pattern.frequency > maxFrequency) {
        maxFrequency = pattern.frequency
        mostFrequentIndustry = pattern.industries[0]
      }
    }

    const avgClaimScore =
      totalActions > 0
        ? profile.behavior.claimPatterns.reduce((sum, p) => sum + p.avgScore * p.frequency, 0) /
          totalActions
        : 0

    return {
      totalActions,
      mostFrequentIndustry,
      avgClaimScore,
      preferredSignals: profile.preferences.preferredSignalTypes,
      conversionRate: profile.behavior.conversionRate
    }
  }

  /**
   * Load profiles from storage
   */
  private loadProfiles(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        this.profiles = new Map(Object.entries(data))
      }
    } catch (error) {
      console.error('Error loading user profiles:', error)
    }
  }

  /**
   * Save profiles to storage
   */
  private saveProfiles(): void {
    try {
      const data = Object.fromEntries(this.profiles.entries())
      localStorage.setItem(this.storageKey, JSON.stringify(data))
    } catch (error) {
      console.error('Error saving user profiles:', error)
    }
  }

  /**
   * Export profile data
   */
  exportProfile(userId: string): string {
    const profile = this.getUserProfile(userId)
    return JSON.stringify(profile, null, 2)
  }

  /**
   * Import profile data
   */
  importProfile(userId: string, profileData: string): UserProfile {
    try {
      const profile = JSON.parse(profileData) as UserProfile
      profile.userId = userId // Ensure correct user ID
      profile.lastActive = new Date().toISOString()

      this.profiles.set(userId, profile)
      this.saveProfiles()

      return profile
    } catch {
      throw new Error('Invalid profile data')
    }
  }
}
