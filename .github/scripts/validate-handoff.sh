#!/bin/bash
# Validates that agent completed self-review before handoff
# Usage: ./validate-handoff.sh <issue_number> <agent_role>

set -e

ISSUE_NUMBER=$1
AGENT_ROLE=$2

if [ -z "$ISSUE_NUMBER" ] || [ -z "$AGENT_ROLE" ]; then
    echo "❌ Usage: ./validate-handoff.sh <issue_number> <agent_role>"
    echo "   agent_role: pm | ux | architect | engineer"
    exit 1
fi

echo "🔍 Validating handoff for Agent: $AGENT_ROLE, Issue: #$ISSUE_NUMBER"

case $AGENT_ROLE in
  "pm")
    # Check PRD exists
    if [ ! -f "docs/prd/PRD-${ISSUE_NUMBER}.md" ]; then
      echo "❌ BLOCKED: PRD not found at docs/prd/PRD-${ISSUE_NUMBER}.md"
      echo "   PM must create PRD before handoff"
      exit 1
    fi
    
    # Check PRD has required sections
    if ! grep -qi "## Overview" "docs/prd/PRD-${ISSUE_NUMBER}.md"; then
      echo "❌ BLOCKED: PRD missing '## Overview' section"
      exit 1
    fi
    
    if ! grep -qi "## User Stories" "docs/prd/PRD-${ISSUE_NUMBER}.md"; then
      echo "❌ BLOCKED: PRD missing '## User Stories' section"
      exit 1
    fi
    
    # Check backlog created (at least 1 Feature issue)
    if command -v gh &> /dev/null; then
      FEATURES=$(gh issue list --label "type:feature" --search "Parent: #${ISSUE_NUMBER}" --json number --jq 'length' 2>/dev/null || echo "0")
      if [ "$FEATURES" -eq 0 ]; then
        echo "⚠️ WARNING: No Feature issues created yet. PM should create backlog."
        # Don't block - PM might be doing iterative work
      else
        echo "✅ Found $FEATURES Feature issue(s) in backlog"
      fi
    fi
    
    echo "✅ PM handoff validation passed"
    ;;
    
  "ux")
    # Check UX designs exist
    if [ ! -d "docs/ux" ]; then
      echo "❌ BLOCKED: docs/ux/ directory not found"
      exit 1
    fi
    
    UX_FILES=$(find docs/ux -type f -name "*${ISSUE_NUMBER}*" 2>/dev/null | wc -l)
    if [ "$UX_FILES" -eq 0 ]; then
      echo "❌ BLOCKED: No UX design documents found in docs/ux/ for issue #${ISSUE_NUMBER}"
      echo "   UX Designer must create wireframes/prototypes/personas before handoff"
      exit 1
    fi
    
    echo "✅ Found $UX_FILES UX design document(s)"
    
    # Check for key UX deliverables
    if grep -rqi "wireframe\|prototype\|user flow\|persona" docs/ux/*${ISSUE_NUMBER}* 2>/dev/null; then
      echo "✅ UX deliverables (wireframes/prototypes/personas) documented"
    else
      echo "⚠️ WARNING: No wireframes/prototypes/personas mentioned in UX docs"
    fi
    
    echo "✅ UX handoff validation passed"
    ;;
    
  "architect")
    # Check ADR exists
    if [ ! -f "docs/adr/ADR-${ISSUE_NUMBER}.md" ]; then
      echo "❌ BLOCKED: ADR not found at docs/adr/ADR-${ISSUE_NUMBER}.md"
      echo "   Architect must create ADR before handoff"
      exit 1
    fi
    
    # Check Tech Spec exists
    if [ ! -f "docs/specs/SPEC-${ISSUE_NUMBER}.md" ]; then
      echo "❌ BLOCKED: Tech Spec not found at docs/specs/SPEC-${ISSUE_NUMBER}.md"
      echo "   Architect must create Tech Spec before handoff"
      exit 1
    fi
    
    # Check ADR has required sections
    if ! grep -qi "## Decision" "docs/adr/ADR-${ISSUE_NUMBER}.md"; then
      echo "❌ BLOCKED: ADR missing '## Decision' section"
      exit 1
    fi
    
    if ! grep -qi "## Consequences" "docs/adr/ADR-${ISSUE_NUMBER}.md"; then
      echo "❌ BLOCKED: ADR missing '## Consequences' section"
      exit 1
    fi
    
    # Check Tech Spec has API contracts or data models
    if ! grep -qi "API\|endpoint\|data model\|schema" "docs/specs/SPEC-${ISSUE_NUMBER}.md"; then
      echo "⚠️ WARNING: Tech Spec should include API contracts or data models"
    fi
    
    # Check Architecture document exists (optional but recommended)
    if [ -f "docs/architecture/ARCH-${ISSUE_NUMBER}.md" ]; then
      echo "✅ Architecture document found"
    fi
    
    echo "✅ Architect handoff validation passed"
    ;;
    
  "engineer")
    # Check code committed
    if command -v git &> /dev/null; then
      COMMITS=$(git log --all --grep="#${ISSUE_NUMBER}" --oneline 2>/dev/null | wc -l)
      if [ "$COMMITS" -eq 0 ]; then
        echo "❌ BLOCKED: No commits referencing issue #${ISSUE_NUMBER}"
        echo "   Engineer must commit code with '#${ISSUE_NUMBER}' in message"
        exit 1
      fi
      echo "✅ Found $COMMITS commit(s) referencing issue #${ISSUE_NUMBER}"
    fi
    
    # Check tests exist (look for test files modified recently)
    if [ -d "tests" ]; then
      RECENT_TESTS=$(find tests -type f \( -name "*test*" -o -name "*Test*" -o -name "*spec*" \) -mtime -1 2>/dev/null | wc -l)
      if [ "$RECENT_TESTS" -eq 0 ]; then
        echo "⚠️ WARNING: No recent test files found in tests/"
        echo "   Engineer should write tests (≥80% coverage required)"
      else
        echo "✅ Found $RECENT_TESTS recent test file(s)"
      fi
    fi
    
    # Check for XML docs in C# files (if applicable)
    if find . -name "*.cs" -type f 2>/dev/null | head -1 | grep -q "."; then
      UNDOCUMENTED=$(find . -name "*.cs" -exec grep -l "public " {} \; 2>/dev/null | 
                     xargs grep -L "///" 2>/dev/null | wc -l)
      if [ "$UNDOCUMENTED" -gt 0 ]; then
        echo "⚠️ WARNING: $UNDOCUMENTED C# files with public APIs missing XML docs"
      fi
    fi
    
    echo "✅ Engineer handoff validation passed"
    ;;
    
  *)
    echo "❌ Unknown agent role: $AGENT_ROLE"
    echo "   Valid roles: pm, ux, architect, engineer"
    exit 1
    ;;
esac

echo ""
echo "🎉 All validations passed! Agent can proceed with handoff."
exit 0
