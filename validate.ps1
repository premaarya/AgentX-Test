#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Validate your workflow compliance

.DESCRIPTION
    Checks if your repository follows AgentX workflow guidelines.
    Validates:
    - Issue-first workflow compliance
    - Commit message format
    - GitHub labels setup
    - Git hooks installation
    - Documentation presence

.EXAMPLE
    .\validate.ps1
    
.EXAMPLE
    pwsh validate.ps1
#>

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

# Colors
function Write-Check($msg) { Write-Host "→ " -ForegroundColor Gray -NoNewline; Write-Host $msg -ForegroundColor Gray }
function Write-Pass($msg) { Write-Host "✓ " -ForegroundColor Green -NoNewline; Write-Host $msg }
function Write-Fail($msg) { Write-Host "✗ " -ForegroundColor Red -NoNewline; Write-Host $msg }
function Write-Warn($msg) { Write-Host "⚠ " -ForegroundColor Yellow -NoNewline; Write-Host $msg }
function Write-Info($msg) { Write-Host "ℹ " -ForegroundColor Blue -NoNewline; Write-Host $msg }

$script:passed = 0
$script:failed = 0
$script:warned = 0

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AgentX Workflow Validation" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check 1: Git repository
Write-Check "Checking if this is a git repository..."
if (Test-Path ".git") {
    Write-Pass "Git repository detected"
    $script:passed++
} else {
    Write-Fail "Not a git repository"
    Write-Host "  Run: git init" -ForegroundColor Yellow
    $script:failed++
    exit 1
}

# Check 2: GitHub CLI
Write-Check "Checking for GitHub CLI..."
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Pass "GitHub CLI is installed"
    $script:passed++
} else {
    Write-Fail "GitHub CLI not found"
    Write-Host "  Install: https://cli.github.com/" -ForegroundColor Yellow
    $script:failed++
}

# Check 3: Git hooks
Write-Check "Checking git hooks installation..."
$hooksInstalled = $true
$hooks = @("pre-commit", "commit-msg")
foreach ($hook in $hooks) {
    if (-not (Test-Path ".git/hooks/$hook")) {
        Write-Fail "$hook hook not found"
        $hooksInstalled = $false
        $script:failed++
    }
}
if ($hooksInstalled) {
    Write-Pass "Git hooks are installed"
    $script:passed++
}

# Check 4: Required files
Write-Check "Checking required documentation files..."
$requiredFiles = @(
    "AGENTS.md",
    "Skills.md",
    "CONTRIBUTING.md",
    ".github/copilot-instructions.md"
)
$allFilesPresent = $true
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Fail "Missing: $file"
        $allFilesPresent = $false
        $script:failed++
    }
}
if ($allFilesPresent) {
    Write-Pass "All required documentation files present"
    $script:passed++
}

# Check 5: Issue templates
Write-Check "Checking issue templates..."
$templates = @("epic.yml", "feature.yml", "story.yml", "bug.yml", "spike.yml", "docs.yml")
$templatesPresent = $true
foreach ($template in $templates) {
    if (-not (Test-Path ".github/ISSUE_TEMPLATE/$template")) {
        Write-Warn "Missing issue template: $template"
        $templatesPresent = $false
        $script:warned++
    }
}
if ($templatesPresent) {
    Write-Pass "All issue templates present"
    $script:passed++
}

# Check 6: PR template
Write-Check "Checking PR template..."
if (Test-Path ".github/PULL_REQUEST_TEMPLATE.md") {
    Write-Pass "PR template present"
    $script:passed++
} else {
    Write-Warn "Missing PR template"
    $script:warned++
}

# Check 7: GitHub labels
Write-Check "Checking GitHub labels..."
if (Get-Command gh -ErrorAction SilentlyContinue) {
    $labels = gh label list --json name --jq '.[].name' 2>$null
    if ($labels) {
        $requiredLabels = @(
            "type:epic", "type:feature", "type:story", "type:bug", "type:spike", "type:docs",
            "status:ready", "status:in-progress", "status:done",
            "priority:p0", "priority:p1", "priority:p2", "priority:p3"
        )
        $missingLabels = @()
        foreach ($label in $requiredLabels) {
            if ($labels -notcontains $label) {
                $missingLabels += $label
            }
        }
        if ($missingLabels.Count -eq 0) {
            Write-Pass "All required labels present"
            $script:passed++
        } else {
            Write-Warn "Missing labels: $($missingLabels -join ', ')"
            Write-Host "  See CONTRIBUTING.md for label creation commands" -ForegroundColor Yellow
            $script:warned++
        }
    } else {
        Write-Warn "Could not check labels (not a GitHub repo or not authenticated)"
        $script:warned++
    }
} else {
    Write-Warn "Cannot check labels without GitHub CLI"
    $script:warned++
}

# Check 8: Recent commits
Write-Check "Checking recent commit messages..."
$recentCommits = git log -10 --pretty=format:"%s" 2>$null
if ($recentCommits) {
    $commitsWithIssue = 0
    $totalCommits = 0
    foreach ($commit in $recentCommits) {
        if ($commit -match '#\d+') {
            $commitsWithIssue++
        }
        $totalCommits++
    }
    $percentage = [math]::Round(($commitsWithIssue / $totalCommits) * 100)
    if ($percentage -ge 80) {
        Write-Pass "$percentage% of recent commits reference issues"
        $script:passed++
    } elseif ($percentage -ge 50) {
        Write-Warn "$percentage% of recent commits reference issues (target: 80%+)"
        $script:warned++
    } else {
        Write-Fail "Only $percentage% of recent commits reference issues (target: 80%+)"
        $script:failed++
    }
} else {
    Write-Warn "No commit history to check"
    $script:warned++
}

# Check 9: MCP configuration
Write-Check "Checking MCP Server configuration..."
if (Test-Path ".vscode/mcp.json") {
    Write-Pass "MCP Server configured"
    $script:passed++
} else {
    Write-Warn "MCP Server not configured (optional for non-Copilot users)"
    Write-Host "  See docs/mcp-integration.md" -ForegroundColor Yellow
    $script:warned++
}

# Check 10: GitHub Actions
Write-Check "Checking GitHub Actions workflows..."
$workflows = @(
    ".github/workflows/enforce-issue-workflow.yml",
    ".github/workflows/orchestrate.yml"
)
$workflowsPresent = $true
foreach ($workflow in $workflows) {
    if (-not (Test-Path $workflow)) {
        Write-Warn "Missing workflow: $workflow"
        $workflowsPresent = $false
        $script:warned++
    }
}
if ($workflowsPresent) {
    Write-Pass "Key GitHub Actions workflows present"
    $script:passed++
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Validation Summary" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Passed:  " -NoNewline; Write-Host $script:passed -ForegroundColor Green
Write-Host "  Warnings:" -NoNewline; Write-Host $script:warned -ForegroundColor Yellow
Write-Host "  Failed:  " -NoNewline; Write-Host $script:failed -ForegroundColor Red
Write-Host ""

if ($script:failed -eq 0) {
    if ($script:warned -eq 0) {
        Write-Host "✓ All checks passed! Your repository is compliant." -ForegroundColor Green
        exit 0
    } else {
        Write-Host "⚠ Some optional features missing. See warnings above." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "✗ Some required checks failed. Fix issues above." -ForegroundColor Red
    exit 1
}
