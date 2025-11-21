# UCC Data Collection Scheduler Guide

## Overview

The automated scheduler runs UCC data collection on a configurable schedule, making your system truly autonomous. Set it up once and let it continuously gather prospect data across multiple states.

## Quick Start

### 1. Configure Schedule

Edit `.env`:

```bash
# Cron schedule (default: daily at 2 AM)
SCRAPER_SCHEDULE=0 2 * * *

# States to scrape
SCRAPER_STATES=CA,TX,FL,NY,IL

# Scraper implementation
SCRAPER_IMPLEMENTATION=mock  # or puppeteer, api
```

### 2. Start Scheduler

```bash
# Run in foreground (recommended for testing)
npm run scheduler

# Run with immediate execution (test before scheduling)
npm run scheduler:now

# View stats
npm run scheduler:stats
```

### 3. Monitor Logs

Logs are automatically written to `logs/scheduler-YYYY-MM-DD.log`:

```bash
tail -f logs/scheduler-$(date +%Y-%m-%d).log
```

---

## Cron Schedule Examples

### Common Schedules

```bash
# Daily at 2 AM
SCRAPER_SCHEDULE="0 2 * * *"

# Every 6 hours
SCRAPER_SCHEDULE="0 */6 * * *"

# Twice daily (9 AM and 5 PM)
SCRAPER_SCHEDULE="0 9,17 * * *"

# Weekly on Monday at 2 AM
SCRAPER_SCHEDULE="0 2 * * 1"

# First day of every month at midnight
SCRAPER_SCHEDULE="0 0 1 * *"

# Business hours (9 AM - 5 PM, Mon-Fri)
SCRAPER_SCHEDULE="0 9-17 * * 1-5"
```

### Cron Format

```
 ┌───────────── minute (0 - 59)
 │ ┌───────────── hour (0 - 23)
 │ │ ┌───────────── day of month (1 - 31)
 │ │ │ ┌───────────── month (1 - 12)
 │ │ │ │ ┌───────────── day of week (0 - 6) (Sunday=0)
 │ │ │ │ │
 * * * * *
```

---

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPER_SCHEDULE` | `0 2 * * *` | Cron expression for schedule |
| `SCRAPER_STATES` | `CA,TX,FL,NY,IL` | Comma-separated state codes |
| `SCRAPER_IMPLEMENTATION` | `mock` | Scraper type: `mock`, `puppeteer`, or `api` |
| `ENABLE_NOTIFICATIONS` | `false` | Send notifications for high-value prospects |
| `NOTIFICATION_THRESHOLD` | `80` | Minimum priority score (0-100) for notifications |
| `RUN_IMMEDIATELY` | `false` | Run once immediately on startup |

### Example Configuration

```bash
# Production setup with API scraper running twice daily
SCRAPER_SCHEDULE="0 9,21 * * *"
SCRAPER_STATES=CA,TX,FL,NY,IL,PA,OH,GA,NC,MI
SCRAPER_IMPLEMENTATION=api
UCC_API_KEY=your_production_key
ENABLE_NOTIFICATIONS=true
NOTIFICATION_THRESHOLD=85
```

---

## NPM Commands

### Basic Commands

```bash
# Start scheduler (foreground)
npm run scheduler

# Start and run immediately (for testing)
npm run scheduler:now

# View statistics
npm run scheduler:stats
```

### Advanced Usage

```bash
# Custom schedule (hourly)
SCRAPER_SCHEDULE="0 * * * *" npm run scheduler

# Scrape specific states only
SCRAPER_STATES="CA,NY" npm run scheduler

# Use Puppeteer implementation
SCRAPER_IMPLEMENTATION=puppeteer npm run scheduler

# Enable immediate run with custom config
RUN_IMMEDIATELY=true SCRAPER_STATES="TX,FL" npm run scheduler:now
```

---

## Production Deployment

### Using PM2 (Recommended)

PM2 is a production process manager for Node.js:

```bash
# Install PM2
npm install -g pm2

# Start scheduler as daemon
pm2 start npm --name "ucc-scheduler" -- run scheduler

# View logs
pm2 logs ucc-scheduler

# Monitor
pm2 monit

# Auto-restart on reboot
pm2 startup
pm2 save

