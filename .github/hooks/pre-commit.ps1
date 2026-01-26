# Pre-commit hook: Security, quality, and AgentX workflow enforcement
# PowerShell version for Windows
# Runs before commit to catch issues early and enforce workflow compliance

Write-Host "🔍 Running pre-commit checks..." -ForegroundColor Cyan
Write-Host ""

$script:Failed = $false

# ============================================================================
# AGENTX WORKFLOW VALIDATION (CRITICAL - CANNOT BYPASS)
# ============================================================================

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "AgentX Workflow Validation" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Extract issue number from commit message
$commitMsgFile = ".git\COMMIT_EDITMSG"
if (Test-Path $commitMsgFile) {
    $commitMsg = Get-Content $commitMsgFile -Raw
} else {
    # For amended commits
    $commitMsg = git log -1 --pretty=%B 2>$null
}

Write-Host "Checking for issue reference... " -NoNewline
$issueNumber = if ($commitMsg -match '#(\d+)') { $Matches[1] } else { $null }

if (-not $issueNumber) {
    Write-Host "❌ BLOCKED" -ForegroundColor Red
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║  WORKFLOW VIOLATION: No issue number in commit    ║" -ForegroundColor Red
    Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
    Write-Host "Your commit message must reference a GitHub issue:"
    Write-Host ""
    Write-Host "  Required format: type: description (#123)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ✅ feat: add user login (#42)"
    Write-Host "  ✅ fix: resolve memory leak (#101)"
    Write-Host "  ✅ docs: update README (#88)"
    Write-Host ""
    Write-Host "Create an issue first:"
    Write-Host "  gh issue create --title '[Type] Description' --label 'type:story'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "AgentX requires issue-first workflow for audit trail and coordination."
    Write-Host ""
    $script:Failed = $true
} else {
    Write-Host "✅ Issue #$issueNumber" -ForegroundColor Green
    
    # Check if gh CLI is available
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        Write-Host "⚠️  GitHub CLI not installed, skipping workflow validation" -ForegroundColor Yellow
        Write-Host "   Install from: https://cli.github.com"
    } else {
        # Get issue labels
        Write-Host "Fetching issue metadata... " -NoNewline
        try {
            $issueLabels = gh issue view $issueNumber --json labels -q '.labels[].name' 2>$null | Out-String
            
            if ([string]::IsNullOrWhiteSpace($issueLabels)) {
                Write-Host "⚠️  Cannot fetch (offline or no access)" -ForegroundColor Yellow
            } else {
                Write-Host "✅" -ForegroundColor Green
                
                # Check for type label
                Write-Host "Checking issue type... " -NoNewline
                $issueType = $issueLabels -split "`n" | Where-Object { $_ -match "^type:" } | Select-Object -First 1
                
                if (-not $issueType) {
                    Write-Host "❌ BLOCKED" -ForegroundColor Red
                    Write-Host ""
                    Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Red
                    Write-Host "║  WORKFLOW VIOLATION: Issue missing type label     ║" -ForegroundColor Red
                    Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Red
                    Write-Host ""
                    Write-Host "Issue #$issueNumber must have a type label:"
                    Write-Host ""
                    Write-Host "  gh issue edit $issueNumber --add-label 'type:story'" -ForegroundColor Cyan
                    Write-Host ""
                    Write-Host "Valid types:"
                    Write-Host "  • type:epic     - Large initiative (requires PRD)"
                    Write-Host "  • type:feature  - New capability (requires Spec)"
                    Write-Host "  • type:story    - Small task"
                    Write-Host "  • type:bug      - Defect to fix"
                    Write-Host "  • type:spike    - Research"
                    Write-Host "  • type:docs     - Documentation only"
                    Write-Host ""
                    $script:Failed = $true
                } else {
                    Write-Host "✅ $issueType" -ForegroundColor Green
                    
                    # Validate workflow documents based on type
                    switch ($issueType.Trim()) {
                        "type:epic" {
                            Write-Host "Checking for PRD document... " -NoNewline
                            $prdPath = "docs\prd\PRD-$issueNumber.md"
                            if (-not (Test-Path $prdPath)) {
                                Write-Host "❌ BLOCKED" -ForegroundColor Red
                                Write-Host ""
                                Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Red
                                Write-Host "║  WORKFLOW VIOLATION: Epic requires PRD first      ║" -ForegroundColor Red
                                Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Red
                                Write-Host ""
                                Write-Host "Missing: $prdPath"
                                Write-Host ""
                                Write-Host "AgentX Workflow for Epics:"
                                Write-Host "  1. Product Manager creates PRD"
                                Write-Host "  2. Architect creates ADR + Tech Spec"
                                Write-Host "  3. UX Designer creates UX Design"
                                Write-Host "  4. Engineer implements code ← YOU ARE HERE"
                                Write-Host "  5. Reviewer conducts code review"
                                Write-Host ""
                                Write-Host "Create PRD first:"
                                Write-Host "  • Use template: .github\templates\PRD-TEMPLATE.md"
                                Write-Host "  • Or run: gh workflow run run-product-manager.yml -f issue_number=$issueNumber" -ForegroundColor Cyan
                                Write-Host ""
                                $script:Failed = $true
                            } else {
                                Write-Host "✅ Found" -ForegroundColor Green
                                
                                # Check for ADR (advisory warning)
                                Write-Host "Checking for ADR document... " -NoNewline
                                $adrPath = "docs\adr\ADR-$issueNumber.md"
                                if (-not (Test-Path $adrPath)) {
                                    Write-Host "⚠️  Recommended (not blocking)" -ForegroundColor Yellow
                                    Write-Host "   Consider creating: $adrPath"
                                } else {
                                    Write-Host "✅ Found" -ForegroundColor Green
                                }
                            }
                        }
                        
                        "type:feature" {
                            Write-Host "Checking for Tech Spec... " -NoNewline
                            $specPath = "docs\specs\SPEC-$issueNumber.md"
                            if (-not (Test-Path $specPath)) {
                                Write-Host "❌ BLOCKED" -ForegroundColor Red
                                Write-Host ""
                                Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Red
                                Write-Host "║  WORKFLOW VIOLATION: Feature requires Spec first  ║" -ForegroundColor Red
                                Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Red
                                Write-Host ""
                                Write-Host "Missing: $specPath"
                                Write-Host ""
                                Write-Host "AgentX Workflow for Features:"
                                Write-Host "  1. Architect creates Tech Spec"
                                Write-Host "  2. Engineer implements code ← YOU ARE HERE"
                                Write-Host "  3. Reviewer conducts code review"
                                Write-Host ""
                                Write-Host "Create Spec first:"
                                Write-Host "  • Use template: .github\templates\SPEC-TEMPLATE.md"
                                Write-Host "  • Or run: gh workflow run run-architect.yml -f issue_number=$issueNumber" -ForegroundColor Cyan
                                Write-Host ""
                                $script:Failed = $true
                            } else {
                                Write-Host "✅ Found" -ForegroundColor Green
                            }
                        }
                        
                        "type:story" {
                            Write-Host "✅ Story type (check issue for acceptance criteria)" -ForegroundColor Green
                        }
                        
                        "type:bug" {
                            Write-Host "✅ Bug fix (can proceed)" -ForegroundColor Green
                        }
                        
                        { $_ -in "type:spike", "type:docs" } {
                            Write-Host "✅ $issueType (can proceed)" -ForegroundColor Green
                        }
                    }
                    
                    # Check orchestration labels (advisory)
                    if ($issueLabels -match "stage:engineer") {
                        if ($issueLabels -notmatch "stage:architect-done") {
                            Write-Host "⚠️  WARNING: Engineer stage active but architect not complete" -ForegroundColor Yellow
                            Write-Host "   This may indicate workflow was skipped"
                        }
                    }
                }
            }
        } catch {
            Write-Host "⚠️  Error fetching issue" -ForegroundColor Yellow
        }
    }
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# SECURITY AND QUALITY CHECKS
# ============================================================================

