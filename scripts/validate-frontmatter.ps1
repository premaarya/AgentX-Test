#!/usr/bin/env pwsh
<#
.SYNOPSIS
 Validate frontmatter in AgentX instruction, agent, and skill files against JSON schemas.

.DESCRIPTION
 Parses YAML frontmatter from .instructions.md, .agent.md, and SKILL.md files,
 then validates required fields, types, and constraints. Designed for CI/CD.

.PARAMETER Path
 Root directory to scan. Defaults to repository root.

.PARAMETER Fix
 When set, reports issues but does not exit with error (advisory mode).

.EXAMPLE
 pwsh scripts/validate-frontmatter.ps1
 pwsh scripts/validate-frontmatter.ps1 -Fix
#>

param(
 [string]$Path = (Split-Path $PSScriptRoot -Parent),
 [switch]$Fix
)

$ErrorActionPreference = "Continue"
$script:errors = 0
$script:warnings = 0
$script:passed = 0

function Write-Pass($msg) { Write-Host " [PASS] $msg" -ForegroundColor Green; $script:passed++ }
function Write-Fail($msg) { Write-Host " [FAIL] $msg" -ForegroundColor Red; $script:errors++ }
function Write-Warn($msg) { Write-Host " [WARN] $msg" -ForegroundColor Yellow; $script:warnings++ }

function Get-Frontmatter([string]$FilePath) {
 $content = Get-Content $FilePath -Raw
 if ($content -match '(?s)^---\s*\n(.*?)\n---') {
 $yaml = $Matches[1]
 $result = @{}
 $lines = @($yaml -split "`n")
 for ($i = 0; $i -lt $lines.Count; $i++) {
 $line = $lines[$i].TrimEnd("`r")
 $trimmed = $line.Trim()
 if ($trimmed -match '^(\w[\w-]*):\s*(.+)$') {
 $key = $Matches[1]
 $rawValue = $Matches[2].Trim()

 if ($rawValue -in @('>-', '|-', '>', '|')) {
 $parts = @()
 while (($i + 1) -lt $lines.Count) {
 $nextLine = $lines[$i + 1].TrimEnd("`r")
 if ($nextLine -match '^\S') { break }
 $i++
 $parts += $nextLine.Trim()
 }
 $result[$key] = (($parts -join ' ').Trim().Trim("'").Trim('"'))
 continue
 }

 $value = $rawValue.Trim("'").Trim('"')
 $result[$key] = $value
 }
 }
 return $result
 }
 return $null
}

function Test-InstructionFile([string]$FilePath) {
 $name = Split-Path $FilePath -Leaf
 $fm = Get-Frontmatter $FilePath

 if (-not $fm) {
 Write-Fail "$name : Missing frontmatter (no --- delimiters). FIX: Add YAML frontmatter at the top of the file between --- delimiters. Example: --- description: 'Your description here' applyTo: '**.py' --- See .github/instructions/python.instructions.md for a working example."
 return
 }

 # Required: description
 if (-not $fm["description"]) {
 Write-Fail "$name : Missing required field 'description'. FIX: Add a 'description:' field to the YAML frontmatter block. This tells agents when to load this instruction. Example: description: 'Python coding instructions for production code.'"
 } elseif ($fm["description"].Length -lt 10) {
 Write-Fail "$name : description too short (min 10 chars, got $($fm['description'].Length)). FIX: Expand the description to explain when this instruction should be loaded. Example: description: 'Python specific coding instructions for production code.'"
 } else {
 Write-Pass "$name : description OK ($($fm['description'].Length) chars)"
 }

 # Required: applyTo
 if (-not $fm["applyTo"]) {
 Write-Fail "$name : Missing required field 'applyTo'. FIX: Add an 'applyTo:' field with a glob pattern specifying which files trigger this instruction. Example: applyTo: '**.py, **.pyx'"
 } else {
 Write-Pass "$name : applyTo OK ($($fm['applyTo']))"
 }
}

