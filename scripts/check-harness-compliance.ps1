param(
    [string]$BaseRef = "",
    [switch]$ReportOnly
)

$ErrorActionPreference = 'Stop'

function Get-ChangedFiles {
    param([string]$Base)

    $normalizedBase = $Base
    if (-not [string]::IsNullOrWhiteSpace($normalizedBase)) {
        $normalizedBase = $normalizedBase -replace '^refs/heads/', ''
        $normalizedBase = $normalizedBase -replace '^origin/', ''
    }

    if (-not [string]::IsNullOrWhiteSpace($normalizedBase)) {
        $range = "origin/$normalizedBase..HEAD"
        return @(git diff --name-only $range 2>$null) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    }

    $headRange = @(git diff --name-only HEAD~1..HEAD 2>$null) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    if ($headRange.Count -gt 0) { return $headRange }

    return @(git diff --name-only 2>$null) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
}

function Get-Domain {
    param([string]$File)

    if ($File -like 'docs/*') { return 'docs' }
    if ($File -like '.github/workflows/*') { return 'workflows' }
    if ($File -like 'vscode-extension/src/*') { return 'extension' }
    if ($File -like 'scripts/*') { return 'scripts' }
    if ($File -like '.github/templates/*') { return 'templates' }
    if ($File -like '.github/agents/*') { return 'agents' }
    if ($File -like 'tests/*' -or $File -like 'vscode-extension/src/test/*') { return 'tests' }
    return 'root'
}

function Test-RequiredSection {
    param(
        [string]$Content,
        [string]$Section
    )

    return $Content -match [regex]::Escape($Section)
}

function Test-EvidenceSignal {
    param([string]$Content)

    if ($Content -match 'Evidence:\s+\S+') { return $true }
    if ($Content -match '\[PASS\]|\[FAIL\]') { return $true }
    if ($Content -match 'Validation command:\s+\S+') { return $true }
    return $false
}

$changedFiles = @(Get-ChangedFiles -Base $BaseRef)
$changedCount = $changedFiles.Count
$codeLikePattern = '\.(ts|tsx|js|jsx|cs|py|go|rs|ps1|sh|yml|yaml|json)$'
$codeFileCount = @($changedFiles | Where-Object { $_ -match $codeLikePattern }).Count
$domainCount = @($changedFiles | ForEach-Object { Get-Domain $_ } | Select-Object -Unique).Count

$requiresPlan = $changedCount -ge 8 -or $codeFileCount -ge 4 -or $domainCount -ge 3
$planFiles = @($changedFiles | Where-Object { $_ -match '^docs/plans/.+\.md$' -or $_ -match '(^|/)EXEC-PLAN.+\.md$' })

Write-Host "[INFO] Changed files: $changedCount"
Write-Host "[INFO] Code-like files: $codeFileCount"
Write-Host "[INFO] Domains touched: $domainCount"
Write-Host "[INFO] Requires execution plan: $requiresPlan"

$failures = @()

if ($requiresPlan -and $planFiles.Count -eq 0) {
    $failures += 'Complex work detected but no execution plan file was updated in this change set.'
}

$requiredSections = @(
    '## Purpose / Big Picture',
    '## Progress',
    '## Decision Log',
    '## Plan of Work',
    '## Validation and Acceptance',
    '## Artifacts and Notes'
)

foreach ($planFile in $planFiles) {
    if (-not (Test-Path $planFile)) {
        $failures += "Execution plan file '$planFile' was referenced by the diff but does not exist on disk."
        continue
    }

    $content = Get-Content -Path $planFile -Raw
    foreach ($section in $requiredSections) {
        if (-not (Test-RequiredSection -Content $content -Section $section)) {
            $failures += "Execution plan '$planFile' is missing required section '$section'."
        }
    }

    if (-not (Test-EvidenceSignal -Content $content)) {
        $failures += "Execution plan '$planFile' does not include any evidence signal in Validation or Artifacts sections."
    }
}

if ($env:GITHUB_OUTPUT) {
    Add-Content -Path $env:GITHUB_OUTPUT -Value "changed_files=$changedCount"
    Add-Content -Path $env:GITHUB_OUTPUT -Value "code_files=$codeFileCount"
    Add-Content -Path $env:GITHUB_OUTPUT -Value "domains=$domainCount"
    Add-Content -Path $env:GITHUB_OUTPUT -Value "requires_plan=$($requiresPlan.ToString().ToLowerInvariant())"
    Add-Content -Path $env:GITHUB_OUTPUT -Value "plan_files=$($planFiles.Count)"
    Add-Content -Path $env:GITHUB_OUTPUT -Value "failure_count=$($failures.Count)"
}

if ($failures.Count -gt 0) {
    foreach ($failure in $failures) {
        Write-Host "[FAIL] $failure"
    }

    if (-not $ReportOnly) {
        exit 1
    }
}

if ($requiresPlan -and $planFiles.Count -gt 0 -and $failures.Count -eq 0) {
    Write-Host "[PASS] Harness compliance checks passed for complex work."
} elseif (-not $requiresPlan) {
    Write-Host '[PASS] Harness plan gate not required for this change set.'
} elseif ($ReportOnly) {
    Write-Host '[WARN] Harness compliance issues reported in advisory mode.'
}