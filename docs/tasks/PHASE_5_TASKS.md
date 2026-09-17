# Phase 5: Production Deployment - Detailed Task Breakdown

**Duration**: 4 weeks (Weeks 17-20)
**Goal**: Live production system
**Priority**: CRITICAL
**Dependencies**: Phases 1-4 complete

---

## Week 17-18: Monitoring & Observability

### Task 5.1: Prometheus + Grafana Setup

**Assignee**: TBD
**Effort**: 3 days
**Priority**: HIGH

#### Subtask 5.1.1: Prometheus Configuration

**Time**: 1 day

**Prometheus Config:**
`monitoring/prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

# Alertmanager configuration (already exists in monitoring/alertmanager/config.yml)
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - localhost:9093

# Load rules (already exists in monitoring/prometheus/alerts.yml)
rule_files:
  - 'alerts.yml'

# Scrape configurations
scrape_configs:
  # Application metrics
  - job_name: 'ucc-intelligence-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'

  # PostgreSQL metrics
  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']

  # Redis metrics
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']

  # Node metrics
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']

  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

**Application Metrics:**
`server/middleware/metrics.ts`

```typescript
import promClient from 'prom-client'
import { Request, Response, NextFunction } from 'express'

// Create a Registry
const register = new promClient.Registry()

// Default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register })

// Custom metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
})

export const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
})

export const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active database connections'
})

export const prospectEnrichmentDuration = new promClient.Histogram({
  name: 'prospect_enrichment_duration_seconds',
  help: 'Duration of prospect enrichment in seconds',
  buckets: [1, 2, 5, 10, 30, 60]
})

export const uccScraperSuccess = new promClient.Counter({
  name: 'ucc_scraper_success_total',
  help: 'Total successful UCC scrapes',
  labelNames: ['state']
})

export const uccScraperFailure = new promClient.Counter({
  name: 'ucc_scraper_failure_total',
  help: 'Total failed UCC scrapes',
  labelNames: ['state', 'error_type']
})

// Register custom metrics
register.registerMetric(httpRequestDuration)
register.registerMetric(httpRequestTotal)
register.registerMetric(activeConnections)
register.registerMetric(prospectEnrichmentDuration)
register.registerMetric(uccScraperSuccess)
register.registerMetric(uccScraperFailure)

// Metrics middleware
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000

    httpRequestDuration.observe(
      { method: req.method, route: req.route?.path || req.path, status_code: res.statusCode },
      duration
    )

    httpRequestTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode
    })
  })

  next()
}

// Metrics endpoint
export const metricsEndpoint = async (req: Request, res: Response) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
}
```

**Docker Compose for Local Monitoring:**
`docker-compose.monitoring.yml`

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./monitoring/prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    ports:
      - '9090:9090'

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    volumes:
      - ./monitoring/grafana-dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana-datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_SERVER_HTTP_PORT=3001
    ports:
      - '3001:3001'
    depends_on:
      - prometheus

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    volumes:
      - ./monitoring/alertmanager:/etc/alertmanager
    command:
      - '--config.file=/etc/alertmanager/config.yml'
    ports:
      - '9093:9093'

  postgres_exporter:
    image: prometheuscommunity/postgres-exporter:latest
    container_name: postgres_exporter
    environment:
      - DATA_SOURCE_NAME=postgresql://user:password@postgres:5432/ucc_intelligence?sslmode=disable
    ports:
      - '9187:9187'

  redis_exporter:
    image: oliver006/redis_exporter:latest
    container_name: redis_exporter
    environment:
      - REDIS_ADDR=redis:6379
    ports:
      - '9121:9121'

  node_exporter:
    image: prom/node-exporter:latest
    container_name: node_exporter
    ports:
      - '9100:9100'

volumes:
  prometheus_data:
  grafana_data:
```

**Acceptance Criteria:**

- [ ] Prometheus scraping metrics
- [ ] Custom application metrics
- [ ] Database metrics (postgres_exporter)
- [ ] Redis metrics (redis_exporter)
- [ ] Docker Compose working locally

---

#### Subtask 5.1.2: Grafana Dashboards

**Time**: 2 days

**Dashboard 1: Application Overview**
`monitoring/grafana-dashboards/application-overview.json`

```json
{
  "title": "UCC Intelligence - Application Overview",
  "panels": [
    {
      "title": "Request Rate (req/s)",
      "targets": [
        {
          "expr": "rate(http_requests_total[5m])"
        }
      ],
      "type": "graph"
    },
    {
      "title": "Response Time P95 (ms)",
      "targets": [
        {
          "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) * 1000"
        }
      ],
      "type": "graph"
    },
    {
      "title": "Error Rate (%)",
      "targets": [
        {
          "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m]) / rate(http_requests_total[5m]) * 100"
        }
      ],
      "type": "graph"
    },
    {
      "title": "Active Database Connections",
      "targets": [
        {
          "expr": "active_connections"
        }
      ],
      "type": "stat"
    }
  ]
}
```

