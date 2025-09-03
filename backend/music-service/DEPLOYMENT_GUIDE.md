# Encore Music Service - Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the optimized Encore Music Service to production environments. The service includes advanced caching, monitoring, alerting, and performance optimizations.

## Prerequisites

### System Requirements

**Minimum Requirements:**
- Node.js 18+ (LTS recommended)
- PostgreSQL 14+
- Redis 6+
- 2GB RAM
- 2 CPU cores

**Recommended for Production:**
- Node.js 20+ (LTS)
- PostgreSQL 15+
- Redis 7+
- 4GB RAM
- 4 CPU cores
- SSD storage

### External Dependencies

- Spotify API credentials
- YouTube API credentials
- SMTP server for alerts (optional)
- Slack webhook for notifications (optional)

## 1. Environment Setup

### 1.1 Create Environment File

Create `.env` file in the project root:

```bash
# === CORE CONFIGURATION ===
NODE_ENV=production
PORT=3001
API_VERSION=v1

# === DATABASE CONFIGURATION ===
DATABASE_URL=postgresql://username:password@localhost:5432/encore_music
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
DATABASE_TIMEOUT=30000

# === REDIS CONFIGURATION ===
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
REDIS_TIMEOUT=5000

# === EXTERNAL APIS ===
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
YOUTUBE_API_KEY=your_youtube_api_key

# === SECURITY ===
JWT_SECRET=your_super_secure_jwt_secret_key_here
JWT_EXPIRES_IN=24h
CORS_ORIGIN=https://your-frontend-domain.com
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# === LOGGING ===
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE_ENABLED=true
LOG_FILE_PATH=./logs/app.log

# === MONITORING ===
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true
PERFORMANCE_MONITORING=true

# === CACHING ===
CACHE_ENABLED=true
CACHE_COMPRESSION=true
CACHE_DEFAULT_TTL=300
CACHE_MAX_SIZE=100mb

# === ALERTS CONFIGURATION ===
ALERT_ENABLED=true
ALERT_COOLDOWN=300000

# Email Alerts
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_HOST=smtp.gmail.com
ALERT_EMAIL_PORT=587
ALERT_EMAIL_SECURE=false
ALERT_EMAIL_USER=alerts@yourcompany.com
ALERT_EMAIL_PASSWORD=your_email_password
ALERT_EMAIL_FROM=Encore Alerts <alerts@yourcompany.com>
ALERT_EMAIL_RECIPIENTS=team@yourcompany.com,ops@yourcompany.com

# Slack Alerts (optional)
ALERT_SLACK_ENABLED=true
ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Webhook Alerts (optional)
ALERT_WEBHOOK_ENABLED=false
ALERT_WEBHOOK_URL=https://your-monitoring-system.com/webhooks/alerts
ALERT_WEBHOOK_HEADERS='{"Authorization": "Bearer your-token"}'

# === ALERT THRESHOLDS ===
ALERT_ERROR_RATE_THRESHOLD=10
ALERT_RESPONSE_TIME_THRESHOLD=5000
ALERT_MEMORY_THRESHOLD=85
ALERT_ERROR_COUNT_THRESHOLD=50
```

### 1.2 Validate Environment

Run the environment validation script:

```bash
node scripts/validate-env.js
```

## 2. Database Setup

### 2.1 Create Database

```sql
-- Connect to PostgreSQL as superuser
CREATE DATABASE encore_music;
CREATE USER encore_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE encore_music TO encore_user;

-- Connect to encore_music database
\c encore_music;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### 2.2 Run Migrations

```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate

# Apply optimizations
psql -d encore_music -f database/optimizations.sql
```

### 2.3 Verify Database Setup

```bash
# Test database connection
npm run db:test

# Check indexes
psql -d encore_music -c "\di"

# Check materialized views
psql -d encore_music -c "SELECT schemaname, matviewname FROM pg_matviews;"
```

## 3. Redis Setup

### 3.1 Install and Configure Redis

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
```

**CentOS/RHEL:**
```bash
sudo yum install redis
```

