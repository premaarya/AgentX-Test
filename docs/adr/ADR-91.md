# Architecture Decision Record (ADR)

**Issue**: #91  
**Title**: Test ADR Enforcement  
**Type**: Feature  
**Status**: In Progress  
**Created**: 2026-01-26

---

## Context

Testing that Features require BOTH Architecture Decision Record (ADR) AND Technical Specification before code can be committed.

## Decision

Enforce workflow through Git hooks:
- Pre-commit hook validates ADR exists
- Commit-msg hook validates ADR exists
- Both hooks check for Spec as well

## Consequences

### Positive
- ✅ Architecture decisions are documented before implementation
- ✅ Technical specifications follow architectural decisions
- ✅ Impossible to skip Architect workflow phase

### Negative
- ⚠️ Requires creating documents before coding

## Alternatives Considered

1. **Advisory approach**: Rely on documentation to guide agents
   - Rejected: Agents can skip/forget workflow steps

2. **CI-only validation**: Check documents in GitHub Actions
   - Rejected: Too late - code already committed locally

3. **Pre-commit hooks** (CHOSEN)
   - Selected: Prevents commits at source, immediate feedback

---

**Architect**: GitHub Copilot  
**Date**: January 26, 2026
