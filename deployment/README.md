# VoxFlow Deployment Guide

This directory contains all the necessary scripts and documentation for deploying VoxFlow to production environments.

## Files Overview

### Scripts
- **`migrate-database.sh`** - Database migration script with backup and rollback capabilities
- **`verify-deployment.sh`** - Comprehensive deployment verification script

### Documentation
- **`environment-variables.md`** - Complete environment variable documentation
- **`rollback-procedures.md`** - Detailed rollback procedures for emergency situations
- **`deployment-checklist.md`** - Step-by-step deployment checklist

## Quick Start

### Prerequisites

1. **System Requirements**:
   - PostgreSQL 13+ with Supabase
   - Node.js 18+
   - Redis (optional, for caching)
   - SMTP server (for email notifications)

2. **Required Tools**:
   - `curl` - For API testing
   - `jq` - For JSON parsing
   - `pg_dump` and `pg_restore` - For database operations
   - `psql` - For database queries

3. **Environment Variables**:
   ```bash
   # Core Configuration
   export NODE_ENV=production
   export API_BASE_URL=https://api.voxflow.com
   export CLIENT_URL=https://app.voxflow.com
   
   # Database
   export DATABASE_URL=postgresql://user:pass@host:port/db
   export SUPABASE_URL=https://your-project.supabase.co
   export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   export SUPABASE_ANON_KEY=your_anon_key
   
   # Security
   export JWT_SECRET=your_jwt_secret
   export ENCRYPTION_KEY=your_encryption_key
   export ENCRYPTION_IV_KEY=your_iv_key
   
   # Admin Credentials (for verification)
   export ADMIN_EMAIL=admin@voxflow.com
   export ADMIN_PASSWORD=admin_password
   ```

### Deployment Steps

1. **Prepare Environment**:
   ```bash
   # Set environment variables
   source .env.production
   
   # Validate environment
   ./validate-env.sh
   ```

2. **Run Database Migrations**:
   ```bash
   # Run migrations with automatic backup
   ./migrate-database.sh migrate
   
   # Check migration status
   ./migrate-database.sh status
   ```

3. **Deploy Application**:
   ```bash
   # Deploy using your preferred method (Docker, Kubernetes, etc.)
   # Example for Docker:
   docker run -d \
     --name voxflow-api \
     --env-file .env.production \
     -p 3000:3000 \
     voxflow/api:latest
   ```

4. **Verify Deployment**:
   ```bash
   # Run comprehensive verification tests
   ./verify-deployment.sh
   ```

5. **Monitor System**:
   ```bash
   # Check system health
   curl https://api.voxflow.com/health/detailed
   
   # Monitor logs
   tail -f /var/log/voxflow/app.log
   ```

## Deployment Environments

### Development
- **Purpose**: Local development and testing
- **Database**: Local PostgreSQL or development Supabase project
- **Features**: Debug logging, hot reloading, test data
- **URL**: http://localhost:3000

### Staging
- **Purpose**: Pre-production testing and validation
- **Database**: Staging Supabase project with production-like data
- **Features**: Production configuration with enhanced logging
- **URL**: https://staging-api.voxflow.com

### Production
- **Purpose**: Live production environment
- **Database**: Production Supabase project with high availability
- **Features**: Optimized performance, monitoring, alerting
- **URL**: https://api.voxflow.com

## Database Migration Strategy

### Migration Files
Located in `../supabase/migrations/`:
- `001_initial_schema.sql` - Initial database schema
- `002_multi_tenant_architecture.sql` - Multi-tenant enhancements
- `003_data_migration_scripts.sql` - Data migration and backward compatibility
- `004_performance_optimization.sql` - Performance optimizations and monitoring

### Migration Process
1. **Backup**: Automatic backup before migration
2. **Validation**: Validate migration files
3. **Execution**: Apply migrations in order
4. **Verification**: Verify data integrity
5. **Rollback**: Available if issues occur

### Rollback Strategy
- **Point-in-time recovery** for recent issues
- **Full backup restoration** for major problems
- **Migration rollback** for schema issues