**Dashboard 2: Data Pipeline**

```json
{
  "title": "UCC Intelligence - Data Pipeline",
  "panels": [
    {
      "title": "UCC Scraper Success Rate",
      "targets": [
        {
          "expr": "rate(ucc_scraper_success_total[5m]) / (rate(ucc_scraper_success_total[5m]) + rate(ucc_scraper_failure_total[5m]))"
        }
      ]
    },
    {
      "title": "Enrichment Duration P95",
      "targets": [
        {
          "expr": "histogram_quantile(0.95, rate(prospect_enrichment_duration_seconds_bucket[5m]))"
        }
      ]
    }
  ]
}
```

**Dashboard 3: Business Metrics**

```json
{
  "title": "UCC Intelligence - Business Metrics",
  "panels": [
    {
      "title": "Total Prospects",
      "targets": [
        {
          "expr": "SELECT COUNT(*) FROM prospects"
        }
      ]
    },
    {
      "title": "Daily Claimed Prospects",
      "targets": [
        {
          "expr": "SELECT COUNT(*) FROM prospects WHERE DATE(claimed_at) = CURRENT_DATE"
        }
      ]
    },
    {
      "title": "Average Priority Score",
      "targets": [
        {
          "expr": "SELECT AVG(priority_score) FROM prospects"
        }
      ]
    }
  ]
}
```

**Dashboard 4: System Health**

```json
{
  "title": "UCC Intelligence - System Health",
  "panels": [
    {
      "title": "CPU Usage (%)",
      "targets": [
        {
          "expr": "100 - (avg by(instance) (rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)"
        }
      ]
    },
    {
      "title": "Memory Usage (%)",
      "targets": [
        {
          "expr": "(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100"
        }
      ]
    },
    {
      "title": "Disk Usage (%)",
      "targets": [
        {
          "expr": "100 - ((node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100)"
        }
      ]
    }
  ]
}
```

**Acceptance Criteria:**

- [ ] 4 Grafana dashboards created
- [ ] Real-time metrics displayed
- [ ] Alerts configured
- [ ] Dashboards exported as JSON

---

### Task 5.2: Centralized Logging

**Assignee**: TBD
**Effort**: 2 days
**Priority**: HIGH

**Winston Logger Setup:**
`server/logging/logger.ts`

```typescript
import winston from 'winston'

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
)

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'ucc-intelligence-api',
    environment: process.env.NODE_ENV
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple())
    }),

    // File transport - errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),

    // File transport - all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
})

// CloudWatch transport for production
if (process.env.NODE_ENV === 'production') {
  const CloudWatchTransport = require('winston-cloudwatch')

  logger.add(
    new CloudWatchTransport({
      logGroupName: `/ucc-intelligence/${process.env.NODE_ENV}`,
      logStreamName: `api-${new Date().toISOString().split('T')[0]}`,
      awsRegion: process.env.AWS_REGION
    })
  )
}
```

**Usage with Correlation IDs:**
`server/middleware/requestLogger.ts`

```typescript
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../logging/logger'

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Generate correlation ID
  const correlationId = uuidv4()
  req.correlationId = correlationId

  logger.info('Incoming request', {
    correlationId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start

    logger.info('Request completed', {
      correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration
    })
  })

  next()
}
```

**Acceptance Criteria:**

- [ ] Winston logger configured
- [ ] Correlation IDs on all requests
- [ ] CloudWatch integration (production)
- [ ] Log rotation configured
- [ ] Structured JSON logging

---

### Task 5.3: Error Tracking (Sentry)

**Assignee**: TBD
**Effort**: 1 day
**Priority**: HIGH

**Sentry Setup:**

```bash
npm install @sentry/node @sentry/profiling-node
```

`server/sentry.ts`

```typescript
import * as Sentry from '@sentry/node'
import { ProfilingIntegration } from '@sentry/profiling-node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  integrations: [new Sentry.Integrations.Http({ tracing: true }), new ProfilingIntegration()]
})
```

**Error Boundary Middleware:**

```typescript
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log to Sentry
  Sentry.captureException(err, {
    user: {
      id: req.user?.id,
      email: req.user?.email
    },
    tags: {
      path: req.path,
      method: req.method
    },
    extra: {
      correlationId: req.correlationId,
      body: req.body,
      query: req.query
    }
  })

  // Log locally
  logger.error('Unhandled error', {
    correlationId: req.correlationId,
    error: err.message,
    stack: err.stack
  })

  // Send response
  res.status(500).json({
    error: 'Internal Server Error',
    correlationId: req.correlationId
  })
}
```

