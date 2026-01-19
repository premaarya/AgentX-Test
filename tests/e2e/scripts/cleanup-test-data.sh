#!/bin/bash
# Cleanup Test Data
# Removes test artifacts created during E2E tests

set -e

echo "🧹 Cleaning up E2E test artifacts"
echo "================================="

# Close all test issues
echo ""
echo "Closing test issues..."
gh issue list --label "e2e-test" --state open --json number --jq '.[].number' | while read -r issue_num; do
    echo "Closing issue #$issue_num"
    gh issue close "$issue_num" --comment "🧹 Closed by E2E test cleanup"
done

# Delete test branches (if any)
echo ""
echo "Cleaning up test branches..."
git branch --list 'e2e-test/*' | while read -r branch; do
    echo "Deleting branch: $branch"
    git branch -D "$branch" || true
done

# Remove test artifacts from docs
echo ""
echo "Cleaning up test documents..."
find docs/ -name "*e2e-test*" -type f -exec rm -v {} \; || true

# Summary
echo ""
echo "================================="
echo "✅ Cleanup complete!"