function Test-AgentFile([string]$FilePath) {
 $name = Split-Path $FilePath -Leaf
 $fm = Get-Frontmatter $FilePath

 if (-not $fm) {
 Write-Fail "$name : Missing frontmatter. FIX: Add YAML frontmatter at the top of the file between --- delimiters. Required fields: description, model. See .github/agents/engineer.agent.md for a working example."
 return
 }

 # Required: description
 if (-not $fm["description"]) {
 Write-Fail "$name : Missing required field 'description'. FIX: Add a 'description:' field to the YAML frontmatter. This tells Agent X what this agent does. Example: description: 'Implements code with tests and documentation.'"
 } elseif ($fm["description"].Length -lt 10) {
 Write-Fail "$name : description too short (min 10 chars). FIX: Expand the description to summarize the agent's purpose. Example: description: 'Implements production code with 80% test coverage.'"
 } else {
 Write-Pass "$name : description OK"
 }

 # Recommended: model
 if (-not $fm["model"]) {
 Write-Warn "$name : Missing recommended field 'model'. FIX: Add a 'model:' field like 'model: gpt-4o' to specify the preferred LLM for this agent."
 } else {
 Write-Pass "$name : model OK ($($fm['model']))"
 }

 # Optional: name (display name for UI)
 if ($fm.ContainsKey("name") -and $fm["name"].Length -lt 2) {
 Write-Fail "$name : name too short (min 2 chars). FIX: Use a descriptive display name like 'name: Engineer' or remove the field entirely (filename is used by default)."
 } elseif ($fm.ContainsKey("name")) {
 Write-Pass "$name : name OK ($($fm['name']))"
 }
}

function Test-SkillFile([string]$FilePath) {
 $name = (Split-Path (Split-Path $FilePath -Parent) -Leaf)
 $fm = Get-Frontmatter $FilePath

 if (-not $fm) {
 Write-Fail "skill/$name : Missing frontmatter. FIX: Add YAML frontmatter at the top of SKILL.md between --- delimiters. Required fields: name (kebab-case), description (50+ chars). See .github/skills/development/testing/SKILL.md for a working example."
 return
 }

 # Required: name
 if (-not $fm["name"]) {
 Write-Fail "skill/$name : Missing required field 'name'. FIX: Add 'name: $name' to the YAML frontmatter. The name must be lowercase with hyphens (kebab-case)."
 } elseif ($fm["name"] -notmatch '^[a-z][a-z0-9-]*$') {
 Write-Fail "skill/$name : name '$($fm['name'])' must be kebab-case. FIX: Change to lowercase letters and hyphens only. Example: 'name: $($fm['name'].ToLower() -replace '[^a-z0-9]','-')'"
 } else {
 Write-Pass "skill/$name : name OK ($($fm['name']))"
 }

 # Required: description
 if (-not $fm["description"]) {
 Write-Fail "skill/$name : Missing required field 'description'. FIX: Add a 'description:' field (50+ chars) explaining when to use this skill. Start with a verb: 'Apply testing strategies including...'"
 } elseif ($fm["description"].Length -lt 50) {
 Write-Fail "skill/$name : description too short (min 50 chars, got $($fm['description'].Length)). FIX: Expand the description to at least 50 characters. Include trigger phrases for when agents should load this skill."
 } else {
 Write-Pass "skill/$name : description OK ($($fm['description'].Length) chars)"
 }
}

# -- Main ------------------------------------------------

Write-Host ""
Write-Host " AgentX Frontmatter Validation" -ForegroundColor Cyan
Write-Host " ============================================" -ForegroundColor DarkGray
Write-Host ""

# Instructions
Write-Host " Instructions:" -ForegroundColor White
$instructions = Get-ChildItem -Path "$Path/.github/instructions" -Filter "*.instructions.md" -ErrorAction SilentlyContinue
foreach ($f in $instructions) { Test-InstructionFile $f.FullName }

# Agents
Write-Host ""
Write-Host " Agents:" -ForegroundColor White
$agents = Get-ChildItem -Path "$Path/.github/agents" -Filter "*.agent.md" -ErrorAction SilentlyContinue
foreach ($f in $agents) { Test-AgentFile $f.FullName }
$internalAgents = Get-ChildItem -Path "$Path/.github/agents/internal" -Filter "*.agent.md" -ErrorAction SilentlyContinue
foreach ($f in $internalAgents) { Test-AgentFile $f.FullName }

# Skills
Write-Host ""
Write-Host " Skills:" -ForegroundColor White
$skills = Get-ChildItem -Path "$Path/.github/skills" -Recurse -Filter "SKILL.md" -ErrorAction SilentlyContinue
foreach ($f in $skills) { Test-SkillFile $f.FullName }

# Summary
Write-Host ""
Write-Host " ============================================" -ForegroundColor DarkGray
$total = $script:passed + $script:errors + $script:warnings
Write-Host " Results: $($script:passed) passed, $($script:warnings) warnings, $($script:errors) errors (of $total checks)" -ForegroundColor $(if ($script:errors -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($script:errors -gt 0 -and -not $Fix) {
 exit 1
}