**Acceptance Criteria:**

- [ ] Sentry configured
- [ ] Error grouping working
- [ ] User context attached
- [ ] Alerts for critical errors

---

## Week 19-20: Deployment & Launch

### Task 5.4: Infrastructure Provisioning

**Assignee**: TBD
**Effort**: 3 days
**Priority**: CRITICAL

**Option A: AWS Deployment**

```bash
# Using Terraform
terraform init
terraform plan -out=plan.tfplan
terraform apply plan.tfplan
```

`infrastructure/terraform/main.tf`

```hcl
provider "aws" {
  region = "us-east-1"
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "ucc-intelligence-vpc"
  }
}

# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier           = "ucc-intelligence-db"
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.m5.large"
  allocated_storage    = 100
  storage_encrypted    = true
  db_name              = "ucc_intelligence"
  username             = var.db_username
  password             = var.db_password
  multi_az             = true
  publicly_accessible  = false
  skip_final_snapshot  = false

  backup_retention_period = 7
  backup_window           = "03:00-04:00"

  tags = {
    Name = "ucc-intelligence-db"
  }
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "ucc-intelligence-redis"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = "cache.m5.large"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  tags = {
    Name = "ucc-intelligence-redis"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "ucc-intelligence-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# ECS Task Definition
resource "aws_ecs_task_definition" "api" {
  family                   = "ucc-intelligence-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"

  container_definitions = jsonencode([
    {
      name  = "api"
      image = "${var.ecr_repo_url}:latest"
      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "DATABASE_URL", value = "postgresql://${aws_db_instance.postgres.endpoint}/ucc_intelligence" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/ucc-intelligence-api"
          "awslogs-region"        = "us-east-1"
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])
}

# ECS Service
resource "aws_ecs_service" "api" {
  name            = "ucc-intelligence-api-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 3
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private.*.id
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "ucc-intelligence-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public.*.id

  enable_deletion_protection = true

  tags = {
    Name = "ucc-intelligence-alb"
  }
}

# CloudFront CDN
resource "aws_cloudfront_distribution" "frontend" {
  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "S3-ucc-intelligence-frontend"
  }

  enabled             = true
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-ucc-intelligence-frontend"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
```

**Acceptance Criteria:**

- [ ] Infrastructure provisioned
- [ ] Database accessible from ECS
- [ ] Redis cluster running
- [ ] Load balancer routing traffic
- [ ] CloudFront serving frontend
- [ ] Auto-scaling configured

---

### Task 5.5: CI/CD Pipeline

**Assignee**: TBD
**Effort**: 2 days
**Priority**: HIGH

**.github/workflows/deploy.yml**

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
      - run: npm run build

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: ucc-intelligence-api
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster ucc-intelligence-cluster \
            --service ucc-intelligence-api-service \
            --force-new-deployment

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build

      - name: Deploy to S3
        run: |
          aws s3 sync dist/ s3://ucc-intelligence-frontend --delete

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

**Acceptance Criteria:**

- [ ] CI/CD pipeline working
- [ ] Tests run before deployment
- [ ] Docker images built and pushed
- [ ] ECS service updated
- [ ] Frontend deployed to S3
- [ ] CloudFront invalidation

---

### Task 5.6: Load Testing

**Assignee**: TBD
**Effort**: 2 days
**Priority**: HIGH

**k6 Load Test Script:**
`tests/load/api-load-test.js`

```javascript
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 } // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'] // Error rate must be below 1%
  }
}

const BASE_URL = 'https://api.ucc-intelligence.com'

export default function () {
  // Test GET /prospects
  const prospectsRes = http.get(`${BASE_URL}/api/prospects?page=1&limit=20`)
  check(prospectsRes, {
    'prospects status is 200': (r) => r.status === 200,
    'prospects response time < 500ms': (r) => r.timings.duration < 500
  })

  sleep(1)

  // Test GET /prospects/:id
  const prospectRes = http.get(`${BASE_URL}/api/prospects/test-uuid-123`)
  check(prospectRes, {
    'prospect status is 200 or 404': (r) => [200, 404].includes(r.status)
  })

  sleep(1)
}
```

**Run Load Test:**

```bash
k6 run tests/load/api-load-test.js
```

**Acceptance Criteria:**

- [ ] Load test script written
- [ ] P95 latency < 500ms
- [ ] Error rate < 1%
- [ ] System stable under 200 RPS
- [ ] Database not bottleneck

---

### Task 5.7: Launch Runbook

**Assignee**: TBD
**Effort**: 1 day
**Priority**: CRITICAL

