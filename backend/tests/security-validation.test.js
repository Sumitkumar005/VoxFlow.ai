const { describe, it, expect } = require('@jest/globals');
const request = require('supertest');
const express = require('express');
const {
  sanitizeInput,
  preventSQLInjection,
  xssProtection,
  validateUserRegistration,
  validateUserLogin,
  validateAgentCreation,
  validateAPIKey,
  handleValidationErrors
} = require('../src/middleware/security.middleware.js');

// Create test app
const createTestApp = (middleware) => {
  const app = express();
  app.use(express.json());
  
  if (Array.isArray(middleware)) {
    middleware.forEach(m => app.use(m));
  } else {
    app.use(middleware);
  }
  
  app.post('/test', (req, res) => {
    res.json({ success: true, body: req.body });
  });
  
  return app;
};

describe('Security Validation Middleware Tests', () => {
  describe('Input Sanitization', () => {
    const app = createTestApp(sanitizeInput);

    it('should remove script tags', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: '<script>alert("xss")</script>Test Name'
        });

      expect(response.status).toBe(200);
      expect(response.body.body.name).toBe('Test Name');
      expect(response.body.body.name).not.toContain('<script>');
    });

    it('should remove javascript: URLs', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          url: 'javascript:alert("xss")'
        });

      expect(response.status).toBe(200);
      expect(response.body.body.url).toBe('alert("xss")');
      expect(response.body.body.url).not.toContain('javascript:');
    });

    it('should remove event handlers', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          content: '<div onclick="alert()">Content</div>'
        });

      expect(response.status).toBe(200);
      expect(response.body.body.content).not.toContain('onclick=');
    });

    it('should handle nested objects', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          user: {
            name: '<script>alert("nested")</script>John',
            profile: {
              bio: 'javascript:alert("deep")'
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.body.user.name).toBe('John');
      expect(response.body.body.user.profile.bio).toBe('alert("deep")');
    });
  });

  describe('SQL Injection Prevention', () => {
    const app = createTestApp(preventSQLInjection);

    it('should block SELECT statements', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          query: "'; SELECT * FROM users; --"
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INVALID_INPUT');
    });

    it('should block UNION attacks', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          email: "test@example.com' UNION SELECT password FROM users --"
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INVALID_INPUT');
    });

    it('should block DROP statements', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: "'; DROP TABLE agents; --"
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INVALID_INPUT');
    });

    it('should allow safe input', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          description: 'This is a safe description with normal text.'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('XSS Protection', () => {
    const app = createTestApp(xssProtection);

    it('should block script tags', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          content: '<script>alert("xss")</script>'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('XSS_DETECTED');
    });

    it('should block iframe tags', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          content: '<iframe src="http://malicious.com"></iframe>'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('XSS_DETECTED');
    });

    it('should block javascript: URLs', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          link: 'javascript:alert("xss")'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('XSS_DETECTED');
    });

    it('should block event handlers', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          html: '<div onload="alert()">Content</div>'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('XSS_DETECTED');
    });

    it('should allow safe content', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          content: 'This is safe content with no malicious code.'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('User Registration Validation', () => {
    const app = express();
    app.use(express.json());
    app.post('/test', validateUserRegistration, (req, res) => {
      res.json({ success: true });
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          email: 'invalid-email',
          password: 'StrongPassword123!',
          organization_name: 'Test Org'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors.some(e => e.field === 'email')).toBe(true);
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          email: 'test@example.com',
          password: 'weak',
          organization_name: 'Test Org'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.some(e => e.field === 'password')).toBe(true);
    });

    it('should validate organization name format', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          email: 'test@example.com',
          password: 'StrongPassword123!',
          organization_name: 'Invalid<>Name'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.some(e => e.field === 'organization_name')).toBe(true);
    });

    it('should accept valid registration data', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          email: 'test@example.com',
          password: 'StrongPassword123!',
          organization_name: 'Valid Organization Name'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('User Login Validation', () => {
    const app = express();
    app.use(express.json());
    app.post('/test', validateUserLogin, (req, res) => {
      res.json({ success: true });
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.some(e => e.field === 'email')).toBe(true);
    });

    it('should require password', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.some(e => e.field === 'password')).toBe(true);
    });

    it('should accept valid login data', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Agent Creation Validation', () => {
    const app = express();
    app.use(express.json());
    app.post('/test', validateAgentCreation, (req, res) => {
      res.json({ success: true });
    });

    it('should validate agent name format', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: 'Invalid<>Name',
          type: 'INBOUND',
          use_case: 'Testing',
          description: 'Valid description for testing purposes'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.some(e => e.field === 'name')).toBe(true);
    });

    it('should validate agent type', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: 'Valid Name',
          type: 'INVALID_TYPE',
          use_case: 'Testing',
          description: 'Valid description for testing purposes'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.some(e => e.field === 'type')).toBe(true);
    });

    it('should validate description length', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: 'Valid Name',
          type: 'INBOUND',
          use_case: 'Testing',
          description: 'Short'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.some(e => e.field === 'description')).toBe(true);
    });

    it('should accept valid agent data', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: 'Valid Agent Name',
          type: 'INBOUND',
          use_case: 'Customer Support',
          description: 'This is a valid description that meets the minimum length requirement for agent creation.'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('API Key Validation', () => {
    const app = express();
    app.use(express.json());
    app.post('/test/:provider', validateAPIKey, (req, res) => {
      res.json({ success: true });
    });

    it('should validate provider parameter', async () => {
      const response = await request(app)
        .post('/test/invalid_provider')
        .send({
          api_key: 'valid-api-key-format'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.some(e => e.field === 'provider')).toBe(true);
    });

    it('should validate API key format', async () => {
      const response = await request(app)
        .post('/test/groq')
        .send({
          api_key: 'invalid key with spaces!'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.some(e => e.field === 'api_key')).toBe(true);
    });

    it('should validate API key length', async () => {
      const response = await request(app)
        .post('/test/groq')
        .send({
          api_key: 'short'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.some(e => e.field === 'api_key')).toBe(true);
    });

    it('should accept valid API key data', async () => {
      const response = await request(app)
        .post('/test/groq')
        .send({
          api_key: 'gsk_valid-api-key-format_123456789'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should format validation errors consistently', async () => {
      const app = express();
      app.use(express.json());
      app.post('/test', validateUserRegistration, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test')
        .send({
          email: 'invalid',
          password: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(response.body.errors[0]).toHaveProperty('field');
      expect(response.body.errors[0]).toHaveProperty('message');
      expect(response.body.errors[0]).toHaveProperty('value');
    });

    it('should handle multiple validation errors', async () => {
      const app = express();
      app.use(express.json());
      app.post('/test', validateUserRegistration, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test')
        .send({
          email: 'invalid-email',
          password: 'weak',
          organization_name: 'Invalid<>Name'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', async () => {
      const app = createTestApp(sanitizeInput);

      const response = await request(app)
        .post('/test')
        .send({
          name: null,
          description: 'Valid description'
        });

      expect(response.status).toBe(200);
      expect(response.body.body.name).toBe(null);
    });

    it('should handle empty strings', async () => {
      const app = createTestApp(sanitizeInput);

      const response = await request(app)
        .post('/test')
        .send({
          name: '',
          description: 'Valid description'
        });

      expect(response.status).toBe(200);
      expect(response.body.body.name).toBe('');
    });

    it('should handle arrays', async () => {
      const app = createTestApp(sanitizeInput);

      const response = await request(app)
        .post('/test')
        .send({
          tags: ['<script>alert()</script>tag1', 'tag2'],
          description: 'Valid description'
        });

      expect(response.status).toBe(200);
      expect(response.body.body.tags[0]).toBe('tag1');
      expect(response.body.body.tags[1]).toBe('tag2');
    });

    it('should handle deeply nested objects', async () => {
      const app = createTestApp(sanitizeInput);

      const response = await request(app)
        .post('/test')
        .send({
          level1: {
            level2: {
              level3: {
                malicious: '<script>alert()</script>clean'
              }
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.body.level1.level2.level3.malicious).toBe('clean');
    });
  });
});