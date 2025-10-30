# Design Document

## Overview

This design transforms VoxFlow from a single-admin system into a production-ready multi-tenant platform supporting up to 100 users. The architecture maintains all existing functionality while adding user isolation, secure API key management, usage tracking, and administrative controls. The implementation is designed in phases to enable incremental testing and deployment.

## Architecture

### Current State Analysis
- Single admin user system with hardcoded credentials
- Shared API keys stored in environment variables
- Basic user table with minimal fields
- All users share the same service configurations
- No usage tracking or billing capabilities

### Target Multi-Tenant Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  User Dashboard  │  Admin Panel  │  API Key Settings      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Backend API (Express)                    │
├─────────────────────────────────────────────────────────────┤
│  Auth Middleware │  RBAC  │  Rate Limiting  │  Encryption  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Database (Supabase)                       │
├─────────────────────────────────────────────────────────────┤
│  Users  │  User API Keys  │  Usage Tracking  │  Audit Logs │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Phase 1: Enhanced User Management

#### 1.1 Database Schema Extensions
```sql
-- Enhanced users table
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';
ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(20) DEFAULT 'free';
ALTER TABLE users ADD COLUMN organization_name VARCHAR(255);
ALTER TABLE users ADD COLUMN max_agents INTEGER DEFAULT 2;
ALTER TABLE users ADD COLUMN monthly_token_quota INTEGER DEFAULT 1000;
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN last_login TIMESTAMP;

-- New user_api_keys table
CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  iv VARCHAR(32) NOT NULL,
  auth_tag VARCHAR(32) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  UNIQUE(user_id, provider)
);

-- New user_usage_tracking table
CREATE TABLE user_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_tokens DECIMAL(10,2) DEFAULT 0,
  total_calls INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  api_costs DECIMAL(10,2) DEFAULT 0,
  UNIQUE(user_id, date)
);
```

#### 1.2 Authentication Service Enhancement
```javascript
// Enhanced JWT payload
const tokenPayload = {
  id: user.id,
  email: user.email,
  role: user.role,
  subscription_tier: user.subscription_tier,
  max_agents: user.max_agents
};

// Role-based middleware
export const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  next();
};
```

### Phase 2: API Key Management System

#### 2.1 Encryption Service
```javascript
// AES-256-GCM encryption for API keys
export class EncryptionService {
  static encrypt(plaintext) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  static decrypt(encryptedData) {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      ENCRYPTION_KEY,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

#### 2.2 User API Key Service
```javascript
export class UserAPIKeyService {
  static async saveUserAPIKey(userId, provider, apiKey) {
    const encrypted = EncryptionService.encrypt(apiKey);
    
    return await supabase
      .from('user_api_keys')
      .upsert({
        user_id: userId,
        provider,
        api_key_encrypted: encrypted.encrypted,
        iv: encrypted.iv,
        auth_tag: encrypted.authTag
      });
  }
  
  static async getUserAPIKey(userId, provider) {
    const { data } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('is_active', true)
      .single();
    
    if (!data) {
      throw new Error(`No ${provider} API key configured`);
    }
    
    return EncryptionService.decrypt({
      encrypted: data.api_key_encrypted,
      iv: data.iv,
      authTag: data.auth_tag
    });
  }
}
```

### Phase 3: Usage Tracking and Limits

#### 3.1 Usage Tracking Service
```javascript
export class UsageTrackingService {
  static async trackUsage(userId, usage) {
    const today = new Date().toISOString().split('T')[0];
    
    const costs = {
      groq: usage.tokens * 0.0000001, // $0.10 per 1M tokens
      deepgram: usage.duration * 0.0025, // $0.0025 per second
      twilio: usage.duration * 0.0140 // $0.0140 per minute
    };
    
    return await supabase
      .from('user_usage_tracking')
      .upsert({
        user_id: userId,
        date: today,
        total_tokens: usage.tokens || 0,
        total_calls: 1,
        total_duration_seconds: usage.duration || 0,
        api_costs: costs[usage.provider] || 0
      }, {
        onConflict: 'user_id,date',
        ignoreDuplicates: false
      });
  }
  