# Stop
pm2 stop ucc-scheduler

# Restart
pm2 restart ucc-scheduler
```

### Using systemd (Linux)

Create `/etc/systemd/system/ucc-scheduler.service`:

```ini
[Unit]
Description=UCC Data Collection Scheduler
After=network.target postgresql.service

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/public-record-data-scrapper
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run scheduler
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable ucc-scheduler
sudo systemctl start ucc-scheduler
sudo systemctl status ucc-scheduler
sudo journalctl -u ucc-scheduler -f
```

### Using Docker

Create `Dockerfile.scheduler`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

CMD ["npm", "run", "scheduler"]
```

Run:

```bash
docker build -f Dockerfile.scheduler -t ucc-scheduler .
docker run -d \
  --name ucc-scheduler \
  --env-file .env \
  --restart unless-stopped \
  ucc-scheduler
```

---

## Monitoring & Health Checks

### Log Files

Logs are written to `logs/scheduler-YYYY-MM-DD.log` with structured JSON:

```json
{
  "timestamp": "2024-01-15T02:00:00.000Z",
  "level": "INFO",
  "message": "Scraping job completed successfully",
  "data": {
    "duration": "12.5s",
    "totalProspects": 25,
    "totalFilings": 48,
    "successRate": "98.5%"
  }
}
```

### View Statistics

```bash
npm run scheduler:stats
```

Output:

```
📊 Scheduler Statistics

Total Runs: 15
Successful: 14
Failed: 1
Success Rate: 93.3%

📅 Last Run:
Time: 1/15/2024, 2:00:00 AM
Duration: 12.5s
Prospects: 25
Filings: 48

⏰ Next Run:
1/16/2024, 2:00:00 AM
```

### Monitoring Checklist

- ✅ Check logs daily: `tail -f logs/scheduler-$(date +%Y-%m-%d).log`
- ✅ Monitor success rate: `npm run scheduler:stats`
- ✅ Set up alerts for failures (see Notifications section)
- ✅ Verify database growth: Check prospect count increasing
- ✅ Monitor disk space: Logs can grow over time

---

## Notifications

### High-Value Prospect Alerts

Enable notifications for prospects above a priority threshold:

```bash
ENABLE_NOTIFICATIONS=true
NOTIFICATION_THRESHOLD=85
```

When a high-value prospect is detected:

```json
{
  "timestamp": "2024-01-15T02:05:32.000Z",
  "level": "INFO",
  "message": "High-value prospect detected: Golden State Restaurant Group",
  "data": {
    "priorityScore": 92,
    "state": "CA",
    "estimatedRevenue": 2500000
  }
}
```

### Email Integration (TODO)

To enable email notifications, integrate with:

- **SendGrid**: Simple API for transactional emails
- **Mailgun**: Reliable email delivery
- **AWS SES**: Cost-effective for high volume
- **Postmark**: Excellent deliverability

Example integration (to be implemented):

```typescript
// In scheduler.ts
if (config.enableNotifications && priorityScore >= config.notificationThreshold) {
  await sendEmail({
    to: process.env.NOTIFICATION_EMAIL,
    subject: `High-Value Prospect: ${company.name}`,
    body: `Priority Score: ${priorityScore}, Revenue: $${estimatedRevenue}`
  })
}
```

### Webhook Integration (TODO)

Send webhook to external systems:

```typescript
await fetch(process.env.NOTIFICATION_WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'high_value_prospect',
    prospect: { companyName, priorityScore, state }
  })
})
```

---

## Troubleshooting

### Scheduler Won't Start

**Error**: `Invalid cron schedule expression`

**Fix**: Validate your cron expression at https://crontab.guru

```bash
# Test schedule validity
SCRAPER_SCHEDULE="0 2 * * *" npm run scheduler
```

### Database Connection Fails

**Error**: `ECONNREFUSED 127.0.0.1:5432`

**Fix**: Ensure PostgreSQL is running

```bash
# Check PostgreSQL status
pg_isready

# Start PostgreSQL
brew services start postgresql@16  # macOS
sudo systemctl start postgresql    # Linux
```

### Scraper Implementation Not Available

**Error**: `MOCK implementation not available`

**Fix**: Check that implementation is correctly configured

