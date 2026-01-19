#!/bin/bash
# Validate Workflow Outputs
# Checks that expected artifacts are created by workflows

set -e

echo "🔍 Validating Workflow Outputs"
echo "=============================="

ISSUE_NUMBER=$1

if [ -z "$ISSUE_NUMBER" ]; then
    echo "Usage: $0 <issue_number>"
    exit 1
fi

echo "Checking issue #$ISSUE_NUMBER"

# Function to check file exists
check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo "✅ $description: $file"
        return 0
    else
        echo "❌ Missing $description: $file"
        return 1
    fi
}

# Function to check directory exists
check_dir() {
    local dir=$1
    local description=$2
    
    if [ -d "$dir" ]; then
        echo "✅ $description: $dir"
        return 0
    else
        echo "⚠️  Directory not found: $dir"
        return 1
    fi
}

errors=0

# Check PRD (Product Manager output)
echo ""
echo "📋 Checking Product Manager Outputs..."
if ! check_file "docs/prd/PRD-$ISSUE_NUMBER.md" "PRD"; then
    ((errors++))
fi

# Check ADR (Architect output)
echo ""
echo "🏗️  Checking Architect Outputs..."
if ! check_file "docs/adr/ADR-$ISSUE_NUMBER.md" "ADR"; then
    ((errors++))
fi

# Check Tech Spec (Architect output)
if ! check_file "docs/specs/SPEC-$ISSUE_NUMBER.md" "Tech Spec"; then
    ((errors++))
fi

# Check UX artifacts (if applicable)
echo ""
echo "🎨 Checking UX Designer Outputs (optional)..."
check_file "docs/ux/UX-$ISSUE_NUMBER.md" "UX Document" || true

# Check for code changes (Engineer output)
echo ""
echo "💻 Checking Engineer Outputs..."
if git diff --name-only HEAD~1 HEAD | grep -q "\\.cs$\|\\.py$\|\\.js$\|\\.ts$"; then
    echo "✅ Code changes detected"
else
    echo "⚠️  No code changes detected (may be expected for design-only tasks)"
fi

# Check for test files
if git diff --name-only HEAD~1 HEAD | grep -q "test\|spec"; then
    echo "✅ Test files detected"
else
    echo "⚠️  No test files detected"
fi

# Check for review artifacts
echo ""
echo "🔍 Checking Reviewer Outputs..."
check_dir "docs/reviews" "Reviews directory" || true
check_file "docs/reviews/REVIEW-$ISSUE_NUMBER.md" "Review Document" || true

# Summary
echo ""
echo "=============================="
if [ $errors -eq 0 ]; then
    echo "✅ All required outputs validated!"
    exit 0
else
    echo "❌ $errors validation error(s) found"
    exit 1
fi