Write-Host "Security & Quality Checks:"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

# Check 1: No secrets in staged files
Write-Host "Checking for secrets... " -NoNewline
$stagedFiles = git diff --cached --name-only
$secretPattern = '(password|api[_-]?key|secret|token|private[_-]?key)\s*=\s*["\x27][^\"\x27]+["\x27]'
$foundSecrets = $false

foreach ($file in $stagedFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw -ErrorAction SilentlyContinue
        if ($content -match $secretPattern) {
            $foundSecrets = $true
            break
        }
    }
}

if ($foundSecrets) {
    Write-Host "❌ FAILED" -ForegroundColor Red
    Write-Host "  Found potential secrets in staged files!"
    Write-Host "  Use environment variables instead."
    $script:Failed = $true
} else {
    Write-Host "✅ PASSED" -ForegroundColor Green
}

# Check 2: No large files (>1MB)
Write-Host "Checking file sizes... " -NoNewline
$largeFiles = $stagedFiles | Where-Object { 
    (Test-Path $_) -and ((Get-Item $_).Length -gt 1MB) 
}

if ($largeFiles) {
    Write-Host "⚠️  WARNING" -ForegroundColor Yellow
    Write-Host "  Large files detected (>1MB):"
    $largeFiles | ForEach-Object { Write-Host "    $_" }
    Write-Host "  Consider using Git LFS for large files."
} else {
    Write-Host "✅ PASSED" -ForegroundColor Green
}

