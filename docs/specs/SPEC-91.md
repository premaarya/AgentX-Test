# Technical Specification

**Issue**: #91  
**Title**: Test ADR Enforcement  
**Type**: Feature  
**Status**: In Progress  
**Created**: 2026-01-26

---

## Overview

Technical specification for enforcing Architecture Decision Records (ADR) and Technical Specs in the AgentX workflow through Git hooks.

## Architecture Reference

See [ADR-91](../adr/ADR-91.md) for architectural decisions.

## Technical Design

### Pre-commit Hook
- **Location**: `.github/hooks/pre-commit`
- **Function**: Validates workflow documents before staging commit
- **Language**: Bash
- **Dependencies**: GitHub CLI (`gh`)

### Commit-msg Hook
- **Location**: `.github/hooks/commit-msg`
- **Function**: Validates commit message and required documents
- **Language**: Bash
- **Dependencies**: GitHub CLI (`gh`)

## Implementation Details

### Validation Logic

```bash
case $ISSUE_TYPE in
  "type:feature")
    # Check ADR exists
    if [ ! -f "docs/adr/ADR-${ISSUE_NUMBER}.md" ]; then
      exit 1
    fi
    # Check Spec exists
    if [ ! -f "docs/specs/SPEC-${ISSUE_NUMBER}.md" ]; then
      exit 1
    fi
    ;;
esac
```

### Required Documents by Type

| Type | Required Documents |
|------|-------------------|
| Epic | PRD |
| Feature | **ADR + Spec** (both mandatory) |
| Story | Issue only |
| needs:ux | **UX document** (mandatory) |

## Acceptance Criteria

- [x] Feature without ADR → BLOCKED
- [x] Feature with ADR but no Spec → BLOCKED
- [x] Feature with both ADR and Spec → ALLOWED
- [x] Issue with needs:ux but no UX doc → BLOCKED

---

**Architect**: GitHub Copilot  
**Date**: January 26, 2026