  static async checkUserLimits(userId) {
    const user = await this.getUser(userId);
    const currentUsage = await this.getCurrentMonthUsage(userId);
    
    return {
      tokensRemaining: user.monthly_token_quota - currentUsage.total_tokens,
      agentsRemaining: user.max_agents - currentUsage.agent_count,
      canCreateAgent: currentUsage.agent_count < user.max_agents,
      canMakeCall: currentUsage.total_tokens < user.monthly_token_quota
    };
  }
}
```

#### 3.2 Agent Limit Enforcement
```sql
-- Database trigger for agent limits
CREATE OR REPLACE FUNCTION check_agent_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_agent_count INT;
  user_max_agents INT;
BEGIN
  SELECT COUNT(*) INTO user_agent_count
  FROM agents
  WHERE user_id = NEW.user_id;
  
  SELECT max_agents INTO user_max_agents
  FROM users
  WHERE id = NEW.user_id;
  
  IF user_agent_count >= user_max_agents THEN
    RAISE EXCEPTION 'Agent limit reached. Current: %, Max: %', user_agent_count, user_max_agents;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_agent_limit
BEFORE INSERT ON agents
FOR EACH ROW
EXECUTE FUNCTION check_agent_limit();
```

### Phase 4: Admin Panel and Analytics

#### 4.1 Admin Dashboard Components
```javascript
// Admin Dashboard with key metrics
const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalAgents: 0,
    totalCalls: 0,
    monthlyRevenue: 0,
    systemHealth: 'good'
  });
  
  return (
    <div className="admin-dashboard">
      <MetricsGrid stats={stats} />
      <UserActivityChart />
      <SystemHealthMonitor />
      <RecentUserActions />
    </div>
  );
};
```

#### 4.2 User Management Interface
```javascript
const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const updateUserLimits = async (userId, limits) => {
    await adminAPI.updateUserLimits(userId, limits);
    // Log admin action
    await adminAPI.logAction('update_user_limits', userId, limits);
  };
  
  return (
    <div className="user-management">
      <UserList users={users} onSelectUser={setSelectedUser} />
      {selectedUser && (
        <UserDetails 
          user={selectedUser} 
          onUpdateLimits={updateUserLimits}
        />
      )}
    </div>
  );
};
```

### Phase 5: Service Integration Updates

#### 5.1 Modified Groq Service
```javascript
export class GroqService {
  static async generateResponse(userId, systemPrompt, messages, model) {
    // Get user's API key
    const userGroqKey = await UserAPIKeyService.getUserAPIKey(userId, 'groq');
    
    // Check user limits
    const limits = await UsageTrackingService.checkUserLimits(userId);
    if (!limits.canMakeCall) {
      throw new Error('Monthly token quota exceeded');
    }
    
    // Create Groq client with user's key
    const groq = new Groq({ apiKey: userGroqKey });
    
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      model,
      temperature: 0.7
    });
    
    // Track usage
    await UsageTrackingService.trackUsage(userId, {
      tokens: completion.usage.total_tokens,
      provider: 'groq'
    });
    
    return completion.choices[0]?.message?.content;
  }
}
```

#### 5.2 Modified Deepgram Service
```javascript
export class DeepgramService {
  static async transcribeAudio(userId, audioBuffer) {
    const userDeepgramKey = await UserAPIKeyService.getUserAPIKey(userId, 'deepgram');
    
    const deepgram = createClient(userDeepgramKey);
    
    const { result } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      { model: 'nova-2', smart_format: true }
    );
    
    // Track usage
    await UsageTrackingService.trackUsage(userId, {
      duration: result.metadata.duration,
      provider: 'deepgram'
    });
    
