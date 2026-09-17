# Custom Agents Directory

This directory contains custom agent configurations for GitHub Copilot. Custom agents are specialized AI assistants with domain-specific knowledge and capabilities that can be invoked to handle specific tasks.

## Available Agents

### Dynatrace Expert Agent

**File:** `dynatrace-expert.md`

**Purpose:** Master Dynatrace specialist with complete DQL (Dynatrace Query Language) knowledge and comprehensive observability/security capabilities.

**Capabilities:**

- **Incident Response & Root Cause Analysis** - Investigate production issues and service failures
- **Deployment Impact Analysis** - Validate deployments and compare pre/post-deployment metrics
- **Production Error Triage** - Monitor and categorize production errors
- **Performance Regression Detection** - Detect performance degradations and SLO violations
- **Release Validation & Health Checks** - Automated release gate checks
- **Security Vulnerability Response** - Analyze security findings and compliance violations

**When to Use:**

- Investigating production incidents or service failures
- Analyzing deployment health and performance
- Monitoring error rates and patterns
- Checking for security vulnerabilities
- Validating SLOs and performance metrics
- Learning or writing DQL queries

**Key Features:**

- Complete DQL reference with all commands and patterns
- Context-aware workflow routing
- Multi-source data validation (logs, spans, metrics, events)
- GitHub issue creation for critical findings
- Actionable insights with trace IDs and file locations

## How to Use Custom Agents

Custom agents can be invoked through GitHub Copilot when working on issues or PRs. They appear as specialized tools that Copilot can delegate tasks to.

### Example Interactions

**Incident Investigation:**

```
"Check what's causing the production errors in the payment service"
→ Agent analyzes Davis AI problems, exceptions, logs, and provides RCA
```

**Deployment Validation:**

```
"Validate if the deployment at 2024-01-15 14:30 UTC was successful"
→ Agent compares before/after metrics and provides health verdict
```

**Security Audit:**

```
"What security vulnerabilities do we have in our services?"
→ Agent queries latest security scans and prioritizes findings
```

**DQL Query Help:**

```
"How do I write a DQL query to find the top 10 slowest endpoints?"
→ Agent provides the query with explanation
```

## Adding New Agents

To add a new custom agent:

1. Create a new `.md` file in this directory
2. Define the agent's role, context, and responsibilities
3. Include specific workflows and examples
4. Document when and how to use the agent
5. Update this README with the new agent's information

## Best Practices

1. **Specificity** - Custom agents should have focused, specialized knowledge
2. **Actionable** - Agents should provide concrete next steps
3. **Educational** - Include examples and explanations
4. **Context-Aware** - Agents should understand the repository context
5. **Integration** - Enable GitHub issue creation and other automations

## Repository Integration

Custom agents in this directory are automatically available to GitHub Copilot when working in this repository. They complement the general Copilot capabilities with specialized domain expertise.

---

For questions or suggestions about custom agents, please open an issue or discussion in the repository.
