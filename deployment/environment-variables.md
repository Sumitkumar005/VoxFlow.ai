# VoxFlow Environment Variables Documentation

This document provides comprehensive documentation for all environment variables required to deploy and run VoxFlow in production.

## Table of Contents

1. [Required Variables](#required-variables)
2. [Optional Variables](#optional-variables)
3. [Environment-Specific Configurations](#environment-specific-configurations)
4. [Security Considerations](#security-considerations)
5. [Validation and Testing](#validation-and-testing)

## Required Variables

### Database Configuration

#### `DATABASE_URL`
- **Description**: PostgreSQL connection string for the main database
- **Format**: `postgresql://username:password@host:port/database`
- **Example**: `postgresql://voxflow_user:secure_password@db.example.com:5432/voxflow_prod`
- **Required**: Yes
- **Environment**: All

#### `SUPABASE_URL`
- **Description**: Supabase project URL
- **Format**: `https://your-project-id.supabase.co`
- **Example**: `https://abcdefghijklmnop.supabase.co`
- **Required**: Yes
- **Environment**: All

#### `SUPABASE_SERVICE_ROLE_KEY`
- **Description**: Supabase service role key for admin operations
- **Format**: JWT token string
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Required**: Yes
- **Environment**: All
- **Security**: High - Keep secret, rotate regularly

#### `SUPABASE_ANON_KEY`
- **Description**: Supabase anonymous key for client-side operations
- **Format**: JWT token string
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Required**: Yes
- **Environment**: All

### Authentication & Security

#### `JWT_SECRET`
- **Description**: Secret key for signing JWT tokens
- **Format**: Random string (minimum 32 characters)
- **Example**: `your-super-secret-jwt-key-here-make-it-long-and-random`
- **Required**: Yes
- **Environment**: All
- **Security**: Critical - Must be unique per environment

#### `ENCRYPTION_KEY`
- **Description**: AES-256 encryption key for API key storage
- **Format**: 32-byte hex string (64 characters)
- **Example**: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`
- **Required**: Yes
- **Environment**: All
- **Security**: Critical - Must be unique per environment
- **Generation**: `openssl rand -hex 32`

#### `ENCRYPTION_IV_KEY`
- **Description**: Base key for generating initialization vectors
- **Format**: 16-byte hex string (32 characters)
- **Example**: `1234567890abcdef1234567890abcdef`
- **Required**: Yes
- **Environment**: All
- **Security**: Critical - Must be unique per environment
- **Generation**: `openssl rand -hex 16`

### Application Configuration

#### `NODE_ENV`
- **Description**: Node.js environment mode
- **Values**: `development`, `staging`, `production`
- **Example**: `production`
- **Required**: Yes
- **Environment**: All

#### `PORT`
- **Description**: Port number for the application server
- **Format**: Integer (1-65535)
- **Example**: `3000`
- **Required**: No (defaults to 3000)
- **Environment**: All

#### `CLIENT_URL`
- **Description**: Frontend application URL for CORS configuration
- **Format**: Full URL with protocol
- **Example**: `https://app.voxflow.com`
- **Required**: Yes
- **Environment**: All

#### `API_BASE_URL`
- **Description**: Base URL for the API server
- **Format**: Full URL with protocol
- **Example**: `https://api.voxflow.com`
- **Required**: Yes
- **Environment**: All

### External Service Providers

#### `GROQ_API_KEY` (Admin Default)
- **Description**: Default Groq API key for system operations
- **Format**: Groq API key format
- **Example**: `gsk_1234567890abcdef...`
- **Required**: No (users provide their own)
- **Environment**: All
- **Security**: High - Keep secret

#### `DEEPGRAM_API_KEY` (Admin Default)
- **Description**: Default Deepgram API key for system operations
- **Format**: Deepgram API key format
- **Example**: `1234567890abcdef...`
- **Required**: No (users provide their own)
- **Environment**: All
- **Security**: High - Keep secret

#### `TWILIO_ACCOUNT_SID` (Admin Default)
- **Description**: Default Twilio Account SID for system operations
- **Format**: Twilio SID format
- **Example**: `AC1234567890abcdef...`
- **Required**: No (users provide their own)
- **Environment**: All

#### `TWILIO_AUTH_TOKEN` (Admin Default)
- **Description**: Default Twilio Auth Token for system operations
- **Format**: Twilio token format
- **Example**: `1234567890abcdef...`
- **Required**: No (users provide their own)
- **Environment**: All
- **Security**: High - Keep secret

## Optional Variables

### Logging and Monitoring

#### `LOG_LEVEL`
- **Description**: Logging level for the application
- **Values**: `error`, `warn`, `info`, `debug`
- **Default**: `info`
- **Example**: `info`
- **Environment**: All

#### `LOG_FORMAT`
- **Description**: Log output format
- **Values**: `json`, `simple`, `combined`
- **Default**: `json`
- **Example**: `json`
- **Environment**: All

#### `ENABLE_REQUEST_LOGGING`
- **Description**: Enable detailed request logging
- **Values**: `true`, `false`
- **Default**: `true`
- **Example**: `true`
- **Environment**: All

### Performance and Scaling

#### `MAX_CONNECTIONS`
- **Description**: Maximum database connections in pool
- **Format**: Integer
- **Default**: `20`
- **Example**: `50`
- **Environment**: Production

#### `CONNECTION_TIMEOUT`
- **Description**: Database connection timeout in milliseconds
- **Format**: Integer
- **Default**: `30000`
- **Example**: `30000`
- **Environment**: All

#### `QUERY_TIMEOUT`
- **Description**: Database query timeout in milliseconds
- **Format**: Integer
- **Default**: `60000`
- **Example**: `60000`
- **Environment**: All

#### `RATE_LIMIT_WINDOW_MS`
- **Description**: Rate limiting window in milliseconds
- **Format**: Integer
- **Default**: `900000` (15 minutes)
- **Example**: `900000`
- **Environment**: All

#### `RATE_LIMIT_MAX_REQUESTS`
- **Description**: Maximum requests per window
- **Format**: Integer
- **Default**: `1000`
- **Example**: `1000`
- **Environment**: All

### Cache Configuration

#### `REDIS_URL`
- **Description**: Redis connection string for caching
- **Format**: `redis://username:password@host:port/database`
- **Example**: `redis://user:pass@redis.example.com:6379/0`
- **Required**: No (falls back to memory cache)
- **Environment**: Production (recommended)

#### `CACHE_TTL`
- **Description**: Default cache time-to-live in seconds
- **Format**: Integer
- **Default**: `3600` (1 hour)
- **Example**: `3600`
- **Environment**: All

### Email Configuration

#### `SMTP_HOST`
- **Description**: SMTP server hostname
- **Format**: Hostname or IP address
- **Example**: `smtp.gmail.com`
- **Required**: No (disables email features)
- **Environment**: Production

#### `SMTP_PORT`
- **Description**: SMTP server port
- **Format**: Integer
- **Default**: `587`
- **Example**: `587`
- **Environment**: Production

#### `SMTP_USER`
- **Description**: SMTP authentication username
- **Format**: Email address or username
- **Example**: `noreply@voxflow.com`
- **Required**: If SMTP_HOST is set
- **Environment**: Production

#### `SMTP_PASS`
- **Description**: SMTP authentication password
- **Format**: Password string
- **Example**: `smtp_password_here`
- **Required**: If SMTP_HOST is set
- **Environment**: Production
- **Security**: High - Keep secret

#### `FROM_EMAIL`
- **Description**: Default sender email address
- **Format**: Email address
- **Example**: `noreply@voxflow.com`
- **Default**: Uses SMTP_USER
- **Environment**: Production

### Monitoring and Analytics

#### `SENTRY_DSN`
- **Description**: Sentry DSN for error tracking
- **Format**: Sentry DSN URL
- **Example**: `https://abc123@o123456.ingest.sentry.io/123456`
- **Required**: No
- **Environment**: Production (recommended)

#### `ANALYTICS_ENABLED`
- **Description**: Enable analytics collection
- **Values**: `true`, `false`
- **Default**: `true`
- **Example**: `true`
- **Environment**: All

#### `METRICS_ENABLED`
- **Description**: Enable metrics collection
- **Values**: `true`, `false`
- **Default**: `true`
- **Example**: `true`
- **Environment**: All

### Feature Flags

#### `ENABLE_REGISTRATION`
- **Description**: Allow new user registration
- **Values**: `true`, `false`
- **Default**: `true`
- **Example**: `true`
- **Environment**: All

#### `ENABLE_ADMIN_PANEL`
- **Description**: Enable admin panel features
- **Values**: `true`, `false`
- **Default**: `true`
- **Example**: `true`
- **Environment**: All

#### `MAINTENANCE_MODE`
- **Description**: Enable maintenance mode
- **Values**: `true`, `false`
- **Default**: `false`
- **Example**: `false`
- **Environment**: All

## Environment-Specific Configurations

### Development Environment

```bash
# Development .env file
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:5173
API_BASE_URL=http://localhost:3000

# Database (local or development instance)
DATABASE_URL=postgresql://voxflow_dev:dev_password@localhost:5432/voxflow_dev
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_dev_service_role_key
SUPABASE_ANON_KEY=your_dev_anon_key

# Security (use different keys for each environment)
JWT_SECRET=dev-jwt-secret-key-make-it-long-and-random
ENCRYPTION_KEY=dev1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
ENCRYPTION_IV_KEY=dev1234567890abcdef1234567890abcdef

# Logging
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true

# Features
ENABLE_REGISTRATION=true
ENABLE_ADMIN_PANEL=true
MAINTENANCE_MODE=false
```

### Staging Environment

```bash
# Staging .env file
NODE_ENV=staging
PORT=3000
CLIENT_URL=https://staging.voxflow.com
API_BASE_URL=https://api-staging.voxflow.com

# Database (staging instance)
DATABASE_URL=postgresql://voxflow_staging:staging_password@staging-db.example.com:5432/voxflow_staging
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_staging_service_role_key
SUPABASE_ANON_KEY=your_staging_anon_key

# Security (unique keys for staging)
JWT_SECRET=staging-jwt-secret-key-make-it-long-and-random
ENCRYPTION_KEY=staging1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
ENCRYPTION_IV_KEY=staging1234567890abcdef1234567890abcdef

# Performance
MAX_CONNECTIONS=30
CONNECTION_TIMEOUT=30000
QUERY_TIMEOUT=60000

# Caching
REDIS_URL=redis://staging-redis.example.com:6379/0
CACHE_TTL=1800

# Monitoring
SENTRY_DSN=https://your-staging-sentry-dsn
LOG_LEVEL=info
ANALYTICS_ENABLED=true
METRICS_ENABLED=true

# Email (staging SMTP)
SMTP_HOST=smtp.staging.example.com
SMTP_PORT=587
SMTP_USER=noreply@staging.voxflow.com
SMTP_PASS=staging_smtp_password
FROM_EMAIL=noreply@staging.voxflow.com

# Features
ENABLE_REGISTRATION=true
ENABLE_ADMIN_PANEL=true
MAINTENANCE_MODE=false
```

### Production Environment

```bash
# Production .env file
NODE_ENV=production
PORT=3000
CLIENT_URL=https://app.voxflow.com
API_BASE_URL=https://api.voxflow.com

# Database (production instance with high availability)
DATABASE_URL=postgresql://voxflow_prod:secure_prod_password@prod-db.example.com:5432/voxflow_prod
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_prod_service_role_key
SUPABASE_ANON_KEY=your_prod_anon_key

# Security (strong, unique keys for production)
JWT_SECRET=production-jwt-secret-key-make-it-very-long-and-random-and-secure
ENCRYPTION_KEY=prod1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
ENCRYPTION_IV_KEY=prod1234567890abcdef1234567890abcdef

# Performance (optimized for production load)
MAX_CONNECTIONS=100
CONNECTION_TIMEOUT=30000
QUERY_TIMEOUT=60000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Caching (production Redis cluster)
REDIS_URL=redis://prod-redis-cluster.example.com:6379/0
CACHE_TTL=3600

# Monitoring (production monitoring services)
SENTRY_DSN=https://your-production-sentry-dsn
LOG_LEVEL=warn
ANALYTICS_ENABLED=true
METRICS_ENABLED=true

# Email (production SMTP service)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
FROM_EMAIL=noreply@voxflow.com

# Features
ENABLE_REGISTRATION=true
ENABLE_ADMIN_PANEL=true
MAINTENANCE_MODE=false

# Default provider keys (optional - users provide their own)
GROQ_API_KEY=your_default_groq_key
DEEPGRAM_API_KEY=your_default_deepgram_key
TWILIO_ACCOUNT_SID=your_default_twilio_sid
TWILIO_AUTH_TOKEN=your_default_twilio_token
```

## Security Considerations

### Encryption Keys

1. **Generate Unique Keys**: Each environment must have unique encryption keys
2. **Key Rotation**: Rotate encryption keys regularly (quarterly recommended)
3. **Key Storage**: Store keys securely using environment variable management systems
4. **Key Length**: Use full-length keys (32 bytes for AES-256, 16 bytes for IV)

#### Key Generation Commands

```bash
# Generate encryption key (32 bytes = 64 hex characters)
openssl rand -hex 32

# Generate IV key (16 bytes = 32 hex characters)
openssl rand -hex 16

# Generate JWT secret (random string)
openssl rand -base64 32
```

### Database Security

1. **Connection Encryption**: Always use SSL/TLS for database connections
2. **User Permissions**: Use dedicated database users with minimal required permissions
3. **Password Strength**: Use strong, unique passwords for each environment
4. **Network Security**: Restrict database access to application servers only

### API Key Security

1. **Provider Keys**: Never commit provider API keys to version control
2. **Key Rotation**: Rotate provider API keys regularly
3. **Access Control**: Limit API key permissions to minimum required scope
4. **Monitoring**: Monitor API key usage for anomalies

### Environment Variable Management

1. **Secret Management**: Use dedicated secret management services (AWS Secrets Manager, Azure Key Vault, etc.)
2. **Access Control**: Limit access to environment variables to authorized personnel only
3. **Audit Logging**: Log access to sensitive environment variables
4. **Version Control**: Never commit .env files with real secrets to version control

## Validation and Testing

### Environment Validation Script

Create a validation script to check environment variables:

```bash
#!/bin/bash
# validate-env.sh

# Required variables
required_vars=(
    "DATABASE_URL"
    "SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
    "SUPABASE_ANON_KEY"
    "JWT_SECRET"
    "ENCRYPTION_KEY"
    "ENCRYPTION_IV_KEY"
    "NODE_ENV"
    "CLIENT_URL"
    "API_BASE_URL"
)

echo "Validating environment variables..."

missing_vars=()
for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        missing_vars+=("$var")
    fi
done

if [[ ${#missing_vars[@]} -eq 0 ]]; then
    echo "✅ All required environment variables are set"
else
    echo "❌ Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    exit 1
fi

# Validate key lengths
if [[ ${#ENCRYPTION_KEY} -ne 64 ]]; then
    echo "❌ ENCRYPTION_KEY must be 64 characters (32 bytes hex)"
    exit 1
fi

if [[ ${#ENCRYPTION_IV_KEY} -ne 32 ]]; then
    echo "❌ ENCRYPTION_IV_KEY must be 32 characters (16 bytes hex)"
    exit 1
fi

if [[ ${#JWT_SECRET} -lt 32 ]]; then
    echo "❌ JWT_SECRET should be at least 32 characters"
    exit 1
fi

echo "✅ Environment validation passed"
```

### Testing Environment Variables

```javascript
// test-env.js
const requiredVars = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'ENCRYPTION_IV_KEY'
];

const validateEnvironment = () => {
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
        console.error('Missing required environment variables:', missing);
        process.exit(1);
    }
    
    // Validate key formats
    if (process.env.ENCRYPTION_KEY.length !== 64) {
        console.error('ENCRYPTION_KEY must be 64 characters');
        process.exit(1);
    }
    
    if (process.env.ENCRYPTION_IV_KEY.length !== 32) {
        console.error('ENCRYPTION_IV_KEY must be 32 characters');
        process.exit(1);
    }
    
    console.log('✅ Environment validation passed');
};

validateEnvironment();
```

### Environment-Specific Testing

```bash
# Test database connection
npm run test:db-connection

# Test external service connectivity
npm run test:services

# Test encryption/decryption
npm run test:encryption

# Full environment test
npm run test:environment
```

## Deployment Checklist

- [ ] All required environment variables are set
- [ ] Environment variables are validated
- [ ] Encryption keys are unique per environment
- [ ] Database connection is tested
- [ ] External service connections are tested
- [ ] Security keys are stored securely
- [ ] Monitoring and logging are configured
- [ ] Feature flags are set appropriately
- [ ] Backup and recovery procedures are in place

## Support and Resources

- **Environment Setup Guide**: [setup.voxflow.com](https://setup.voxflow.com)
- **Security Best Practices**: [security.voxflow.com](https://security.voxflow.com)
- **Deployment Support**: deployment@voxflow.com
- **Security Issues**: security@voxflow.com

---

This documentation should be kept up-to-date with any changes to environment variable requirements. For the latest version, visit [docs.voxflow.com/deployment/environment-variables](https://docs.voxflow.com/deployment/environment-variables).