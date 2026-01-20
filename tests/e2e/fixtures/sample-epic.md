# Sample Epic Issue for E2E Testing

**Title**: [E2E Test] Build User Authentication System

**Labels**: `type:epic`, `priority:p1`, `e2e-test`

## Description

Build a complete user authentication system with OAuth support, role-based access control, and session management.

## Business Goals

- Enable secure user authentication
- Support OAuth providers (Google, GitHub, Microsoft)
- Implement role-based access control (RBAC)
- Provide session management and token refresh

## Target Users

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| End User | Application user | Easy login, SSO support |
| Admin | System administrator | User management, role assignment |
| Developer | API consumer | Token-based auth, API keys |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Login success rate | >99% | Analytics |
| Auth latency | <200ms | APM |
| User adoption | >80% | Usage stats |

## Scope

### In Scope
- OAuth 2.0 authentication
- JWT token management
- Role-based access control
- Session management
- Password reset flow
- Email verification

### Out of Scope
- Biometric authentication
- Multi-factor authentication (Phase 2)
- Social profile sync

## Constraints

- Must comply with GDPR
- Must support mobile and web
- Must integrate with existing user database

## Expected Artifacts

This epic should be broken down into:
- Features (e.g., OAuth Integration, RBAC System)
- User Stories (e.g., "As a user, I can log in with Google")
- Technical tasks

**Test Marker**: This is an automated E2E test epic. Expected PM to create Features and Stories.
