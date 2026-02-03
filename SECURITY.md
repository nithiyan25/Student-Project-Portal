# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please send an email to security@example.com. All security vulnerabilities will be promptly addressed.

**Please do not report security vulnerabilities through public GitHub issues.**

## Security Measures Implemented

### Authentication & Authorization

- **JWT Tokens**: Secure token-based authentication with 12-hour expiry
- **Role-Based Access Control (RBAC)**: Three user roles (Admin, Faculty, Student)
- **Temporary Admin Access**: Granular permission delegation
- **Idle Timeout**: Automatic logout after 3 minutes of inactivity
- **Token Validation**: Server-side token verification on every request

### API Security

- **Helmet**: Sets various HTTP headers for security
- **CORS**: Restricted to configured frontend URL only
- **Rate Limiting**: 100 requests per 15 minutes per IP address
- **Input Validation**: Express-validator on all endpoints
- **SQL Injection Protection**: Prisma ORM with parameterized queries
- **Error Handling**: Sanitized error messages (no stack traces in production)

### Data Protection

- **Password Hashing**: (Note: Currently using Google OAuth only)
- **Environment Variables**: Sensitive data stored in `.env` files
- **Database Security**: MySQL with proper user permissions
- **XSS Protection**: React's built-in XSS protection
- **CSRF Protection**: Recommended for production deployment

## Known Security Considerations

### Development Mode

> **⚠️ WARNING**: The following configurations are for development only and should be changed for production:

1. **Google OAuth Only**: Currently no password-based authentication
2. **JWT Secret**: Use a strong, randomly generated secret in production
3. **CORS Origin**: Hardcoded to localhost - configure for production
4. **HTTPS**: Not configured - required for production
5. **Database Credentials**: Change default credentials

### Recommended Production Enhancements

1. **Enable HTTPS**: Use SSL/TLS certificates
2. **Database Encryption**: Encrypt sensitive fields at rest
3. **Audit Logging**: Implement comprehensive audit trails
4. **Session Management**: Consider Redis for session storage
5. **Two-Factor Authentication**: Add 2FA for admin accounts
6. **API Gateway**: Use API gateway for additional security layer
7. **Regular Security Audits**: Schedule periodic security reviews
8. **Dependency Scanning**: Use tools like Snyk or npm audit
9. **Content Security Policy**: Implement CSP headers
10. **Backup Strategy**: Regular encrypted backups

## Security Best Practices for Deployment

### Environment Variables

Never commit `.env` files to version control. Use environment-specific configurations:

```bash
# Development
.env.development

# Production
.env.production
```

### JWT Secret Generation

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Database Security

1. Create a dedicated database user with minimal privileges
2. Use strong passwords (minimum 16 characters)
3. Enable MySQL SSL connections
4. Regularly backup database
5. Keep MySQL updated

### CORS Configuration

Update CORS settings for production:

```javascript
const corsOptions = {
    origin: process.env.FRONTEND_URL, // Your production frontend URL
    credentials: true,
    optionsSuccessStatus: 200
};
```

### Rate Limiting

Adjust rate limits based on your needs:

```javascript
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP'
});
```

## Vulnerability Disclosure Timeline

1. **Day 0**: Vulnerability reported
2. **Day 1**: Acknowledgment sent to reporter
3. **Day 7**: Initial assessment completed
4. **Day 30**: Patch developed and tested
5. **Day 45**: Patch released
6. **Day 60**: Public disclosure (if applicable)

## Security Update Process

1. Security patches are released as soon as possible
2. Critical vulnerabilities are addressed within 48 hours
3. Users are notified via email and GitHub releases
4. Detailed security advisories are published

## Compliance

This application follows security best practices from:

- OWASP Top 10
- NIST Cybersecurity Framework
- CWE/SANS Top 25

## Security Checklist for Production

Before deploying to production, ensure:

- [ ] All environment variables are properly configured
- [ ] Strong JWT secret is generated and set
- [ ] HTTPS is enabled
- [ ] CORS is restricted to production domain
- [ ] Rate limiting is configured appropriately
- [ ] Database credentials are strong and unique
- [ ] Error messages don't expose sensitive information
- [ ] Logging is configured (without logging sensitive data)
- [ ] All dependencies are up to date
- [ ] Security headers are properly configured
- [ ] Backup and recovery procedures are in place
- [ ] Monitoring and alerting are set up

## Contact

For security-related questions or concerns:

- **Email**: security@example.com
- **Security Advisory**: Check GitHub Security Advisories
- **General Issues**: Open a GitHub issue (non-security related only)

## Acknowledgments

We appreciate the security research community and thank all researchers who responsibly disclose vulnerabilities.

---

**Last Updated**: January 2026