## Security Considerations

### Encryption Keys
- Generate unique keys for each environment
- Use strong, random keys (32+ characters)
- Rotate keys regularly (quarterly)
- Store securely using secret management systems

### Database Security
- Use SSL/TLS for all connections
- Implement least-privilege access
- Regular security updates
- Monitor for suspicious activity

### API Security
- Rate limiting enabled
- Input validation and sanitization
- CORS properly configured
- Security headers implemented

## Monitoring and Alerting

### Health Checks
- **Basic**: `/health` - Simple health status
- **Detailed**: `/health/detailed` - Comprehensive system check
- **Readiness**: `/health/readiness` - Kubernetes readiness probe
- **Liveness**: `/health/liveness` - Kubernetes liveness probe
- **Metrics**: `/health/metrics` - Prometheus-style metrics

### Key Metrics
- **Response Time**: API endpoint response times
- **Error Rate**: Application error frequency
- **Database Performance**: Query times, connection count
- **Memory Usage**: Application memory consumption
- **Disk Space**: Available storage space

### Alerting Thresholds
- **Critical**: Error rate > 50%, Response time > 5s
- **High**: Error rate > 10%, Response time > 2s
- **Medium**: Error rate > 5%, Memory usage > 80%
- **Low**: Disk space < 20%, High connection count

## Troubleshooting

### Common Issues

1. **Database Connection Failures**:
   ```bash
   # Check connection string
   echo $DATABASE_URL
   
   # Test connection
   psql $DATABASE_URL -c "SELECT 1;"
   
   # Check firewall/network
   telnet db-host 5432
   ```

2. **Migration Failures**:
   ```bash
   # Check migration status
   ./migrate-database.sh status
   
   # Rollback if needed
   ./migrate-database.sh restore
   
   # Validate migration files
   ./migrate-database.sh validate
   ```

3. **Authentication Issues**:
   ```bash
   # Test login endpoint
   curl -X POST https://api.voxflow.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@voxflow.com","password":"password"}'
   
   # Check JWT secret
   echo $JWT_SECRET | wc -c  # Should be 32+ characters
   ```

4. **Performance Issues**:
   ```bash
   # Check system resources
   top
   df -h
   free -m
   
   # Check database performance
   curl https://api.voxflow.com/api/performance/health
   ```

### Log Locations
- **Application Logs**: `/var/log/voxflow/app.log`
- **Error Logs**: `/var/log/voxflow/error.log`
- **Security Logs**: `/var/log/voxflow/security.log`
- **Database Logs**: Check PostgreSQL/Supabase logs

### Support Contacts
- **Technical Issues**: tech@voxflow.com
- **Deployment Support**: deployment@voxflow.com
- **Security Issues**: security@voxflow.com
- **Emergency**: emergency@voxflow.com

## Best Practices

### Deployment
1. **Always backup** before major changes
2. **Test in staging** before production
3. **Deploy during low-traffic** periods
4. **Monitor closely** after deployment
5. **Have rollback plan** ready

### Security
1. **Use environment variables** for secrets
2. **Rotate keys regularly**
3. **Monitor for vulnerabilities**
4. **Keep dependencies updated**
5. **Implement proper logging**

### Performance
1. **Monitor key metrics** continuously
2. **Optimize database queries**
3. **Use caching** where appropriate
4. **Scale horizontally** when needed
5. **Regular performance testing**

### Maintenance
1. **Regular backups** (daily minimum)
2. **Update dependencies** monthly
3. **Security patches** immediately
4. **Performance reviews** quarterly
5. **Disaster recovery testing** annually

## Additional Resources

- **API Documentation**: https://docs.voxflow.com/api
- **Architecture Guide**: https://docs.voxflow.com/architecture
- **Security Guide**: https://docs.voxflow.com/security
- **Monitoring Guide**: https://docs.voxflow.com/monitoring
- **Troubleshooting Guide**: https://docs.voxflow.com/troubleshooting

---

For the latest deployment documentation, visit: https://docs.voxflow.com/deployment