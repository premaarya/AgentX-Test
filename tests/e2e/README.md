# E2E Test Fixtures and Scenarios

This directory contains test data and scenarios for E2E testing of the multi-agent orchestration system.

## Directory Structure

```
tests/e2e/
├── README.md                    # This file
├── fixtures/                    # Test data
│   ├── sample-epic.md          # Sample epic issue
│   ├── sample-feature.md       # Sample feature issue
│   ├── sample-story.md         # Sample user story
│   └── sample-bug.md           # Sample bug issue
├── scenarios/                   # Test scenarios
│   ├── happy-path.md           # Full success flow
│   ├── error-handling.md       # Error scenarios
│   └── edge-cases.md           # Edge case scenarios
└── scripts/                     # Test utilities
    ├── validate-outputs.sh     # Validate workflow outputs
    └── cleanup-test-data.sh    # Clean up test artifacts
```

## Test Scenarios

### 1. Happy Path (Full Orchestration)
- **Scenario**: Epic → PM → Features → Architect → Engineer → Reviewer
- **Expected**: All stages complete, all artifacts created
- **Validates**: End-to-end flow, event-driven triggers, metrics

### 2. Feature to Architect Flow
- **Scenario**: Feature issue triggers Architect directly
- **Expected**: ADR + Tech Spec created, Engineer triggered
- **Validates**: Feature workflow, immediate triggers

### 3. Story to Engineer Flow
- **Scenario**: Story issue triggers Engineer directly
- **Expected**: Code + tests + PR created, Reviewer triggered
- **Validates**: Story workflow, PR creation

### 4. Bug Fix Flow
- **Scenario**: Bug issue triggers Engineer for fix
- **Expected**: Fix + tests + PR created, Reviewer triggered
- **Validates**: Bug workflow, quick turnaround

### 5. UX Designer Flow
- **Scenario**: Issue with needs:ux label triggers UX Designer first
- **Expected**: Wireframes created, then Architect/Engineer
- **Validates**: Conditional routing, UX integration

## Running Tests

### Run All Tests
```bash
gh workflow run test-e2e.yml
```

### Run Specific Test Suite
```bash
gh workflow run test-e2e.yml -f test_suite=smoke
gh workflow run test-e2e.yml -f test_suite=orchestration
gh workflow run test-e2e.yml -f test_suite=triggers
gh workflow run test-e2e.yml -f test_suite=metrics
```

### Scheduled Tests
Tests run automatically daily at 2 AM UTC.

## Validation

Tests validate:
1. ✅ Workflow files are valid YAML
2. ✅ Agent files have required frontmatter
3. ✅ Skills follow agentskills.io spec
4. ✅ Security configuration exists and is valid
5. ✅ Documentation completeness
6. ✅ Orchestration flow works end-to-end
7. ✅ Event-driven triggers fire correctly
8. ✅ Metrics are collected and logged
9. ✅ Issue state transitions correctly
10. ✅ Artifacts are created in correct locations

## Cleanup

Test issues are automatically closed and cleaned up after test completion.

## Metrics

Test execution time target: <5 minutes
Test coverage target: >80% of orchestration paths