```bash
# For API implementation
echo "UCC_API_KEY=your_key" >> .env

# For Puppeteer implementation
npm install puppeteer-extra puppeteer-extra-plugin-stealth
```

### Logs Not Being Created

**Fix**: Ensure logs directory exists and is writable

```bash
mkdir -p logs
chmod 755 logs
```

### High Memory Usage

**Cause**: Long-running process with memory leaks

**Fix**:
1. Restart scheduler regularly (PM2 does this automatically)
2. Monitor with `pm2 monit`
3. Set max memory limit:

```bash
pm2 start npm --name "ucc-scheduler" \
  --max-memory-restart 500M \
  -- run scheduler
```

---

## Performance Optimization

### Concurrent State Collection

The scheduler scrapes all states concurrently using `Promise.all`:

```typescript
// Parallel execution
const results = await Promise.all(
  states.map(state => scrapeState(state))
)
```

**Result**: 5 states in ~3 seconds vs 15 seconds sequential

### Rate Limiting

Respect API/website rate limits:

```bash
# Mock: No rate limit
# Puppeteer: 10 req/min per state (conservative)
# API: 60 req/min (configurable)
```

### Database Connection Pooling

Uses connection pooling (configured in database client):

```typescript
poolSize: 20  // Max concurrent connections
```

### Disk Space Management

Logs can grow large. Set up log rotation:

```bash
# Install logrotate
sudo apt install logrotate

# Create /etc/logrotate.d/ucc-scheduler
/path/to/logs/*.log {
  daily
  rotate 30
  compress
  delaycompress
  missingok
  notifempty
}
```

---

## Best Practices

### Development

- ✅ Use `npm run scheduler:now` to test before scheduling
- ✅ Start with `SCRAPER_IMPLEMENTATION=mock` for testing
- ✅ Test with a single state first: `SCRAPER_STATES=CA npm run scheduler:now`
- ✅ Monitor logs in real-time: `tail -f logs/*.log`

### Production

- ✅ Use PM2 or systemd for process management
- ✅ Set up automatic restarts
- ✅ Monitor success rates daily
- ✅ Enable notifications for high-value prospects
- ✅ Use commercial API implementation for reliability
- ✅ Set up log rotation
- ✅ Monitor database size growth
- ✅ Back up database regularly

### Security

- ✅ Never commit .env to version control
- ✅ Rotate API keys regularly
- ✅ Use environment-specific keys (dev vs prod)
- ✅ Limit database user permissions
- ✅ Monitor logs for suspicious activity
- ✅ Use HTTPS for all API calls
- ✅ Encrypt sensitive data at rest

---

## Integration with Existing System

### Database Integration

Scheduler writes to the same database as manual scrapers:

```sql
-- Check scheduler-generated data
SELECT COUNT(*) FROM prospects
WHERE metadata->>'scheduledJob' = 'true';

-- View latest scheduled run
SELECT * FROM prospects
ORDER BY created_at DESC
LIMIT 10;
```

### UI Integration

Data collected by the scheduler appears immediately in the UI:

1. Set `VITE_USE_MOCK_DATA=false` in `.env`
2. Start UI: `npm run dev`
3. View newly collected prospects in dashboard

### Manual Override

You can still run manual scrapes alongside the scheduler:

```bash
# Scheduler runs automatically
npm run scheduler &

# Manual scrape anytime
npm run scrape:multi CA TX

# Both write to same database - no conflicts
```

---

## Future Enhancements

### Planned Features

- [ ] Email notifications for high-value prospects
- [ ] Webhook support for external integrations
- [ ] Web dashboard for scheduler monitoring
- [ ] Adaptive scheduling based on data freshness
- [ ] Automatic retry for failed states
- [ ] Slack/Discord integration
- [ ] Prometheus metrics export
- [ ] Grafana dashboard templates

### Community Contributions

Want to add a feature? See `CONTRIBUTING.md` for guidelines.

---

## Support

- **Documentation**: See other guides in `docs/`
- **Issues**: Report at GitHub Issues
- **Logs**: Check `logs/scheduler-*.log`
- **Stats**: Run `npm run scheduler:stats`

---

**You now have a fully automated UCC data collection system!** 🤖

Set the schedule, start the scheduler, and let it run autonomously.
