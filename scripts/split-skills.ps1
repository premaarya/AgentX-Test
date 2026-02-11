#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Splits AgentX skills using JSON plan file. Extracts sections to references/,
  adds missing sections (When to Use, Prerequisites, Troubleshooting, References).
.DESCRIPTION
  Run from repo root: pwsh ./scripts/split-skills.ps1
#>
param(
    [switch]$DryRun,
    [string]$SkillsRoot = (Join-Path $PSScriptRoot ".." ".github" "skills"),
    [string]$PlanFile = (Join-Path $PSScriptRoot "skill-plans.json")
)

$ErrorActionPreference = "Stop"

function Extract-SectionsRange {
    param([string]$Content, [string[]]$SectionNames)
    $lines = $Content -split "`n"
    $extracted = [System.Collections.ArrayList]::new()
    $remaining = [System.Collections.ArrayList]::new()
    $inTarget = $false

    foreach ($line in $lines) {
        $trimmed = $line.TrimEnd()
        if ($trimmed -match '^## (.+)$') {
            $heading = $Matches[1].Trim()
            if ($heading -in $SectionNames) {
                $inTarget = $true
                [void]$extracted.Add($line)
                continue
            }
            else {
                $inTarget = $false
                [void]$remaining.Add($line)
                continue
            }
        }
        if ($inTarget) { [void]$extracted.Add($line) }
        else { [void]$remaining.Add($line) }
    }

    return @{
        Extracted = ($extracted -join "`n")
        Remaining = ($remaining -join "`n")
    }
}

function Add-MissingSections {
    param(
        [string]$Content,
        [string[]]$WhenToUseItems,
        [string[]]$PrerequisiteItems,
        [object[]]$TroubleshootRows,
        [string[]]$ReferenceLinks
    )

    $lines = $Content -split "`n"
    $hasWhenToUse = $Content -match '## When to Use'
    $hasPrereqs = $Content -match '## Prerequisites'
    $hasTrouble = $Content -match '## Troubleshooting'
    $hasRefs = $Content -match '## References'

    # Find first ## heading after frontmatter
    $insertIdx = -1
    $inFM = $false
    $fmEnded = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $l = $lines[$i].TrimEnd()
        if ($l -eq '---' -and -not $fmEnded) {
            if ($inFM) { $fmEnded = $true } else { $inFM = $true }
            continue
        }
        if ($fmEnded -and $l -match '^## ') {
            $insertIdx = $i
            break
        }
    }
    if ($insertIdx -eq -1) { $insertIdx = $lines.Count }

    $newTop = [System.Collections.ArrayList]::new()
    if (-not $hasWhenToUse -and $WhenToUseItems.Count -gt 0) {
        [void]$newTop.Add('## When to Use This Skill')
        [void]$newTop.Add('')
        foreach ($item in $WhenToUseItems) { [void]$newTop.Add("- $item") }
        [void]$newTop.Add('')
    }
    if (-not $hasPrereqs -and $PrerequisiteItems.Count -gt 0) {
        [void]$newTop.Add('## Prerequisites')
        [void]$newTop.Add('')
        foreach ($item in $PrerequisiteItems) { [void]$newTop.Add("- $item") }
        [void]$newTop.Add('')
    }

    if ($newTop.Count -gt 0) {
        $before = @($lines[0..($insertIdx - 1)])
        $after = @($lines[$insertIdx..($lines.Count - 1)])
        $lines = $before + @($newTop.ToArray()) + $after
    }

    # Append troubleshooting + references at end
    $endSections = [System.Collections.ArrayList]::new()
    if (-not $hasTrouble -and $TroubleshootRows.Count -gt 0) {
        [void]$endSections.Add('')
        [void]$endSections.Add('## Troubleshooting')
        [void]$endSections.Add('')
        [void]$endSections.Add('| Issue | Solution |')
        [void]$endSections.Add('|-------|----------|')
        foreach ($row in $TroubleshootRows) {
            [void]$endSections.Add("| $($row.issue) | $($row.solution) |")
        }
    }
    if (-not $hasRefs -and $ReferenceLinks.Count -gt 0) {
        [void]$endSections.Add('')
        [void]$endSections.Add('## References')
        [void]$endSections.Add('')
        foreach ($link in $ReferenceLinks) {
            $name = [System.IO.Path]::GetFileNameWithoutExtension($link) -replace '-', ' '
            $name = (Get-Culture).TextInfo.ToTitleCase($name)
            [void]$endSections.Add("- [$name]($link)")
        }
    }

    if ($endSections.Count -gt 0) {
        $lines = $lines + @($endSections.ToArray())
    }

    return ($lines -join "`n")
}