**Docker:**
```bash
docker run -d --name redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine redis-server --appendonly yes
```

### 3.2 Redis Configuration

Edit `/etc/redis/redis.conf`:

```redis
# Network
bind 127.0.0.1
port 6379
protected-mode yes

# Authentication
requirepass your_redis_password

# Memory Management
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# Performance
tcp-keepalive 300
timeout 0
tcp-backlog 511

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
```

### 3.3 Start Redis

```bash
sudo systemctl start redis
sudo systemctl enable redis

# Test connection
redis-cli -a your_redis_password ping
```

## 4. Application Deployment

### 4.1 Build Application

```bash
# Install production dependencies
npm ci --only=production

# Build TypeScript
npm run build

# Create logs directory
mkdir -p logs
```

### 4.2 Process Manager Setup (PM2)

**Install PM2:**
```bash
npm install -g pm2
```

**Create ecosystem file (`ecosystem.config.js`):**
```javascript
module.exports = {
  apps: [{
    name: 'encore-music-service',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000
  }]
};
```

**Start application:**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4.3 Systemd Service (Alternative)

Create `/etc/systemd/system/encore-music.service`:

```ini
[Unit]
Description=Encore Music Service
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=encore
WorkingDirectory=/opt/encore/music-service
EnvironmentFile=/opt/encore/music-service/.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=encore-music

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable encore-music
sudo systemctl start encore-music
```

## 5. Reverse Proxy Setup (Nginx)

### 5.1 Install Nginx

```bash
sudo apt install nginx
```

### 5.2 Configure Nginx

Create `/etc/nginx/sites-available/encore-music`:

```nginx
upstream encore_music {
    least_conn;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;
    # Add more servers for load balancing
    # server 127.0.0.1:3002 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name api.encore.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.encore.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
    
    # Proxy Settings
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 30s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
    
    # API Routes
    location /api/ {
        proxy_pass http://encore_music;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
    
    # Health Check
    location /health {
        proxy_pass http://encore_music;
        access_log off;
    }
    
    # Metrics (restrict access)
    location /metrics {
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
        proxy_pass http://encore_music;
    }
    
    # API Documentation
    location /api-docs {
        proxy_pass http://encore_music;
    }
    
    # Static files (if any)
    location /static/ {
        root /opt/encore/music-service/public;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/encore-music /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 6. SSL Certificate Setup

### 6.1 Using Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.encore.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 7. Monitoring Setup

### 7.1 Log Management

**Logrotate configuration (`/etc/logrotate.d/encore-music`):**
```
/opt/encore/music-service/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 encore encore
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 7.2 System Monitoring

**Install monitoring tools:**
```bash
# Install htop for system monitoring
sudo apt install htop iotop nethogs

# Install Node.js process monitoring
npm install -g clinic
```

### 7.3 Database Monitoring

**PostgreSQL monitoring queries:**
```sql
-- Monitor active connections
SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';

-- Monitor slow queries
SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;

-- Monitor index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes ORDER BY idx_scan DESC;
```

## 8. Backup Strategy

### 8.1 Database Backup

**Create backup script (`scripts/backup-db.sh`):**
```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/encore-music"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="encore_music"

mkdir -p $BACKUP_DIR

# Create database backup
pg_dump -h localhost -U encore_user -d $DB_NAME | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Database backup completed: db_backup_$DATE.sql.gz"
```

**Schedule backup:**
```bash
# Add to crontab
0 2 * * * /opt/encore/music-service/scripts/backup-db.sh
```

### 8.2 Redis Backup

**Redis backup script (`scripts/backup-redis.sh`):**
```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/encore-music"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Create Redis backup
redis-cli -a your_redis_password --rdb $BACKUP_DIR/redis_backup_$DATE.rdb

# Keep only last 7 days of backups
find $BACKUP_DIR -name "redis_backup_*.rdb" -mtime +7 -delete

echo "Redis backup completed: redis_backup_$DATE.rdb"
```

## 9. Security Hardening