**Create Launch Checklist:**
`docs/LAUNCH_RUNBOOK.md`

````markdown
# Production Launch Runbook

## Pre-Launch Checklist (T-7 days)

### Infrastructure

- [ ] Database backups tested and verified
- [ ] Redis cluster healthy
- [ ] Load balancer health checks passing
- [ ] SSL certificates valid
- [ ] DNS records configured
- [ ] Auto-scaling policies tested

### Security

- [ ] Security scan passed (0 critical, 0 high vulnerabilities)
- [ ] Secrets in AWS Secrets Manager
- [ ] CORS configured correctly
- [ ] Rate limiting tested
- [ ] Authentication working

### Monitoring

- [ ] Prometheus scraping all targets
- [ ] Grafana dashboards created
- [ ] Alertmanager rules configured
- [ ] PagerDuty integration working
- [ ] Sentry error tracking active

### Testing

- [ ] All unit tests passing (80%+ coverage)
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Load tests passed (200 RPS, P95 < 500ms)
- [ ] Smoke tests on staging

### Documentation

- [ ] API documentation (OpenAPI) complete
- [ ] Deployment guide updated
- [ ] Runbooks for common issues
- [ ] Team trained on monitoring

## Launch Day (T-0)

### 08:00 - Pre-Launch

- [ ] Final smoke tests on staging
- [ ] Backup current database
- [ ] Notify team of launch window
- [ ] Enable maintenance page

### 09:00 - Database Migration

- [ ] Run database migrations
- [ ] Verify schema changes
- [ ] Seed production data (if any)

### 10:00 - Deployment

- [ ] Deploy backend (ECS)
- [ ] Deploy frontend (S3 + CloudFront)
- [ ] Verify health checks passing
- [ ] Disable maintenance page

### 10:30 - Verification

- [ ] Test critical user flows
- [ ] Verify metrics in Grafana
- [ ] Check error rates in Sentry
- [ ] Monitor database connections

### 11:00 - Go Live

- [ ] Announce launch
- [ ] Monitor for 2 hours
- [ ] Be ready for rollback

## Rollback Plan

If error rate > 5% or P95 latency > 1s:

1. Immediately rollback ECS service:
   ```bash
   aws ecs update-service \
     --cluster ucc-intelligence-cluster \
     --service ucc-intelligence-api-service \
     --task-definition previous-task-definition-arn
   ```
````

2. Rollback database migration:

   ```bash
   npm run migrate:down
   ```

3. Rollback frontend:

   ```bash
   aws s3 sync s3://ucc-intelligence-frontend-backup/ s3://ucc-intelligence-frontend/
   ```

4. Notify team and stakeholders
5. Post-mortem within 24 hours

```

**Acceptance Criteria:**
- [ ] Runbook documented
- [ ] Team trained on runbook
- [ ] Rollback plan tested
- [ ] Launch window scheduled

---

## Phase 5 Completion Checklist

### Week 17-18: Monitoring & Observability ✓
- [ ] Prometheus + Grafana operational
- [ ] 4 Grafana dashboards created
- [ ] Application metrics tracked
- [ ] Centralized logging (Winston + CloudWatch)
- [ ] Correlation IDs on all requests
- [ ] Sentry error tracking configured
- [ ] Alerts configured (14 alert rules)

### Week 19-20: Deployment & Launch ✓
- [ ] Infrastructure provisioned (Terraform)
- [ ] CI/CD pipeline working
- [ ] Blue-green deployment configured
- [ ] Load testing passed (200 RPS, P95 < 500ms)
- [ ] Launch runbook created
- [ ] Team trained
- [ ] Production launch successful

### Deliverables
- [ ] Production system live
- [ ] Monitoring dashboards operational
- [ ] Error tracking active
- [ ] CI/CD pipeline automated
- [ ] Load testing report
- [ ] Launch runbook
- [ ] Post-launch review

### Metrics
- **Uptime**: Target 99.9% (43 min downtime/month)
- **Response Time P95**: <500ms
- **Error Rate**: <0.1%
- **Deployment Time**: <10 minutes
- **MTTR**: <30 minutes

---

## Post-Launch (Week 21+)

### Week 21: Stabilization
- [ ] Monitor metrics daily
- [ ] Fix critical bugs
- [ ] Optimize slow queries
- [ ] Adjust auto-scaling policies
- [ ] User feedback collection

### Week 22: Iteration
- [ ] Implement high-priority user requests
- [ ] Performance optimizations
- [ ] Cost optimization review
- [ ] Documentation updates

---

**Total Effort**: 4 weeks
**Total Cost**: ~$24,000 (@ $150/hr)
**Total Project Cost**: ~$120,000 (20 weeks)

🚀 **PRODUCTION READY**
```