    return result.results.channels[0].alternatives[0].transcript;
  }
}
```

## Data Models

### Enhanced User Model
```javascript
const UserSchema = {
  id: 'UUID',
  email: 'string',
  password_hash: 'string',
  role: 'enum[admin, user, enterprise]',
  subscription_tier: 'enum[free, pro, enterprise]',
  organization_name: 'string?',
  max_agents: 'integer',
  monthly_token_quota: 'integer',
  is_active: 'boolean',
  last_login: 'timestamp?',
  created_at: 'timestamp'
};
```

### User API Keys Model
```javascript
const UserAPIKeySchema = {
  id: 'UUID',
  user_id: 'UUID',
  provider: 'enum[groq, deepgram, twilio]',
  api_key_encrypted: 'string',
  iv: 'string',
  auth_tag: 'string',
  is_active: 'boolean',
  created_at: 'timestamp',
  last_used_at: 'timestamp?'
};
```

### Usage Tracking Model
```javascript
const UsageTrackingSchema = {
  id: 'UUID',
  user_id: 'UUID',
  date: 'date',
  total_tokens: 'decimal',
  total_calls: 'integer',
  total_duration_seconds: 'integer',
  api_costs: 'decimal'
};
```

## Error Handling

### API Key Management Errors
- Missing API key: Return helpful setup instructions
- Invalid API key: Prompt user to update credentials
- Encryption/decryption errors: Log securely and return generic error

### Usage Limit Errors
- Agent limit exceeded: Suggest upgrade with clear pricing
- Token quota exceeded: Show usage dashboard and upgrade options
- Rate limiting: Implement exponential backoff

### Admin Panel Errors
- Unauthorized access: Redirect to login with appropriate message
- Bulk operations: Implement transaction rollback on failures
- Data export: Handle large datasets with pagination

## Testing Strategy

### Phase 1 Testing: User Management
- Unit tests for user registration and authentication
- Integration tests for role-based access control
- Database migration testing with existing data

### Phase 2 Testing: API Key Management
- Encryption/decryption unit tests
- API key storage and retrieval integration tests
- Service integration tests with user-specific keys

### Phase 3 Testing: Usage Tracking
- Usage calculation accuracy tests
- Limit enforcement integration tests
- Performance tests for high-volume usage tracking

### Phase 4 Testing: Admin Panel
- Admin dashboard functionality tests
- User management operation tests
- Analytics accuracy and performance tests

### Phase 5 Testing: End-to-End
- Complete user journey tests
- Multi-user concurrent usage tests
- Data isolation and security tests
- Performance tests with 100 concurrent users

## Security Considerations

### Data Encryption
- API keys encrypted with AES-256-GCM
- Unique IV for each encryption operation
- Master encryption key stored securely (environment variable)

### Access Control
- JWT tokens with role-based claims
- Row-level security for data isolation
- Admin action audit logging

### Rate Limiting
- Per-user rate limiting to prevent abuse
- Progressive rate limiting based on subscription tier
- API endpoint protection against DDoS

### Data Privacy
- User data isolation at database level
- Secure deletion of user data on account closure
- Audit trails for all admin actions

## Migration Strategy

### Phase 1: Database Migration
1. Add new columns to existing users table
2. Create new tables (user_api_keys, user_usage_tracking)
3. Migrate existing admin user to new schema
4. Test data integrity and rollback capability

### Phase 2: Gradual Feature Rollout
1. Deploy user registration (disabled initially)
2. Test API key management with admin user
3. Enable user registration for beta users
4. Monitor system performance and usage

### Phase 3: Full Production Deployment
1. Enable all features for all users
2. Monitor system metrics and user feedback
3. Optimize performance based on real usage patterns
4. Implement additional features based on user needs

## Performance Optimization

### Database Optimization
- Proper indexing on frequently queried columns
- Connection pooling for concurrent users
- Query optimization for analytics dashboard

### Caching Strategy
- Redis caching for frequently accessed user data
- API key caching with secure TTL
- Usage statistics caching for dashboard performance

### API Performance
- Response compression for large payloads
- Pagination for list endpoints
- Async processing for heavy operations

This design provides a comprehensive roadmap for transforming VoxFlow into a production-ready multi-tenant platform while maintaining all existing functionality and ensuring smooth migration paths.