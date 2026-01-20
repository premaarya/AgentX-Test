#!/bin/bash
#
# Validate your workflow compliance
#
# Checks if your repository follows AgentX workflow guidelines.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m' # No Color

check() { echo -e "${GRAY}→${NC} ${GRAY}$1${NC}"; }
pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
info() { echo -e "${BLUE}ℹ${NC} $1"; }

PASSED=0
FAILED=0
WARNED=0

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}  AgentX Workflow Validation${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo ""

# Check 1: Git repository
check "Checking if this is a git repository..."
if [ -d ".git" ]; then
    pass "Git repository detected"
    ((PASSED++))
else
    fail "Not a git repository"
    echo -e "  ${YELLOW}Run: git init${NC}"
    ((FAILED++))
    exit 1
fi

# Check 2: GitHub CLI
check "Checking for GitHub CLI..."
if command -v gh &> /dev/null; then
    pass "GitHub CLI is installed"
    ((PASSED++))
else
    fail "GitHub CLI not found"
    echo -e "  ${YELLOW}Install: https://cli.github.com/${NC}"
    ((FAILED++))
fi

# Check 3: Git hooks
check "Checking git hooks installation..."
HOOKS_INSTALLED=true
for hook in pre-commit commit-msg; do
    if [ ! -f ".git/hooks/$hook" ]; then
        fail "$hook hook not found"
        HOOKS_INSTALLED=false
        ((FAILED++))
    fi
done
if [ "$HOOKS_INSTALLED" = true ]; then
    pass "Git hooks are installed"
    ((PASSED++))
fi

# Check 4: Required files
check "Checking required documentation files..."
ALL_FILES_PRESENT=true
for file in "AGENTS.md" "Skills.md" "CONTRIBUTING.md" ".github/copilot-instructions.md"; do
    if [ ! -f "$file" ]; then
        fail "Missing: $file"
        ALL_FILES_PRESENT=false
        ((FAILED++))
    fi
done
if [ "$ALL_FILES_PRESENT" = true ]; then
    pass "All required documentation files present"
    ((PASSED++))
fi

# Check 5: Issue templates
check "Checking issue templates..."
TEMPLATES_PRESENT=true
for template in epic.yml feature.yml story.yml bug.yml spike.yml docs.yml; do
    if [ ! -f ".github/ISSUE_TEMPLATE/$template" ]; then
        warn "Missing issue template: $template"
        TEMPLATES_PRESENT=false
        ((WARNED++))
    fi
done
if [ "$TEMPLATES_PRESENT" = true ]; then
    pass "All issue templates present"
    ((PASSED++))
fi

# Check 6: PR template
check "Checking PR template..."
if [ -f ".github/PULL_REQUEST_TEMPLATE.md" ]; then
    pass "PR template present"
    ((PASSED++))
else
    warn "Missing PR template"
    ((WARNED++))
fi

# Check 7: GitHub labels
check "Checking GitHub labels..."
if command -v gh &> /dev/null; then
    if gh label list --json name &> /dev/null; then
        LABELS=$(gh label list --json name --jq '.[].name' 2>/dev/null)
        REQUIRED_LABELS=(
            "type:epic" "type:feature" "type:story" "type:bug" "type:spike" "type:docs"
            "priority:p0" "priority:p1" "priority:p2" "priority:p3"
            "orch:pm-done" "orch:architect-done" "orch:ux-done" "orch:engineer-done"
        )
        MISSING_LABELS=()
        for label in "${REQUIRED_LABELS[@]}"; do
            if ! echo "$LABELS" | grep -q "^$label$"; then
                MISSING_LABELS+=("$label")
            fi
        done
        if [ ${#MISSING_LABELS[@]} -eq 0 ]; then
            pass "All required labels present"
            ((PASSED++))
        else
            warn "Missing labels: ${MISSING_LABELS[*]}"
            echo -e "  ${YELLOW}See CONTRIBUTING.md for label creation commands${NC}"
            ((WARNED++))
        fi
    else
        warn "Could not check labels (not a GitHub repo or not authenticated)"
        ((WARNED++))
    fi
else
    warn "Cannot check labels without GitHub CLI"
    ((WARNED++))
fi

# Check 8: Recent commits
check "Checking recent commit messages..."
if git log -1 &> /dev/null; then
    RECENT_COMMITS=$(git log -10 --pretty=format:"%s" 2>/dev/null)
    COMMITS_WITH_ISSUE=$(echo "$RECENT_COMMITS" | grep -c '#[0-9]' || true)
    TOTAL_COMMITS=$(echo "$RECENT_COMMITS" | wc -l)
    PERCENTAGE=$((COMMITS_WITH_ISSUE * 100 / TOTAL_COMMITS))
    
    if [ $PERCENTAGE -ge 80 ]; then
        pass "$PERCENTAGE% of recent commits reference issues"
        ((PASSED++))
    elif [ $PERCENTAGE -ge 50 ]; then
        warn "$PERCENTAGE% of recent commits reference issues (target: 80%+)"
        ((WARNED++))
    else
        fail "Only $PERCENTAGE% of recent commits reference issues (target: 80%+)"
        ((FAILED++))
    fi
else
    warn "No commit history to check"
    ((WARNED++))
fi

# Check 9: MCP configuration
check "Checking MCP Server configuration..."
if [ -f ".vscode/mcp.json" ]; then
    pass "MCP Server configured"
    ((PASSED++))
else
    warn "MCP Server not configured (optional for non-Copilot users)"
    echo -e "  ${YELLOW}See docs/mcp-integration.md${NC}"
    ((WARNED++))
fi

# Check 10: GitHub Actions
check "Checking GitHub Actions workflows..."
WORKFLOWS_PRESENT=true
for workflow in ".github/workflows/agent-orchestrator.yml" ".github/workflows/test-e2e.yml"; do
    if [ ! -f "$workflow" ]; then
        warn "Missing workflow: $workflow"
        WORKFLOWS_PRESENT=false
        ((WARNED++))
    fi
done
if [ "$WORKFLOWS_PRESENT" = true ]; then
    pass "Key GitHub Actions workflows present"
    ((PASSED++))
fi

# Summary
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Validation Summary${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "  Passed:  ${GREEN}$PASSED${NC}"
echo -e "  Warnings:${YELLOW}$WARNED${NC}"
echo -e "  Failed:  ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNED -eq 0 ]; then
        echo -e "${GREEN}✓ All checks passed! Your repository is compliant.${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠ Some optional features missing. See warnings above.${NC}"
        exit 0
    fi
else
    echo -e "${RED}✗ Some required checks failed. Fix issues above.${NC}"
    exit 1
fi
