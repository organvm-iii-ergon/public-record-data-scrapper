/**
 * Base Agent Implementation
 *
 * Provides the foundation for all autonomous agents in the system.
 */

import {
  Agent,
  AgentRole,
  AgentAnalysis,
  SystemContext,
  Finding,
  ImprovementSuggestion
} from './types'
import { v4 as uuidv4 } from 'uuid'

export abstract class BaseAgent implements Agent {
  public readonly id: string
  public readonly role: AgentRole
  public readonly name: string
  public readonly capabilities: string[]

  constructor(role: AgentRole, name: string, capabilities: string[]) {
    this.id = uuidv4()
    this.role = role
    this.name = name
    this.capabilities = capabilities
  }

  abstract analyze(context: SystemContext): Promise<AgentAnalysis>

  protected createAnalysis(
    findings: Finding[],
    improvements: ImprovementSuggestion[]
  ): AgentAnalysis {
    return {
      agentId: this.id,
      agentRole: this.role,
      findings,
      improvements,
      timestamp: new Date().toISOString()
    }
  }

  protected createFinding(
    category: ImprovementSuggestion['category'],
    severity: Finding['severity'],
    description: string,
    evidence: unknown
  ): Finding {
    return {
      id: uuidv4(),
      category,
      severity,
      description,
      evidence
    }
  }

  protected createImprovement(
    category: ImprovementSuggestion['category'],
    priority: ImprovementSuggestion['priority'],
    title: string,
    description: string,
    reasoning: string,
    estimatedImpact: string,
    automatable: boolean,
    safetyScore: number,
    implementation?: ImprovementSuggestion['implementation']
  ): ImprovementSuggestion {
    return {
      id: uuidv4(),
      category,
      priority,
      title,
      description,
      reasoning,
      estimatedImpact,
      automatable,
      safetyScore,
      implementation
    }
  }
}