# ============================================================================
# MAIN
# ============================================================================

$plans = Get-Content $PlanFile -Raw | ConvertFrom-Json

$processedSkills = 0
$createdFiles = 0
$skippedSkills = 0

foreach ($plan in $plans) {
    $skillDir = Join-Path $SkillsRoot $plan.path
    $skillFile = Join-Path $skillDir "SKILL.md"

    if (-not (Test-Path $skillFile)) {
        Write-Host "SKIP: $($plan.path) - SKILL.md not found" -ForegroundColor Yellow
        $skippedSkills++
        continue
    }

    $content = Get-Content $skillFile -Raw
    $originalLines = ($content -split "`n").Count

    $hasExtracts = $plan.extractSections.Count -gt 0
    $hasWhen = $plan.whenToUse.Count -gt 0
    $hasPrereqs = $plan.prerequisites.Count -gt 0
    $hasTrouble = $plan.troubleshooting.Count -gt 0

    if (-not $hasExtracts -and -not $hasWhen -and -not $hasPrereqs -and -not $hasTrouble) {
        Write-Host "SKIP: $($plan.path) - already well-structured ($originalLines lines)" -ForegroundColor DarkGray
        $skippedSkills++
        continue
    }

    Write-Host "`nProcessing: $($plan.path) ($originalLines lines)" -ForegroundColor Cyan

    $remaining = $content
    $refLinks = [System.Collections.ArrayList]::new()

    # Step 1: Extract sections to references/
    if ($hasExtracts) {
        $refsDir = Join-Path $skillDir "references"
        if (-not (Test-Path $refsDir)) {
            if (-not $DryRun) { New-Item -Path $refsDir -ItemType Directory -Force | Out-Null }
            Write-Host "  Created: references/" -ForegroundColor Green
        }

        foreach ($extract in $plan.extractSections) {
            $sectionNames = @($extract.sections)
            $result = Extract-SectionsRange -Content $remaining -SectionNames $sectionNames

            if ($result.Extracted.Trim().Length -gt 10) {
                $refContent = "# $($extract.title)`n`n$($result.Extracted.Trim())`n"
                $refPath = Join-Path $skillDir $extract.file

                if (-not $DryRun) {
                    $refDir = Split-Path $refPath -Parent
                    if (-not (Test-Path $refDir)) { New-Item -Path $refDir -ItemType Directory -Force | Out-Null }
                    Set-Content -Path $refPath -Value $refContent -NoNewline -Encoding utf8NoBOM
                }

                $remaining = $result.Remaining
                [void]$refLinks.Add($extract.file)
                $createdFiles++
                Write-Host "  Extracted: $($extract.file) ($($sectionNames -join ', '))" -ForegroundColor Green
            }
            else {
                Write-Host "  WARN: No content for $($extract.file)" -ForegroundColor Yellow
            }
        }
    }

    # Step 2: Add missing sections
    $whenItems = @($plan.whenToUse)
    $prereqItems = @($plan.prerequisites)
    $troubleItems = @($plan.troubleshooting)
    $refLinkArray = @($refLinks.ToArray())

    if ($whenItems.Count -gt 0 -or $prereqItems.Count -gt 0 -or $troubleItems.Count -gt 0 -or $refLinkArray.Count -gt 0) {
        $remaining = Add-MissingSections `
            -Content $remaining `
            -WhenToUseItems $whenItems `
            -PrerequisiteItems $prereqItems `
            -TroubleshootRows $troubleItems `
            -ReferenceLinks $refLinkArray
        Write-Host "  Added missing sections" -ForegroundColor Green
    }

    # Clean excessive blank lines
    $remaining = $remaining -replace "(\r?\n\s*){4,}", "`n`n`n"

    # Step 3: Write updated SKILL.md
    if (-not $DryRun) {
        Set-Content -Path $skillFile -Value $remaining -NoNewline -Encoding utf8NoBOM
    }

    $newLines = ($remaining -split "`n").Count
    $reduction = $originalLines - $newLines
    $status = if ($newLines -le 500) { 'OK' } else { 'OVER' }
    $color = if ($status -eq 'OK') { 'Green' } else { 'Yellow' }
    Write-Host "  Result: $originalLines -> $newLines lines ($status, -$reduction)" -ForegroundColor $color
    $processedSkills++
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Skills processed: $processedSkills" -ForegroundColor White
Write-Host "Reference files created: $createdFiles" -ForegroundColor White
Write-Host "Skills skipped (already good): $skippedSkills" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