### 9.1 Firewall Configuration

```bash
# Install UFW
sudo apt install ufw

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow PostgreSQL (only from localhost)
sudo ufw allow from 127.0.0.1 to any port 5432

# Allow Redis (only from localhost)
sudo ufw allow from 127.0.0.1 to any port 6379

# Enable firewall
sudo ufw enable
```

### 9.2 Application Security

**Security checklist:**
- [ ] Environment variables are properly secured
- [ ] JWT secrets are strong and unique
- [ ] Database credentials are secure
- [ ] Redis is password protected
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Input validation is implemented
- [ ] SQL injection protection is in place
- [ ] XSS protection headers are set

## 10. Performance Tuning

### 10.1 Node.js Optimization

**PM2 configuration for performance:**
```javascript
// In ecosystem.config.js
node_args: [
  '--max-old-space-size=1024',
  '--optimize-for-size',
  '--gc-interval=100'
]
```

### 10.2 PostgreSQL Tuning

**Add to `postgresql.conf`:**
```ini
# Memory
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Connections
max_connections = 100

# Checkpoints
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# Query planner
random_page_cost = 1.1
effective_io_concurrency = 200
```

### 10.3 Redis Tuning

**Add to `redis.conf`:**
```redis
# Memory optimization
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64

# Network optimization
tcp-keepalive 300
timeout 0
```

## 11. Deployment Verification

### 11.1 Health Checks

```bash
# Check application health
curl -f http://localhost/health

# Check API endpoints
curl -f http://localhost/api/music/popular

# Check metrics
curl -f http://localhost/metrics

# Check documentation
curl -f http://localhost/api-docs
```

### 11.2 Load Testing

**Install Artillery:**
```bash
npm install -g artillery
```

**Create load test (`load-test.yml`):**
```yaml
config:
  target: 'https://api.encore.yourdomain.com'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 100
  defaults:
    headers:
      Authorization: 'Bearer your-test-token'

scenarios:
  - name: "API Load Test"
    weight: 100
    flow:
      - get:
          url: "/api/music/popular"
      - get:
          url: "/api/music/search?q=test"
      - get:
          url: "/health"
```

**Run load test:**
```bash
artillery run load-test.yml
```

## 12. Troubleshooting

### 12.1 Common Issues

**Application won't start:**
```bash
# Check logs
pm2 logs encore-music-service

# Check environment
node -e "console.log(process.env)"

# Check dependencies
npm audit
```

**Database connection issues:**
```bash
# Test connection
psql -h localhost -U encore_user -d encore_music -c "SELECT 1;"

# Check PostgreSQL status
sudo systemctl status postgresql
```

**Redis connection issues:**
```bash
# Test Redis
redis-cli -a your_redis_password ping

# Check Redis status
sudo systemctl status redis
```

### 12.2 Performance Issues

**High memory usage:**
```bash
# Check Node.js memory
node --inspect server.js

# Monitor with htop
htop

# Check Redis memory
redis-cli -a your_redis_password info memory
```

**Slow queries:**
```sql
-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- Check slow queries
SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
```

## 13. Maintenance

### 13.1 Regular Tasks

**Daily:**
- Monitor application logs
- Check system resources
- Verify backup completion

**Weekly:**
- Review performance metrics
- Update dependencies (security patches)
- Clean old log files

**Monthly:**
- Review and optimize database queries
- Update system packages
- Review security configurations

### 13.2 Update Procedure

```bash
# 1. Backup current version
cp -r /opt/encore/music-service /opt/backups/music-service-$(date +%Y%m%d)

# 2. Pull updates
git pull origin main

# 3. Install dependencies
npm ci --only=production

# 4. Build application
npm run build

# 5. Run migrations (if any)
npm run migrate

# 6. Restart application
pm2 restart encore-music-service

# 7. Verify deployment
curl -f http://localhost/health
```

---

**Deployment Guide Version:** 1.0  
**Last Updated:** $(date)  
**Service:** Encore Music Service  
**Environment:** Production