/**
 * UX Enhancer Agent
 * 
 * Analyzes user experience and suggests improvements.
 */

import { BaseAgent } from '../BaseAgent'
import { AgentAnalysis, SystemContext, Finding, ImprovementSuggestion } from '../types'

export class UXEnhancerAgent extends BaseAgent {
  constructor() {
    super('ux-enhancer', 'UX Enhancer', [
      'User experience analysis',
      'Interaction pattern detection',
      'Usability improvement',
      'Accessibility checking',
      'Interface optimization'
    ])
  }

  async analyze(context: SystemContext): Promise<AgentAnalysis> {
    const findings: Finding[] = []
    const improvements: ImprovementSuggestion[] = []

    // Analyze user interactions
    const uxChecks = this.analyzeUserExperience(context)
    findings.push(...uxChecks)

    // Check user satisfaction
    if (context.performanceMetrics.userSatisfactionScore < 7) {
      improvements.push(this.suggestUXImprovement())
    }

    // Suggest workflow improvements
    const workflowImprovement = this.analyzeWorkflowEfficiency(context)
    if (workflowImprovement) {
      improvements.push(workflowImprovement)
    }

    return this.createAnalysis(findings, improvements)
  }

  private analyzeUserExperience(context: SystemContext): Finding[] {
    const findings: Finding[] = []

    // Check for repeated actions (indicating poor UX)
    const actionCounts = new Map<string, number>()
    context.userActions.forEach(action => {
      actionCounts.set(action.type, (actionCounts.get(action.type) || 0) + 1)
    })

    actionCounts.forEach((count, actionType) => {
      if (count > 100 && actionType === 'search') {
        findings.push(this.createFinding(
          'usability',
          'info',
          `High frequency of search operations (${count}), users may have difficulty finding prospects`,
          { actionType, count, suggestion: 'improve-filtering' }
        ))
      }
    })

    // Check satisfaction score
    if (context.performanceMetrics.userSatisfactionScore < 7) {
      findings.push(this.createFinding(
        'usability',
        'warning',
        `User satisfaction score is ${context.performanceMetrics.userSatisfactionScore}/10`,
        { score: context.performanceMetrics.userSatisfactionScore, threshold: 7 }
      ))
    }

    return findings
  }

  private analyzeWorkflowEfficiency(context: SystemContext): ImprovementSuggestion | null {
    // Count multi-step operations
    const claimActions = context.userActions.filter(a => a.type === 'claim')
    const exportActions = context.userActions.filter(a => a.type === 'export')

    // If users frequently claim then export, suggest bulk workflow
    if (claimActions.length > 20 && exportActions.length > 20) {
      return this.createImprovement(
        'usability',
        'medium',
        'Add bulk workflow shortcuts',
        'Create shortcuts for common multi-step operations to improve efficiency',
        'Users frequently perform claim-then-export workflows, suggesting need for shortcuts',
        'Reduce clicks by 60% for common workflows, improve user productivity',
        true,
        90,
        {
          steps: [
            'Add "Claim & Export" bulk action',
            'Create workflow templates',
            'Add keyboard shortcuts for power users',
            'Implement undo for bulk operations'
          ],
          risks: [
            'Learning curve for new shortcuts',
            'Accidental bulk operations'
          ],
          rollbackPlan: [
            'Disable shortcuts',
            'Revert to individual operations'
          ],
          validationCriteria: [
            'Workflow time reduced by >50%',
            'Shortcut usage >30%',
            'No increase in errors'
          ]
        }
      )
    }

    return null
  }

  private suggestUXImprovement(): ImprovementSuggestion {
    return this.createImprovement(
      'usability',
      'high',
      'Enhance user interface with contextual help',
      'Add tooltips, onboarding, and contextual help to improve user understanding',
      'Low user satisfaction score indicates users may be struggling with the interface',
      'Increase user satisfaction by 20-30%, reduce support requests',
      true,
      85,
      {
        steps: [
          'Add tooltips to all complex controls',
          'Create interactive onboarding flow',
          'Add contextual help panels',
          'Implement progressive disclosure'
        ],
        risks: [
          'Interface clutter if overdone',
          'Development time investment'
        ],
        rollbackPlan: [
          'Disable help features',
          'Remove tooltips',
          'Simplify onboarding'
        ],
        validationCriteria: [
          'User satisfaction score >7.5',
          'Support tickets reduced >25%',
          'Onboarding completion rate >80%'
        ]
      }
    )
  }
}
