# Validates that agent completed self-review before handoff (PowerShell version)
# Usage: .\validate-handoff.ps1 -IssueNumber <number> -AgentRole <role>

param(
    [Parameter(Mandatory=$true)]
    [int]$IssueNumber,
    
    [Parameter(Mandatory=$true)]
    [ValidateSet("pm", "ux", "architect", "engineer")]
    [string]$AgentRole
)

$ErrorActionPreference = "Stop"

Write-Host "🔍 Validating handoff for Agent: $AgentRole, Issue: #$IssueNumber" -ForegroundColor Cyan

switch ($AgentRole) {
    "pm" {
        # Check PRD exists
        $prdPath = "docs/prd/PRD-$IssueNumber.md"
        if (-not (Test-Path $prdPath)) {
            Write-Host "❌ BLOCKED: PRD not found at $prdPath" -ForegroundColor Red
            Write-Host "   PM must create PRD before handoff" -ForegroundColor Yellow
            exit 1
        }
        
        # Check PRD has required sections
        $prdContent = Get-Content $prdPath -Raw
        if ($prdContent -notmatch "(?i)## Overview") {
            Write-Host "❌ BLOCKED: PRD missing '## Overview' section" -ForegroundColor Red
            exit 1
        }
        
        if ($prdContent -notmatch "(?i)## User Stories") {
            Write-Host "❌ BLOCKED: PRD missing '## User Stories' section" -ForegroundColor Red
            exit 1
        }
        
        # Check backlog created (if gh CLI available)
        if (Get-Command gh -ErrorAction SilentlyContinue) {
            $features = & gh issue list --label "type:feature" --search "Parent: #$IssueNumber" --json number --jq 'length' 2>$null
            if (-not $features -or $features -eq "0") {
                Write-Host "⚠️ WARNING: No Feature issues created yet. PM should create backlog." -ForegroundColor Yellow
            } else {
                Write-Host "✅ Found $features Feature issue(s) in backlog" -ForegroundColor Green
            }
        }
        
        Write-Host "✅ PM handoff validation passed" -ForegroundColor Green
    }
    
    "ux" {
        # Check UX designs exist
        if (-not (Test-Path "docs/ux")) {
            Write-Host "❌ BLOCKED: docs/ux/ directory not found" -ForegroundColor Red
            exit 1
        }
        
        $uxFiles = Get-ChildItem -Path "docs/ux" -Filter "*$IssueNumber*" -File -ErrorAction SilentlyContinue
        if (-not $uxFiles -or $uxFiles.Count -eq 0) {
            Write-Host "❌ BLOCKED: No UX design documents found in docs/ux/ for issue #$IssueNumber" -ForegroundColor Red
            Write-Host "   UX Designer must create wireframes/prototypes/personas before handoff" -ForegroundColor Yellow
            exit 1
        }
        
        Write-Host "✅ Found $($uxFiles.Count) UX design document(s)" -ForegroundColor Green
        
        # Check for key UX deliverables
        $hasDeliverables = $false
        foreach ($file in $uxFiles) {
            $content = Get-Content $file.FullName -Raw
            if ($content -match "(?i)wireframe|prototype|user flow|persona") {
                $hasDeliverables = $true
                break
            }
        }
        
        if ($hasDeliverables) {
            Write-Host "✅ UX deliverables (wireframes/prototypes/personas) documented" -ForegroundColor Green
        } else {
            Write-Host "⚠️ WARNING: No wireframes/prototypes/personas mentioned in UX docs" -ForegroundColor Yellow
        }
        
        Write-Host "✅ UX handoff validation passed" -ForegroundColor Green
    }
    
    "architect" {
        # Check ADR exists
        $adrPath = "docs/adr/ADR-$IssueNumber.md"
        if (-not (Test-Path $adrPath)) {
            Write-Host "❌ BLOCKED: ADR not found at $adrPath" -ForegroundColor Red
            Write-Host "   Architect must create ADR before handoff" -ForegroundColor Yellow
            exit 1
        }
        
        # Check Tech Spec exists
        $specPath = "docs/specs/SPEC-$IssueNumber.md"
        if (-not (Test-Path $specPath)) {
            Write-Host "❌ BLOCKED: Tech Spec not found at $specPath" -ForegroundColor Red
            Write-Host "   Architect must create Tech Spec before handoff" -ForegroundColor Yellow
            exit 1
        }
        
        # Check ADR has required sections
        $adrContent = Get-Content $adrPath -Raw
        if ($adrContent -notmatch "(?i)## Decision") {
            Write-Host "❌ BLOCKED: ADR missing '## Decision' section" -ForegroundColor Red
            exit 1
        }
        
        if ($adrContent -notmatch "(?i)## Consequences") {
            Write-Host "❌ BLOCKED: ADR missing '## Consequences' section" -ForegroundColor Red
            exit 1
        }
        
        # Check Tech Spec has API contracts or data models
        $specContent = Get-Content $specPath -Raw
        if ($specContent -notmatch "(?i)API|endpoint|data model|schema") {
            Write-Host "⚠️ WARNING: Tech Spec should include API contracts or data models" -ForegroundColor Yellow
        }
        
        # Check Architecture document exists (optional)
        $archPath = "docs/architecture/ARCH-$IssueNumber.md"
        if (Test-Path $archPath) {
            Write-Host "✅ Architecture document found" -ForegroundColor Green
        }
        
        Write-Host "✅ Architect handoff validation passed" -ForegroundColor Green
    }
    
    "engineer" {
        # Check code committed
        if (Get-Command git -ErrorAction SilentlyContinue) {
            $commits = & git log --all --grep="#$IssueNumber" --oneline 2>$null
            if (-not $commits) {
                Write-Host "❌ BLOCKED: No commits referencing issue #$IssueNumber" -ForegroundColor Red
                Write-Host "   Engineer must commit code with '#$IssueNumber' in message" -ForegroundColor Yellow
                exit 1
            }
            $commitCount = ($commits | Measure-Object).Count
            Write-Host "✅ Found $commitCount commit(s) referencing issue #$IssueNumber" -ForegroundColor Green
        }
        
        # Check tests exist
        if (Test-Path "tests") {
            $recentTests = Get-ChildItem -Path "tests" -Recurse -Include "*test*","*Test*","*spec*" -File |
                Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-1) }
            
            if (-not $recentTests -or $recentTests.Count -eq 0) {
                Write-Host "⚠️ WARNING: No recent test files found in tests/" -ForegroundColor Yellow
                Write-Host "   Engineer should write tests (≥80% coverage required)" -ForegroundColor Yellow
            } else {
                Write-Host "✅ Found $($recentTests.Count) recent test file(s)" -ForegroundColor Green
            }
        }
        
        # Check for XML docs in C# files (if applicable)
        $csFiles = Get-ChildItem -Path . -Filter "*.cs" -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch "\\obj\\|\\bin\\" }
        
        if ($csFiles) {
            $undocumented = $csFiles | Where-Object {
                $content = Get-Content $_.FullName -Raw
                ($content -match "public ") -and ($content -notmatch "///")
            }
            
            if ($undocumented) {
                Write-Host "⚠️ WARNING: $($undocumented.Count) C# files with public APIs missing XML docs" -ForegroundColor Yellow
            }
        }
        
        Write-Host "✅ Engineer handoff validation passed" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🎉 All validations passed! Agent can proceed with handoff." -ForegroundColor Green
exit 0
