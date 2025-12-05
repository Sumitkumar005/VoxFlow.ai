# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please do the following:

1. **DO NOT** open a public issue
2. Email the maintainers directly at: [your-email@example.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to resolve the issue.

## Security Best Practices

### For Users

1. **Never commit `.env` files** with real credentials
2. **Use strong JWT secrets** - generate with crypto.randomBytes()
3. **Rotate API keys regularly**
4. **Use HTTPS in production**
5. **Keep dependencies updated** - run `npm audit` regularly
6. **Limit API key permissions** - use minimum required scopes
7. **Monitor usage** - watch for unusual activity

### For Developers

1. **Validate all inputs** - never trust user input
2. **Use parameterized queries** - prevent SQL injection
3. **Sanitize outputs** - prevent XSS attacks
4. **Implement rate limiting** - prevent abuse
5. **Encrypt sensitive data** - use proper encryption
6. **Use HTTPS only** - no plain HTTP in production
7. **Keep secrets secret** - never log sensitive data

## Known Security Considerations

### API Keys Storage
- User API keys are encrypted using AES-256-GCM
- Encryption key must be kept secure
- Never expose MASTER_ENCRYPTION_KEY

### Authentication
- JWT tokens expire after 7 days by default
- Tokens are signed with HS256
- Change JWT_SECRET in production

### Rate Limiting
- API endpoints have rate limits
- Adjust based on your needs
- Monitor for abuse

### File Uploads
- CSV files limited to 10MB
- Only .csv files accepted
- Files are validated before processing

## Disclosure Policy

- We will acknowledge receipt within 48 hours
- We will provide a fix timeline within 7 days
- We will credit reporters (unless they prefer anonymity)
- We will publish security advisories for critical issues

Thank you for helping keep VoxFlow.ai secure! 🔒
