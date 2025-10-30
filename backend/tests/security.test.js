const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const app = require('../app');

describe('Security Tests', () => {
  let adminToken;
  let regularToken;

  beforeAll(async () => {
    // Setup test users and get tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@voxflow.com',
        password: 'admin123'
      });

    if (adminLogin.status === 200) {
      adminToken = adminLogin.body.token;
    }
  });

  describe('Input Validation Security', () => {
    describe('SQL Injection Prevention', () => {
      it('should block SQL injection in registration', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: "test@example.com'; DROP TABLE users; --",
            password: 'password123',
            organization_name: 'Test Org'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('INVALID_INPUT');
      });

      it('should block SQL injection in login', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: "admin@voxflow.com' OR '1'='1",
            password: 'password'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('INVALID_INPUT');
      });

      it('should block SQL injection in agent creation', async () => {
        if (!adminToken) return;

        const response = await request(app)
          .post('/api/agents')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: "Test Agent'; DROP TABLE agents; --",
            type: 'INBOUND',
            use_case: 'Testing',
            description: 'Test agent description'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('INVALID_INPUT');
      });

      it('should block SQL injection in query parameters', async () => {
        if (!adminToken) return;

        const response = await request(app)
          .get('/api/agents?search=test\' OR \'1\'=\'1')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('INVALID_INPUT');
      });
    });

    describe('XSS Prevention', () => {
      it('should block XSS in registration', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: 'password123',
            organization_name: '<script>alert("xss")</script>'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('XSS_DETECTED');
      });

      it('should block XSS in agent creation', async () => {
        if (!adminToken) return;

        const response = await request(app)
          .post('/api/agents')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Test Agent',
            type: 'INBOUND',
            use_case: '<script>alert("xss")</script>',
            description: 'Test agent description'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('XSS_DETECTED');
      });

      it('should block iframe injection', async () => {
        if (!adminToken) return;

        const response = await request(app)
          .post('/api/agents')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Test Agent',
            type: 'INBOUND',
            use_case: 'Testing',
            description: '<iframe src="http://malicious.com"></iframe>'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('XSS_DETECTED');
      });

      it('should block javascript: URLs', async () => {
        if (!adminToken) return;

        const response = await request(app)
          .post('/api/agents')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Test Agent',
            type: 'INBOUND',
            use_case: 'javascript:alert("xss")',
            description: 'Test agent description'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('XSS_DETECTED');
      });
    });

    describe('Input Sanitization', () => {
      it('should sanitize HTML tags from input', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: 'password123',
            organization_name: '<b>Test</b> Organization'
          });

        // Should pass validation after sanitization
        expect([201, 400]).toContain(response.status);
        if (response.status === 400) {
          // Should be validation error, not XSS detection
          expect(response.body.error).not.toBe('XSS_DETECTED');
        }
      });

      it('should handle special characters safely', async () => {
        if (!adminToken) return;

        const response = await request(app)
          .post('/api/agents')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Test Agent & Co.',
            type: 'INBOUND',
            use_case: 'Customer Support & Sales',
            description: 'This agent handles customer support & sales inquiries with 100% efficiency.'
          });

        expect([201, 400]).toContain(response.status);
        if (response.status === 400) {
          expect(response.body.error).not.toBe('XSS_DETECTED');
          expect(response.body.error).not.toBe('INVALID_INPUT');
        }
      });
    });
  });

  describe('Request Size Limits', () => {
    it('should reject requests that are too large', async () => {
      const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          organization_name: largePayload
        });

      expect(response.status).toBe(413);
      expect(response.body.error).toBe('REQUEST_TOO_LARGE');
    });

    it('should accept normal-sized requests', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          organization_name: 'Normal Organization Name'
        });

      expect([201, 400]).toContain(response.status);
      if (response.status === 400) {
        expect(response.body.error).not.toBe('REQUEST_TOO_LARGE');
      }
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should include CSP headers', async () => {
      const response = await request(app)
        .get('/');

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });
  });

  describe('Authentication Security', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/agents');

      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid tokens', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should reject requests with malformed authorization headers', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', 'InvalidFormat token');

      expect(response.status).toBe(401);
    });
  });

  describe('Input Validation', () => {
    describe('Email Validation', () => {
      it('should reject invalid email formats', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'invalid-email',
            password: 'password123',
            organization_name: 'Test Org'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed');
      });

      it('should accept valid email formats', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'valid@example.com',
            password: 'Password123!',
            organization_name: 'Test Org'
          });

        expect([201, 400]).toContain(response.status);
        if (response.status === 400) {
          expect(response.body.message).not.toContain('email');
        }
      });
    });

    describe('Password Validation', () => {
      it('should reject weak passwords', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: 'weak',
            organization_name: 'Test Org'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed');
      });

      it('should require password complexity', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: 'password123', // Missing uppercase and special char
            organization_name: 'Test Org'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed');
      });

      it('should accept strong passwords', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: 'StrongPassword123!',
            organization_name: 'Test Org'
          });

        expect([201, 400]).toContain(response.status);
        if (response.status === 400) {
          expect(response.body.errors?.some(e => e.field === 'password')).toBeFalsy();
        }
      });
    });

    describe('UUID Validation', () => {
      it('should reject invalid UUIDs', async () => {
        if (!adminToken) return;

        const response = await request(app)
          .get('/api/agents/invalid-uuid')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed');
      });

      it('should accept valid UUIDs', async () => {
        if (!adminToken) return;

        const validUUID = '123e4567-e89b-12d3-a456-426614174000';
        const response = await request(app)
          .get(`/api/agents/${validUUID}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect([200, 404]).toContain(response.status);
        if (response.status === 400) {
          expect(response.body.message).not.toBe('Validation failed');
        }
      });
    });
  });

  describe('File Upload Security', () => {
    it('should reject non-CSV files', async () => {
      if (!adminToken) return;

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Test Campaign')
        .field('agent_id', '123e4567-e89b-12d3-a456-426614174000')
        .attach('csv_file', Buffer.from('not a csv'), 'test.txt');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('CSV');
    });

    it('should reject files that are too large', async () => {
      if (!adminToken) return;

      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Test Campaign')
        .field('agent_id', '123e4567-e89b-12d3-a456-426614174000')
        .attach('csv_file', largeBuffer, 'large.csv');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('size');
    });
  });

  describe('API Key Security', () => {
    it('should validate API key format', async () => {
      if (!adminToken) return;

      const response = await request(app)
        .post('/api/api-keys/groq')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          api_key: 'invalid key with spaces and special chars!'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should reject API keys that are too short', async () => {
      if (!adminToken) return;

      const response = await request(app)
        .post('/api/api-keys/groq')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          api_key: 'short'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should accept valid API key formats', async () => {
      if (!adminToken) return;

      const response = await request(app)
        .post('/api/api-keys/groq')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          api_key: 'gsk_valid-api-key-format_123456789'
        });

      expect([200, 400]).toContain(response.status);
      if (response.status === 400) {
        expect(response.body.message).not.toBe('Validation failed');
      }
    });
  });

  describe('Rate Limiting Security', () => {
    it('should apply rate limits to authentication endpoints', async () => {
      const promises = [];
      
      // Make multiple rapid requests
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'wrongpassword'
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // At least some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Information Disclosure', () => {
    it('should not expose sensitive information in error messages', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).not.toContain('database');
      expect(response.body.message).not.toContain('SQL');
      expect(response.body.message).not.toContain('error');
    });

    it('should provide generic error messages for security violations', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: "test'; DROP TABLE users; --",
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid input detected. Please check your request and try again.');
    });
  });

  describe('CORS Security', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/agents')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect([200, 204]).toContain(response.status);
    });
  });
});