# Check 3: No direct master/main commits
$branch = git symbolic-ref --short HEAD 2>$null
if ($branch -in "main", "master") {
    Write-Host "⚠️  WARNING: You're committing directly to $branch" -ForegroundColor Yellow
    Write-Host "   Consider using feature branches instead"
}

# Check 4: Run formatters (if available)
if (Get-Command dotnet -ErrorAction SilentlyContinue) {
    Write-Host "Checking C# formatting... " -NoNewline
    $csFiles = git diff --cached --name-only --diff-filter=ACM | Where-Object { $_ -match '\.cs$' }
    
    if ($csFiles) {
        $formatArgs = @("format", "--verify-no-changes", "--include") + $csFiles
        $formatResult = & dotnet $formatArgs 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ PASSED" -ForegroundColor Green
        } else {
            Write-Host "⚠️  NEEDS FORMATTING" -ForegroundColor Yellow
            Write-Host "  Run: dotnet format"
            # Auto-format and re-stage
            & dotnet format --include $csFiles
            git add $csFiles
            Write-Host "  Files auto-formatted and re-staged"
        }
    } else {
        Write-Host "✅ SKIPPED (no C# files)" -ForegroundColor Green
    }
}

# Summary
Write-Host ""
if ($script:Failed) {
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║                                                           ║" -ForegroundColor Red
    Write-Host "║           ❌ PRE-COMMIT CHECKS FAILED                     ║" -ForegroundColor Red
    Write-Host "║                                                           ║" -ForegroundColor Red
    Write-Host "║  Fix the issues above and commit again.                  ║" -ForegroundColor Red
    Write-Host "║                                                           ║" -ForegroundColor Red
    Write-Host "║  AgentX workflow enforcement cannot be bypassed.          ║" -ForegroundColor Red
    Write-Host "║                                                           ║" -ForegroundColor Red
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
    exit 1
} else {
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                                                           ║" -ForegroundColor Green
    Write-Host "║           ✅ ALL CHECKS PASSED                            ║" -ForegroundColor Green
    Write-Host "║                                                           ║" -ForegroundColor Green
    Write-Host "║  Your commit complies with AgentX standards.             ║" -ForegroundColor Green
    Write-Host "║                                                           ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    exit 0
}
