# Sample User Story for E2E Testing

**Title**: [E2E Test] User can log in with Google OAuth

**Labels**: `type:story`, `priority:p1`, `e2e-test`

## User Story

**As a** user  
**I want to** log in using my Google account  
**So that** I don't need to create a new password and can use my existing Google identity

## Acceptance Criteria

- [ ] "Sign in with Google" button is visible on login page
- [ ] Clicking button redirects to Google OAuth consent screen
- [ ] User can approve access on Google
- [ ] After approval, user is redirected back to application
- [ ] User is logged in and sees their profile
- [ ] User's email and name are populated from Google profile

## Technical Details

### API Endpoints
- `GET /auth/google` - Initiate OAuth flow
- `GET /auth/google/callback` - Handle OAuth callback

### Database Changes
- Add `oauth_provider` field to users table
- Add `oauth_id` field to users table

### Security
- Validate state parameter
- Verify token with Google
- Store tokens encrypted

## Testing Requirements

### Unit Tests
- OAuth flow initiation
- Callback handling
- Token validation
- User profile creation/update

### Integration Tests
- Full OAuth flow with mock Google server
- Error handling (denied access, invalid token)

### E2E Tests
- Complete login flow in browser
- Verify user session created
- Verify user data persisted

## Definition of Done

- [ ] Code implemented and reviewed
- [ ] Unit tests passing (80%+ coverage)
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Documentation updated
- [ ] Security review completed

**Test Marker**: This is an automated E2E test story. Expected Engineer to implement with tests.
