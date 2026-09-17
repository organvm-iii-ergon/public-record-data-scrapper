# Dynatrace Expert Agent Quick Start

## What is the Dynatrace Expert Agent?

The Dynatrace Expert Agent is a specialized AI assistant with comprehensive knowledge of Dynatrace observability and the Dynatrace Query Language (DQL). It can help you investigate incidents, analyze deployments, monitor errors, detect performance regressions, and respond to security vulnerabilities.

## When to Use

Use the Dynatrace Expert Agent when you need to:

- **Investigate Production Issues**: "What's causing the errors in the payment service?"
- **Analyze Deployments**: "Check if the deployment at 2024-01-15 was successful"
- **Monitor Errors**: "What errors are we seeing in production?"
- **Check Performance**: "Are we seeing any performance regressions?"
- **Security Analysis**: "What vulnerabilities do we have?"
- **Learn DQL**: "How do I write a query to find slow endpoints?"

## Key Capabilities

### 1. Incident Response & Root Cause Analysis

The agent can investigate service failures by:

- Querying Davis AI problems
- Analyzing exceptions from spans
- Correlating logs and metrics
- Assessing business impact
- Providing detailed root cause analysis

### 2. Deployment Impact Analysis

Validate deployments by comparing:

- Error rates before and after
- Performance metrics (P50, P95, P99)
- Throughput and traffic patterns
- New problems post-deployment

### 3. Production Error Triage

Monitor and categorize errors:

- Backend exceptions from traces
- Frontend JavaScript errors
- Error severity classification
- Affected user counts

### 4. Performance Regression Detection

Track golden signals:

- Latency (P50, P95, P99)
- Traffic (requests per second)
- Errors (error rate)
- Saturation (CPU, memory)

### 5. Release Validation

Automated health checks:

- Pre-deployment validation
- Post-deployment monitoring
- SLO validation
- Go/no-go decisions

### 6. Security Vulnerability Response

Security and compliance:

- Latest vulnerability scans
- Severity prioritization
- Compliance framework mapping
- Actionable remediation steps

## Example Queries

### Get Exception Details

```dql
fetch spans, from:now() - 4h
| filter request.is_failed == true and isNotNull(span.events)
| expand span.events
| filter span.events[span_event.name] == "exception"
| summarize exception_count = count(), by: {
    service_name = entityName(dt.entity.service),
    exception_message = span.events[exception.message]
}
| sort exception_count desc
```

### Compare Deployment Metrics

```dql
timeseries {
  total_requests = sum(dt.service.request.count, scalar: true),
  failed_requests = sum(dt.service.request.failure_count, scalar: true)
},
by: {dt.entity.service},
from: "2024-01-15T14:00:00Z", to: "2024-01-15T16:00:00Z"
| fieldsAdd service_name = entityName(dt.entity.service)
```

### Monitor Golden Signals

```dql
timeseries {
  p95_response_time = percentile(dt.service.request.response_time, 95, scalar: true),
  requests_per_second = sum(dt.service.request.count, scalar: true, rate: 1s),
  error_rate = sum(dt.service.request.failure_count, scalar: true, rate: 1m)
},
by: {dt.entity.service},
from: now()-2h
| fieldsAdd service_name = entityName(dt.entity.service)
```

## Best Practices

1. **Be Specific**: Provide context about what you're investigating
2. **Include Timeframes**: Mention when issues occurred or deployments happened
3. **Ask for DQL Queries**: Request the queries used so you can learn and rerun them
4. **Create Issues**: Ask the agent to create GitHub issues for critical findings
5. **Multi-Source**: The agent will cross-reference logs, spans, metrics, and events

## Complete Documentation

For the complete agent capabilities, workflows, and DQL reference, see:

- [Dynatrace Expert Agent Full Documentation](./.github/agents/dynatrace-expert.md)
- [Custom Agents Guide](./.github/agents/README.md)

## Integration with Repository

The Dynatrace Expert Agent is automatically available when working in this repository through GitHub Copilot. It understands the repository context and can create issues, provide actionable insights, and help with observability tasks.

---

**Questions?** Open an issue or discussion in the repository.
