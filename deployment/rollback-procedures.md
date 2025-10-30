# VoxFlow Production Rollback Procedures

This document provides comprehensive procedures for rolling back VoxFlow deployments in production environments, including database rollbacks, application rollbacks, and emergency recovery procedures.

## Table of Contents

1. [Overview](#overview)
2. [Rollback Decision Matrix](#rollback-decision-matrix)
3. [Database Rollback Procedures](#database-rollback-procedures)
4. [Application Rollback Procedures](#application-rollback-procedures)
5. [Emergency Rollback Procedures](#emergency-rollback-procedures)
6. [Post-Rollback Procedures](#post-rollback-procedures)
7. [Prevention and Monitoring](#prevention-and-monitoring)

## Overview

### When to Rollback

Rollback should be considered in the following scenarios:
- **Critical bugs** affecting core functionality
- **Data corruption** or integrity issues
- **Performance degradation** beyond acceptable thresholds
- **Security vulnerabilities** discovered post-deployment
- **Service unavailability** or high error rates
- **User-reported critical issues** that cannot be quickly resolved

### Rollback Types

1. **Application Rollback**: Revert to previous application version
2. **Database Rollback**: Restore database to previous state
3. **Configuration Rollback**: Revert configuration changes
4. **Full System Rollback**: Complete reversion of all components

### Rollback Principles

- **Speed**: Minimize downtime during rollback
- **Safety**: Ensure data integrity throughout the process
- **Communication**: Keep stakeholders informed
- **Documentation**: Record all actions taken
- **Learning**: Conduct post-incident analysis

## Rollback Decision Matrix

### Severity Levels

| Severity | Description | Response Time | Rollback Decision |
|----------|-------------|---------------|-------------------|
| **Critical** | System down, data loss, security breach | Immediate | Automatic rollback |
| **High** | Major functionality broken, significant user impact | 15 minutes | Rollback recommended |
| **Medium** | Minor functionality issues, limited user impact | 1 hour | Fix forward preferred |
| **Low** | Cosmetic issues, no functional impact | 4 hours | Fix forward |

### Decision Flowchart

```
Issue Detected
      ↓
Is system functional? → Yes → Can issue be fixed quickly? → Yes → Fix forward
      ↓ No                                    ↓ No
Is data at risk? → Yes → IMMEDIATE ROLLBACK
      ↓ No
Is user impact severe? → Yes → Rollback recommended
      ↓ No
Monitor and fix forward
```

## Database Rollback Procedures

### Pre-Rollback Checklist

- [ ] Identify the target rollback point
- [ ] Verify backup availability and integrity
- [ ] Estimate rollback duration
- [ ] Notify stakeholders of planned rollback
- [ ] Put system in maintenance mode
- [ ] Stop all background jobs and processes

### Database Rollback Methods

#### Method 1: Point-in-Time Recovery (Preferred)

```bash
#!/bin/bash
# Point-in-time recovery rollback

# Configuration
BACKUP_TIMESTAMP="2024-01-01 12:00:00"
DATABASE_NAME="voxflow_prod"
RECOVERY_DATABASE_NAME="voxflow_recovery"

# Step 1: Create recovery database
echo "Creating recovery database..."
createdb $RECOVERY_DATABASE_NAME

# Step 2: Restore to point in time
echo "Restoring database to $BACKUP_TIMESTAMP..."
pg_restore \
    --host=$DB_HOST \
    --port=$DB_PORT \
    --username=$DB_USER \
    --dbname=$RECOVERY_DATABASE_NAME \
    --verbose \
    --clean \
    --if-exists \
    $BACKUP_FILE

# Step 3: Verify data integrity
echo "Verifying data integrity..."
psql -d $RECOVERY_DATABASE_NAME -c "
    SELECT 
        COUNT(*) as user_count,
        MAX(created_at) as latest_user,
        COUNT(DISTINCT id) as unique_users
    FROM users;
"

# Step 4: Switch databases (requires downtime)
echo "Switching to recovery database..."
psql -c "ALTER DATABASE $DATABASE_NAME RENAME TO ${DATABASE_NAME}_old;"
psql -c "ALTER DATABASE $RECOVERY_DATABASE_NAME RENAME TO $DATABASE_NAME;"

echo "Database rollback completed"
```

#### Method 2: Backup Restoration

```bash
#!/bin/bash
# Full backup restoration rollback

# Configuration
BACKUP_FILE="/backups/voxflow_prod_20240101_120000.sql"
DATABASE_NAME="voxflow_prod"

# Step 1: Verify backup file
if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Step 2: Create backup of current state (for potential re-rollback)
echo "Creating backup of current state..."
pg_dump \
    --host=$DB_HOST \
    --port=$DB_PORT \
    --username=$DB_USER \
    --dbname=$DATABASE_NAME \
    --format=custom \
    --file="/backups/pre_rollback_$(date +%Y%m%d_%H%M%S).sql"

# Step 3: Drop and recreate database
echo "WARNING: This will completely replace the current database!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [[ "$confirm" != "yes" ]]; then
    echo "Rollback cancelled"
    exit 1
fi

# Step 4: Restore from backup
echo "Restoring database from backup..."
pg_restore \
    --host=$DB_HOST \
    --port=$DB_PORT \
    --username=$DB_USER \
    --dbname=$DATABASE_NAME \
    --clean \
    --if-exists \
    --verbose \
    "$BACKUP_FILE"

echo "Database restoration completed"
```

#### Method 3: Migration Rollback

```bash
#!/bin/bash
# Migration-based rollback

# Configuration
TARGET_MIGRATION="002"  # Migration to rollback to
MIGRATIONS_DIR="./supabase/migrations"

# Step 1: Identify current migration
CURRENT_MIGRATION=$(psql -d $DATABASE_NAME -t -c "
    SELECT version FROM schema_migrations 
    ORDER BY version DESC LIMIT 1;
" | tr -d ' ')

echo "Current migration: $CURRENT_MIGRATION"
echo "Target migration: $TARGET_MIGRATION"

# Step 2: Create rollback migrations
echo "Creating rollback migrations..."
for migration in $(ls $MIGRATIONS_DIR/*.sql | sort -r); do
    migration_version=$(basename "$migration" .sql | grep -o '^[0-9]\+')
    
    if [[ "$migration_version" -gt "$TARGET_MIGRATION" ]]; then
        echo "Rolling back migration: $migration_version"
        
        # Apply rollback (if rollback script exists)
        rollback_file="${MIGRATIONS_DIR}/rollback_${migration_version}.sql"
        if [[ -f "$rollback_file" ]]; then
            psql -d $DATABASE_NAME -f "$rollback_file"
        else
            echo "WARNING: No rollback script found for migration $migration_version"
        fi
        
        # Remove from schema_migrations
        psql -d $DATABASE_NAME -c "
            DELETE FROM schema_migrations WHERE version = '$migration_version';
        "
    fi
done

echo "Migration rollback completed"
```

### Database Rollback Verification

```sql
-- Verification queries after database rollback

-- Check user count and latest records
SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_active = true) as active_users,
    MAX(created_at) as latest_user_created,
    MIN(created_at) as earliest_user_created
FROM users;

-- Check agent count and ownership
SELECT 
    COUNT(*) as total_agents,
    COUNT(DISTINCT user_id) as users_with_agents,
    MAX(created_at) as latest_agent_created
FROM agents;

-- Check campaign data
SELECT 
    COUNT(*) as total_campaigns,
    COUNT(*) FILTER (WHERE status = 'active') as active_campaigns,
    MAX(created_at) as latest_campaign_created
FROM campaigns;

-- Check usage tracking data
SELECT 
    COUNT(*) as total_usage_records,
    MAX(date) as latest_usage_date,
    SUM(total_tokens) as total_tokens_tracked
FROM user_usage_tracking;

-- Check API keys (count only, not actual keys)
SELECT 
    COUNT(*) as total_api_keys,
    COUNT(DISTINCT user_id) as users_with_keys,
    COUNT(*) FILTER (WHERE is_active = true) as active_keys
FROM user_api_keys;
```

## Application Rollback Procedures

### Container-Based Rollback (Docker/Kubernetes)

#### Docker Rollback

```bash
#!/bin/bash
# Docker application rollback

# Configuration
PREVIOUS_VERSION="v1.2.3"
CURRENT_VERSION="v1.2.4"
CONTAINER_NAME="voxflow-api"
IMAGE_NAME="voxflow/api"

# Step 1: Stop current container
echo "Stopping current container..."
docker stop $CONTAINER_NAME

# Step 2: Remove current container
echo "Removing current container..."
docker rm $CONTAINER_NAME

# Step 3: Start previous version
echo "Starting previous version: $PREVIOUS_VERSION"
docker run -d \
    --name $CONTAINER_NAME \
    --env-file .env.production \
    -p 3000:3000 \
    $IMAGE_NAME:$PREVIOUS_VERSION

# Step 4: Verify rollback
echo "Verifying application health..."
sleep 30
curl -f http://localhost:3000/health || {
    echo "Health check failed after rollback"
    exit 1
}

echo "Application rollback completed successfully"
```

#### Kubernetes Rollback

```bash
#!/bin/bash
# Kubernetes application rollback

# Configuration
NAMESPACE="voxflow-prod"
DEPLOYMENT_NAME="voxflow-api"

# Step 1: Check rollout history
echo "Checking rollout history..."
kubectl rollout history deployment/$DEPLOYMENT_NAME -n $NAMESPACE

# Step 2: Rollback to previous version
echo "Rolling back to previous version..."
kubectl rollout undo deployment/$DEPLOYMENT_NAME -n $NAMESPACE

# Step 3: Wait for rollback to complete
echo "Waiting for rollback to complete..."
kubectl rollout status deployment/$DEPLOYMENT_NAME -n $NAMESPACE --timeout=300s

# Step 4: Verify pods are running
echo "Verifying pod status..."
kubectl get pods -n $NAMESPACE -l app=$DEPLOYMENT_NAME

# Step 5: Check application health
echo "Checking application health..."
kubectl exec -n $NAMESPACE deployment/$DEPLOYMENT_NAME -- curl -f http://localhost:3000/health

echo "Kubernetes rollback completed successfully"
```

### Load Balancer and Traffic Management

#### Blue-Green Deployment Rollback

```bash
#!/bin/bash
# Blue-green deployment rollback

# Configuration
LOAD_BALANCER="voxflow-lb"
BLUE_ENVIRONMENT="voxflow-blue"
GREEN_ENVIRONMENT="voxflow-green"
CURRENT_ACTIVE="green"  # Currently active environment

# Step 1: Identify target environment
if [[ "$CURRENT_ACTIVE" == "green" ]]; then
    TARGET_ENVIRONMENT="$BLUE_ENVIRONMENT"
    echo "Rolling back from green to blue environment"
else
    TARGET_ENVIRONMENT="$GREEN_ENVIRONMENT"
    echo "Rolling back from blue to green environment"
fi

# Step 2: Verify target environment health
echo "Verifying target environment health..."
curl -f "http://$TARGET_ENVIRONMENT:3000/health" || {
    echo "Target environment is not healthy"
    exit 1
}

# Step 3: Switch traffic
echo "Switching traffic to $TARGET_ENVIRONMENT..."
# This depends on your load balancer configuration
# Example for AWS ALB:
aws elbv2 modify-listener \
    --listener-arn $LISTENER_ARN \
    --default-actions Type=forward,TargetGroupArn=$TARGET_ENVIRONMENT_TG_ARN

# Step 4: Verify traffic switch
echo "Verifying traffic switch..."
sleep 30
curl -f "http://$LOAD_BALANCER/health" || {
    echo "Health check failed after traffic switch"
    exit 1
}

echo "Blue-green rollback completed successfully"
```

### Configuration Rollback

```bash
#!/bin/bash
# Configuration rollback

# Configuration
CONFIG_BACKUP_DIR="/backups/config"
CURRENT_CONFIG_DIR="/app/config"

# Step 1: Find latest config backup
LATEST_BACKUP=$(ls -t $CONFIG_BACKUP_DIR/config_backup_*.tar.gz | head -1)

if [[ -z "$LATEST_BACKUP" ]]; then
    echo "No configuration backup found"
    exit 1
fi

echo "Rolling back to configuration: $LATEST_BACKUP"

# Step 2: Backup current configuration
echo "Backing up current configuration..."
tar -czf "$CONFIG_BACKUP_DIR/config_backup_$(date +%Y%m%d_%H%M%S).tar.gz" -C "$CURRENT_CONFIG_DIR" .

# Step 3: Restore previous configuration
echo "Restoring previous configuration..."
rm -rf "$CURRENT_CONFIG_DIR"/*
tar -xzf "$LATEST_BACKUP" -C "$CURRENT_CONFIG_DIR"

# Step 4: Restart application to pick up new config
echo "Restarting application..."
systemctl restart voxflow-api

# Step 5: Verify configuration
echo "Verifying configuration..."
sleep 10
curl -f http://localhost:3000/health || {
    echo "Health check failed after configuration rollback"
    exit 1
}

echo "Configuration rollback completed successfully"
```

## Emergency Rollback Procedures

### Automated Emergency Rollback

```bash
#!/bin/bash
# Automated emergency rollback script

# This script should be triggered by monitoring alerts
# when critical issues are detected

# Configuration
ALERT_THRESHOLD_ERROR_RATE=50  # 50% error rate
ALERT_THRESHOLD_RESPONSE_TIME=5000  # 5 seconds
ROLLBACK_TIMEOUT=300  # 5 minutes

# Step 1: Verify emergency conditions
echo "Verifying emergency conditions..."

# Check error rate
ERROR_RATE=$(curl -s http://localhost:3000/api/monitoring/metrics/error-rate | jq '.error_rate')
if [[ $(echo "$ERROR_RATE > $ALERT_THRESHOLD_ERROR_RATE" | bc) -eq 1 ]]; then
    echo "EMERGENCY: Error rate is $ERROR_RATE% (threshold: $ALERT_THRESHOLD_ERROR_RATE%)"
    EMERGENCY_ROLLBACK=true
fi

# Check response time
RESPONSE_TIME=$(curl -s http://localhost:3000/api/monitoring/metrics/response-time | jq '.avg_response_time')
if [[ $(echo "$RESPONSE_TIME > $ALERT_THRESHOLD_RESPONSE_TIME" | bc) -eq 1 ]]; then
    echo "EMERGENCY: Response time is ${RESPONSE_TIME}ms (threshold: ${ALERT_THRESHOLD_RESPONSE_TIME}ms)"
    EMERGENCY_ROLLBACK=true
fi

# Step 2: Execute emergency rollback if conditions are met
if [[ "$EMERGENCY_ROLLBACK" == "true" ]]; then
    echo "EXECUTING EMERGENCY ROLLBACK"
    
    # Send alert notifications
    curl -X POST "$SLACK_WEBHOOK_URL" -d '{
        "text": "🚨 EMERGENCY ROLLBACK INITIATED - VoxFlow Production",
        "channel": "#alerts",
        "username": "VoxFlow Monitor"
    }'
    
    # Execute rollback
    timeout $ROLLBACK_TIMEOUT ./rollback-application.sh
    
    if [[ $? -eq 0 ]]; then
        echo "Emergency rollback completed successfully"
        curl -X POST "$SLACK_WEBHOOK_URL" -d '{
            "text": "✅ Emergency rollback completed successfully",
            "channel": "#alerts",
            "username": "VoxFlow Monitor"
        }'
    else
        echo "Emergency rollback failed or timed out"
        curl -X POST "$SLACK_WEBHOOK_URL" -d '{
            "text": "❌ Emergency rollback FAILED - Manual intervention required",
            "channel": "#alerts",
            "username": "VoxFlow Monitor"
        }'
    fi
else
    echo "No emergency conditions detected"
fi
```

### Manual Emergency Rollback

```bash
#!/bin/bash
# Manual emergency rollback - for use by operations team

echo "=== VoxFlow Emergency Rollback ==="
echo "This script will perform a complete system rollback"
echo "Current time: $(date)"

# Step 1: Confirmation
read -p "Are you sure you want to proceed with emergency rollback? (type 'EMERGENCY' to confirm): " confirm
if [[ "$confirm" != "EMERGENCY" ]]; then
    echo "Rollback cancelled"
    exit 1
fi

# Step 2: Put system in maintenance mode
echo "Putting system in maintenance mode..."
curl -X POST http://localhost:3000/api/admin/maintenance \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{"enabled": true, "message": "Emergency maintenance - system rollback in progress"}'

# Step 3: Stop all background processes
echo "Stopping background processes..."
systemctl stop voxflow-worker
systemctl stop voxflow-scheduler

# Step 4: Database rollback
echo "Starting database rollback..."
./rollback-database.sh emergency

# Step 5: Application rollback
echo "Starting application rollback..."
./rollback-application.sh emergency

# Step 6: Verify system health
echo "Verifying system health..."
sleep 30
if curl -f http://localhost:3000/health; then
    echo "System health check passed"
else
    echo "System health check failed - manual intervention required"
    exit 1
fi

# Step 7: Disable maintenance mode
echo "Disabling maintenance mode..."
curl -X POST http://localhost:3000/api/admin/maintenance \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{"enabled": false}'

# Step 8: Restart background processes
echo "Restarting background processes..."
systemctl start voxflow-worker
systemctl start voxflow-scheduler

echo "Emergency rollback completed successfully"
echo "Please monitor system closely and conduct post-incident analysis"
```

## Post-Rollback Procedures

### Verification Checklist

After any rollback, complete this verification checklist:

- [ ] **System Health**: All health checks are passing
- [ ] **Database Integrity**: Data consistency checks completed
- [ ] **User Authentication**: Login functionality working
- [ ] **Core Features**: Agent creation, campaigns, API calls working
- [ ] **External Services**: Groq, Deepgram, Twilio connectivity verified
- [ ] **Monitoring**: All monitoring systems are operational
- [ ] **Performance**: Response times within acceptable ranges
- [ ] **Error Rates**: Error rates back to normal levels

### Post-Rollback Communication

```bash
#!/bin/bash
# Post-rollback communication script

# Configuration
INCIDENT_ID="INC-$(date +%Y%m%d-%H%M%S)"
ROLLBACK_TIME=$(date)

# Step 1: Update status page
curl -X POST "$STATUS_PAGE_API" \
    -H "Authorization: Bearer $STATUS_PAGE_TOKEN" \
    -d '{
        "status": "operational",
        "message": "System has been rolled back and is now operational. We are investigating the root cause."
    }'

# Step 2: Send internal notification
curl -X POST "$SLACK_WEBHOOK_URL" -d "{
    \"text\": \"📋 Post-Rollback Status Update\",
    \"attachments\": [{
        \"color\": \"good\",
        \"fields\": [
            {\"title\": \"Incident ID\", \"value\": \"$INCIDENT_ID\", \"short\": true},
            {\"title\": \"Rollback Time\", \"value\": \"$ROLLBACK_TIME\", \"short\": true},
            {\"title\": \"Status\", \"value\": \"System Operational\", \"short\": true},
            {\"title\": \"Next Steps\", \"value\": \"Root cause analysis in progress\", \"short\": true}
        ]
    }]
}"

# Step 3: Send customer notification (if needed)
if [[ "$CUSTOMER_NOTIFICATION_REQUIRED" == "true" ]]; then
    curl -X POST "$EMAIL_API_ENDPOINT" \
        -H "Authorization: Bearer $EMAIL_API_TOKEN" \
        -d '{
            "to": "customers@voxflow.com",
            "subject": "VoxFlow Service Restored",
            "body": "We have resolved the service issues and VoxFlow is now fully operational. We apologize for any inconvenience caused."
        }'
fi

echo "Post-rollback communications sent"
```

### Root Cause Analysis

```markdown
# Post-Rollback Root Cause Analysis Template

## Incident Summary
- **Incident ID**: INC-YYYYMMDD-HHMMSS
- **Date/Time**: [Incident start time]
- **Duration**: [Total incident duration]
- **Rollback Time**: [Time to complete rollback]
- **Impact**: [Description of user impact]

## Timeline
- **[Time]**: Issue first detected
- **[Time]**: Investigation started
- **[Time]**: Rollback decision made
- **[Time]**: Rollback initiated
- **[Time]**: Rollback completed
- **[Time]**: Service restored

## Root Cause
[Detailed description of what caused the issue]

## Contributing Factors
- [Factor 1]
- [Factor 2]
- [Factor 3]

## What Went Well
- [Positive aspects of the response]

## What Could Be Improved
- [Areas for improvement]

## Action Items
- [ ] [Action item 1] - Owner: [Name] - Due: [Date]
- [ ] [Action item 2] - Owner: [Name] - Due: [Date]
- [ ] [Action item 3] - Owner: [Name] - Due: [Date]

## Prevention Measures
- [Measure 1]
- [Measure 2]
- [Measure 3]
```

## Prevention and Monitoring

### Automated Monitoring

```javascript
// monitoring-alerts.js
// Automated monitoring to prevent the need for rollbacks

const monitoringChecks = {
    // Error rate monitoring
    errorRate: {
        threshold: 5, // 5% error rate
        window: '5m',
        alert: 'high'
    },
    
    // Response time monitoring
    responseTime: {
        threshold: 2000, // 2 seconds
        window: '5m',
        alert: 'medium'
    },
    
    // Database performance
    databasePerformance: {
        connectionCount: { threshold: 80, alert: 'medium' },
        queryTime: { threshold: 1000, alert: 'high' },
        lockWaits: { threshold: 5, alert: 'high' }
    },
    
    // Memory usage
    memoryUsage: {
        threshold: 85, // 85% memory usage
        window: '5m',
        alert: 'medium'
    },
    
    // Disk space
    diskSpace: {
        threshold: 90, // 90% disk usage
        alert: 'high'
    }
};

// Alert configuration
const alertChannels = {
    slack: process.env.SLACK_WEBHOOK_URL,
    email: process.env.ALERT_EMAIL,
    pagerduty: process.env.PAGERDUTY_INTEGRATION_KEY
};
```

### Deployment Safety Measures

```bash
#!/bin/bash
# Pre-deployment safety checks

# Step 1: Run automated tests
echo "Running automated tests..."
npm test || {
    echo "Tests failed - deployment aborted"
    exit 1
}

# Step 2: Check database migration safety
echo "Checking database migrations..."
./validate-migrations.sh || {
    echo "Migration validation failed - deployment aborted"
    exit 1
}

# Step 3: Verify backup availability
echo "Verifying backup availability..."
if [[ ! -f "$LATEST_BACKUP" ]]; then
    echo "No recent backup found - creating backup..."
    ./create-backup.sh
fi

# Step 4: Check system resources
echo "Checking system resources..."
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [[ $MEMORY_USAGE -gt 80 ]]; then
    echo "High memory usage detected: ${MEMORY_USAGE}% - deployment may be risky"
    read -p "Continue anyway? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        exit 1
    fi
fi

echo "Pre-deployment checks passed"
```

### Rollback Testing

```bash
#!/bin/bash
# Regular rollback testing (run in staging)

echo "=== Rollback Testing ==="
echo "This script tests rollback procedures in staging environment"

# Step 1: Deploy test version
echo "Deploying test version..."
./deploy.sh staging test-version

# Step 2: Verify deployment
echo "Verifying test deployment..."
curl -f https://staging.voxflow.com/health || {
    echo "Test deployment failed"
    exit 1
}

# Step 3: Test rollback procedure
echo "Testing rollback procedure..."
./rollback-application.sh staging

# Step 4: Verify rollback
echo "Verifying rollback..."
curl -f https://staging.voxflow.com/health || {
    echo "Rollback test failed"
    exit 1
}

# Step 5: Test database rollback
echo "Testing database rollback..."
./rollback-database.sh staging test

echo "Rollback testing completed successfully"
```

## Contact Information

### Emergency Contacts

- **On-Call Engineer**: +1-XXX-XXX-XXXX
- **Database Administrator**: +1-XXX-XXX-XXXX
- **DevOps Lead**: +1-XXX-XXX-XXXX
- **Engineering Manager**: +1-XXX-XXX-XXXX

### Communication Channels

- **Slack**: #voxflow-incidents
- **Email**: incidents@voxflow.com
- **Status Page**: status.voxflow.com
- **Documentation**: docs.voxflow.com/rollback

---

This document should be reviewed and updated regularly. All team members should be familiar with these procedures and participate in regular rollback drills.