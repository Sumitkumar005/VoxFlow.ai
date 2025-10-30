# VoxFlow API Changes and Migration Guide

This document outlines the API changes introduced in the multi-tenant architecture update and provides migration procedures for existing integrations.

## Table of Contents

1. [Overview of Changes](#overview-of-changes)
2. [Breaking Changes](#breaking-changes)
3. [New API Endpoints](#new-api-endpoints)
4. [Authentication Changes](#authentication-changes)
5. [Migration Procedures](#migration-procedures)
6. [Backward Compatibility](#backward-compatibility)
7. [Testing Your Migration](#testing-your-migration)
8. [Support and Resources](#support-and-resources)

## Overview of Changes

The VoxFlow platform has been upgraded to support multi-tenant architecture with enhanced security, usage tracking, and administrative capabilities. This update introduces several new features while maintaining backward compatibility for existing integrations.

### Key Improvements
- **Multi-tenant Support**: Isolated user environments with role-based access
- **Enhanced Security**: Encrypted API key storage and comprehensive audit logging
- **Usage Tracking**: Detailed monitoring of API calls, tokens, and costs
- **Rate Limiting**: Intelligent rate limiting based on subscription tiers
- **Admin Panel**: Comprehensive administrative interface
- **Performance Monitoring**: Real-time system health and performance metrics

### Migration Timeline
- **Phase 1**: New features available (backward compatible)
- **Phase 2**: Deprecated endpoints marked (6 months notice)
- **Phase 3**: Legacy endpoints removed (12 months notice)

## Breaking Changes

### Authentication Token Changes

#### Before (Legacy)
```javascript
// Simple JWT token without role information
{
  "id": "user123",
  "email": "user@example.com",
  "iat": 1640995200,
  "exp": 1641081600
}
```

#### After (New)
```javascript
// Enhanced JWT token with role and subscription info
{
  "id": "user123",
  "email": "user@example.com",
  "role": "user",
  "subscription_tier": "pro",
  "max_agents": 10,
  "monthly_token_quota": 100000,
  "iat": 1640995200,
  "exp": 1641081600
}
```

**Migration Required**: Update token parsing to handle new fields.

### Agent Ownership

#### Before (Legacy)
```javascript
// Agents were global, no ownership concept
GET /api/agents
// Returns all agents in the system
```

#### After (New)
```javascript
// Agents are user-specific
GET /api/agents
// Returns only the authenticated user's agents
```

**Migration Required**: Existing agents will be assigned to the admin user during migration.

### Error Response Format

#### Before (Legacy)
```javascript
{
  "error": "Something went wrong",
  "status": 500
}
```

#### After (New)
```javascript
{
  "success": false,
  "message": "Something went wrong",
  "error": {
    "code": "INTERNAL_ERROR",
    "details": "Detailed error information"
  },
  "request_id": "req_123456789",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Migration Required**: Update error handling to use new format.

## New API Endpoints

### User Management

#### User Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "organization_name": "My Company",
  "subscription_tier": "pro"
}
```

#### User Profile
```http
GET /api/auth/profile
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "id": "user123",
    "email": "user@example.com",
    "role": "user",
    "organization_name": "My Company",
    "subscription_tier": "pro",
    "max_agents": 10,
    "monthly_token_quota": 100000,
    "is_active": true,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### API Key Management

#### Save API Keys
```http
POST /api/api-keys
Authorization: Bearer <token>
Content-Type: application/json

{
  "provider": "groq",
  "api_key": "gsk_...",
  "is_active": true
}
```

#### Get API Key Status
```http
GET /api/api-keys/status
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "groq": {
      "configured": true,
      "is_active": true,
      "last_used": "2024-01-01T00:00:00.000Z"
    },
    "deepgram": {
      "configured": false,
      "is_active": false,
      "last_used": null
    },
    "twilio": {
      "configured": true,
      "is_active": true,
      "last_used": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Usage Tracking

#### Get Usage Statistics
```http
GET /api/usage/current
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "current_period": {
      "start_date": "2024-01-01",
      "end_date": "2024-01-31",
      "total_tokens": 15000,
      "total_calls": 150,
      "api_costs": 12.50
    },
    "limits": {
      "max_agents": 10,
      "monthly_token_quota": 100000
    },
    "usage_by_provider": {
      "groq": {
        "tokens": 12000,
        "cost": 10.00
      },
      "deepgram": {
        "minutes": 45,
        "cost": 2.50
      }
    }
  }
}
```

#### Get Usage History
```http
GET /api/usage/history?start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "date": "2024-01-01",
      "total_tokens": 500,
      "total_calls": 5,
      "api_costs": 0.50,
      "breakdown": {
        "groq_tokens": 400,
        "deepgram_minutes": 2
      }
    }
  ]
}
```

### Admin Endpoints

#### Get All Users (Admin Only)
```http
GET /api/admin/users?page=1&limit=20
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user123",
        "email": "user@example.com",
        "organization_name": "Company",
        "subscription_tier": "pro",
        "is_active": true,
        "agent_count": 5,
        "current_usage": {
          "tokens": 15000,
          "calls": 150
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

#### Update User Limits (Admin Only)
```http
PUT /api/admin/users/:userId/limits
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "max_agents": 15,
  "monthly_token_quota": 150000,
  "notes": "Increased limits for enterprise trial"
}
```

### Performance Monitoring (Admin Only)

#### Get System Health
```http
GET /api/performance/health
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "data": {
    "health_score": 95,
    "health_status": "excellent",
    "issues": [],
    "metrics_summary": {
      "cache_hit_ratio": 96.5,
      "active_connections": 12,
      "lock_waits": 0,
      "database_size": "2.5GB"
    }
  }
}
```

#### Get Performance Metrics
```http
GET /api/performance/metrics
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "data": {
    "connection_stats": {
      "active_connections": 12,
      "idle_connections": 8,
      "longest_query_seconds": 0.5
    },
    "cache_hit_ratio": {
      "cache_hit_ratio": 96.5,
      "index_hit_ratio": 98.2
    },
    "table_stats": [
      {
        "tablename": "users",
        "total_size": "10MB",
        "live_tuples": 1000,
        "dead_tuples": 50
      }
    ]
  }
}
```

## Authentication Changes

### Enhanced JWT Tokens

The JWT tokens now include additional fields for role-based access control and usage tracking:

```javascript
// Decode token to access new fields
const token = jwt.decode(authToken);
console.log(token.role); // 'user', 'admin', or 'enterprise'
console.log(token.subscription_tier); // 'free', 'pro', or 'enterprise'
console.log(token.max_agents); // User's agent limit
console.log(token.monthly_token_quota); // User's token quota
```

### Role-Based Access Control

Certain endpoints now require specific roles:

```javascript
// Admin-only endpoints
const adminEndpoints = [
  '/api/admin/*',
  '/api/performance/*',
  '/api/monitoring/*'
];

// Check user role before making requests
if (userRole === 'admin') {
  // Can access admin endpoints
  const response = await fetch('/api/admin/users', {
    headers: { Authorization: `Bearer ${token}` }
  });
}
```

### Rate Limiting Headers

API responses now include rate limiting headers:

```javascript
const response = await fetch('/api/agents');
console.log(response.headers.get('X-RateLimit-Limit')); // 1000
console.log(response.headers.get('X-RateLimit-Remaining')); // 999
console.log(response.headers.get('X-RateLimit-Reset')); // 1640995200
```

## Migration Procedures

### Step 1: Update Authentication Handling

#### Before
```javascript
// Legacy authentication
const login = async (email, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  localStorage.setItem('token', data.token);
};
```

#### After
```javascript
// Enhanced authentication with role handling
const login = async (email, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('token', data.token);
    
    // Decode token to get user info
    const tokenData = jwt.decode(data.token);
    localStorage.setItem('userRole', tokenData.role);
    localStorage.setItem('subscriptionTier', tokenData.subscription_tier);
  }
};
```

### Step 2: Update Error Handling

#### Before
```javascript
// Legacy error handling
const handleApiCall = async () => {
  try {
    const response = await fetch('/api/agents');
    const data = await response.json();
    
    if (data.error) {
      console.error('Error:', data.error);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};
```

#### After
```javascript
// Enhanced error handling
const handleApiCall = async () => {
  try {
    const response = await fetch('/api/agents');
    const data = await response.json();
    
    if (!data.success) {
      console.error('API Error:', {
        message: data.message,
        code: data.error?.code,
        requestId: data.request_id,
        timestamp: data.timestamp
      });
      
      // Handle specific error types
      if (data.error?.code === 'RATE_LIMIT_EXCEEDED') {
        // Handle rate limiting
        const retryAfter = response.headers.get('Retry-After');
        setTimeout(() => handleApiCall(), retryAfter * 1000);
      }
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};
```

### Step 3: Implement Usage Tracking

```javascript
// Add usage monitoring to your application
const monitorUsage = async () => {
  try {
    const response = await fetch('/api/usage/current', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const data = await response.json();
    if (data.success) {
      const usage = data.data;
      
      // Check if approaching limits
      const tokenUsagePercent = (usage.current_period.total_tokens / usage.limits.monthly_token_quota) * 100;
      
      if (tokenUsagePercent > 80) {
        showUsageWarning('You are approaching your token limit');
      }
      
      // Update UI with usage information
      updateUsageDisplay(usage);
    }
  } catch (error) {
    console.error('Failed to fetch usage:', error);
  }
};

// Call periodically or after significant operations
setInterval(monitorUsage, 300000); // Every 5 minutes
```

### Step 4: Update Agent Management

#### Before
```javascript
// Legacy agent creation (no ownership)
const createAgent = async (agentData) => {
  const response = await fetch('/api/agents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(agentData)
  });
  
  return response.json();
};
```

#### After
```javascript
// Enhanced agent creation with ownership and limits
const createAgent = async (agentData) => {
  try {
    // Check agent limits first
    const profileResponse = await fetch('/api/auth/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const profile = await profileResponse.json();
    if (profile.success) {
      const currentAgents = await getCurrentAgentCount();
      
      if (currentAgents >= profile.data.max_agents) {
        throw new Error('Agent limit reached. Please upgrade your plan.');
      }
    }
    
    const response = await fetch('/api/agents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(agentData)
    });
    
    const result = await response.json();
    
    if (!result.success) {
      if (result.error?.code === 'AGENT_LIMIT_EXCEEDED') {
        showUpgradePrompt();
      }
      throw new Error(result.message);
    }
    
    return result;
  } catch (error) {
    console.error('Failed to create agent:', error);
    throw error;
  }
};
```

### Step 5: Add Rate Limiting Handling

```javascript
// Implement exponential backoff for rate limiting
const makeApiCall = async (url, options, retryCount = 0) => {
  try {
    const response = await fetch(url, options);
    
    // Check rate limiting headers
    const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
    const resetTime = parseInt(response.headers.get('X-RateLimit-Reset'));
    
    if (response.status === 429) {
      // Rate limited
      const retryAfter = parseInt(response.headers.get('Retry-After')) || Math.pow(2, retryCount);
      
      if (retryCount < 3) {
        console.log(`Rate limited. Retrying in ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return makeApiCall(url, options, retryCount + 1);
      } else {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
    }
    
    // Warn if approaching rate limit
    if (remaining < 10) {
      console.warn(`Approaching rate limit. ${remaining} requests remaining.`);
    }
    
    return response;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};
```

## Backward Compatibility

### Legacy Endpoint Support

The following legacy endpoints remain functional but are deprecated:

```javascript
// DEPRECATED: Will be removed in v2.0
GET /api/agents (without user filtering)
POST /api/agents (without ownership validation)
GET /api/campaigns (without user filtering)

// RECOMMENDED: Use new endpoints
GET /api/agents (automatically filtered by user)
POST /api/agents (with ownership and limit validation)
GET /api/campaigns (automatically filtered by user)
```

### Migration Assistance

A migration helper is available to ease the transition:

```javascript
// Migration helper utility
import { VoxFlowMigrationHelper } from '@voxflow/migration-helper';

const migrationHelper = new VoxFlowMigrationHelper({
  apiUrl: 'https://api.voxflow.com',
  token: yourAuthToken
});

// Check compatibility
const compatibility = await migrationHelper.checkCompatibility();
console.log('Compatibility issues:', compatibility.issues);

// Migrate data
const migrationResult = await migrationHelper.migrateUserData();
console.log('Migration result:', migrationResult);
```

### Gradual Migration Strategy

1. **Phase 1**: Update authentication to handle new token format
2. **Phase 2**: Implement new error handling
3. **Phase 3**: Add usage tracking and monitoring
4. **Phase 4**: Update agent and campaign management
5. **Phase 5**: Implement rate limiting handling
6. **Phase 6**: Remove deprecated endpoint usage

## Testing Your Migration

### Test Checklist

- [ ] Authentication works with new token format
- [ ] Error handling processes new error format
- [ ] Agent creation respects ownership and limits
- [ ] Usage tracking displays correctly
- [ ] Rate limiting is handled gracefully
- [ ] Admin features work (if applicable)
- [ ] All existing functionality still works

### Test Environment

Use the test environment to validate your migration:

```javascript
// Test environment configuration
const testConfig = {
  apiUrl: 'https://test-api.voxflow.com',
  testToken: 'test_token_here'
};

// Run migration tests
const runMigrationTests = async () => {
  // Test authentication
  await testAuthentication();
  
  // Test agent operations
  await testAgentOperations();
  
  // Test usage tracking
  await testUsageTracking();
  
  // Test error handling
  await testErrorHandling();
  
  console.log('All migration tests passed!');
};
```

### Sample Test Cases

```javascript
// Test new authentication
const testAuthentication = async () => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'testPassword'
    })
  });
  
  const data = await response.json();
  assert(data.success === true, 'Login should succeed');
  assert(data.token, 'Token should be present');
  
  const tokenData = jwt.decode(data.token);
  assert(tokenData.role, 'Token should include role');
  assert(tokenData.subscription_tier, 'Token should include subscription tier');
};

// Test agent limits
const testAgentLimits = async () => {
  // Create agents up to limit
  const profile = await getUserProfile();
  const maxAgents = profile.max_agents;
  
  for (let i = 0; i < maxAgents; i++) {
    const agent = await createAgent({ name: `Test Agent ${i}` });
    assert(agent.success === true, 'Agent creation should succeed within limits');
  }
  
  // Try to create one more (should fail)
  try {
    await createAgent({ name: 'Limit Exceeded Agent' });
    assert(false, 'Should not be able to exceed agent limit');
  } catch (error) {
    assert(error.message.includes('limit'), 'Should get limit error');
  }
};
```

## Support and Resources

### Migration Support

- **Migration Guide**: [migration.voxflow.com](https://migration.voxflow.com)
- **API Documentation**: [docs.voxflow.com/api](https://docs.voxflow.com/api)
- **Migration Helper Library**: [github.com/voxflow/migration-helper](https://github.com/voxflow/migration-helper)
- **Test Environment**: [test.voxflow.com](https://test.voxflow.com)

### Getting Help

- **Migration Support**: migration@voxflow.com
- **Technical Questions**: tech@voxflow.com
- **Documentation Issues**: docs@voxflow.com
- **Community Forum**: [community.voxflow.com](https://community.voxflow.com)

### Migration Timeline

- **Now**: New features available, legacy endpoints deprecated
- **3 months**: Migration helper tools available
- **6 months**: Legacy endpoint deprecation warnings
- **12 months**: Legacy endpoints removed

### Best Practices

1. **Test Thoroughly**: Use the test environment extensively
2. **Gradual Migration**: Migrate features incrementally
3. **Monitor Usage**: Implement usage tracking early
4. **Handle Errors**: Implement robust error handling
5. **Plan for Limits**: Design with usage limits in mind
6. **Stay Updated**: Monitor deprecation notices

---

For the most up-to-date migration information, visit [migration.voxflow.com](https://migration.voxflow.com) or contact our migration support team at migration@voxflow.com.