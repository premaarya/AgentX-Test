#!/usr/bin/env pwsh
# ---------------------------------------------------------------------------
# AgentX CLI - Unified PowerShell 7 implementation (cross-platform)
# ---------------------------------------------------------------------------
# Replaces cli.mjs - runs on Windows, macOS, Linux via PowerShell 7+.
#
# Usage:
#   pwsh .agentx/agentx-cli.ps1 ready
#   pwsh .agentx/agentx-cli.ps1 issue create -t "Title" -l "type:story"
#   pwsh .agentx/agentx-cli.ps1 state -a engineer -s working -i 42
#   pwsh .agentx/agentx-cli.ps1 deps 42
#   pwsh .agentx/agentx-cli.ps1 workflow feature
#   pwsh .agentx/agentx-cli.ps1 loop start -p "Fix tests" -m 20
#   pwsh .agentx/agentx-cli.ps1 run engineer "Fix the failing tests"
#   pwsh .agentx/agentx-cli.ps1 validate 42 engineer
#   pwsh .agentx/agentx-cli.ps1 hooks install
#   pwsh .agentx/agentx-cli.ps1 digest
#   pwsh .agentx/agentx-cli.ps1 version
#   pwsh .agentx/agentx-cli.ps1 help
# ---------------------------------------------------------------------------

#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

$Script:ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Script:AGENTX_DIR = Join-Path $ROOT '.agentx'
$Script:STATE_FILE = Join-Path $AGENTX_DIR 'state' 'agent-status.json'
$Script:LOOP_STATE_FILE = Join-Path $AGENTX_DIR 'state' 'loop-state.json'
$Script:ISSUES_DIR = Join-Path $AGENTX_DIR 'issues'
$Script:DIGESTS_DIR = Join-Path $AGENTX_DIR 'digests'
$Script:CONFIG_FILE = Join-Path $AGENTX_DIR 'config.json'
$Script:VERSION_FILE = Join-Path $AGENTX_DIR 'version.json'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Read-JsonFile([string]$p) {
    if (-not (Test-Path $p)) { return $null }
    try { return Get-Content $p -Raw -Encoding utf8 | ConvertFrom-Json } catch { return $null }
}

function Write-JsonFile([string]$p, $data) {
    $parentDir = Split-Path $p -Parent
    if (-not (Test-Path $parentDir)) { New-Item -ItemType Directory -Path $parentDir -Force | Out-Null }
    $data | ConvertTo-Json -Depth 10 | Set-Content $p -Encoding utf8 -NoNewline
    # Ensure trailing newline
    Add-Content $p -Value '' -NoNewline:$false
}

# ---------------------------------------------------------------------------
# File locking helpers (cross-process atomic JSON writes)
# ---------------------------------------------------------------------------

<#
.SYNOPSIS
  Acquire an exclusive .lock file for a given JSON path.
  Returns $true on success, $false on timeout.
#>
function Lock-JsonFile([string]$jsonPath, [string]$agent = 'cli') {
    $lockPath = $jsonPath + '.lock'
    $maxRetries = 5
    $delayMs = 200
    $staleSecs = 30

    for ($i = 0; $i -lt $maxRetries; $i++) {
        # Clean stale lock.
        if (Test-Path $lockPath) {
            try {
                $lockData = Get-Content $lockPath -Raw -Encoding utf8 | ConvertFrom-Json
                $created = [datetime]$lockData.created
                if (([datetime]::UtcNow - $created).TotalSeconds -gt $staleSecs) {
                    Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
                }
            } catch {
                Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
            }
        }

        # Atomic create: FileMode.CreateNew -- fails if file already exists.
        try {
            $stream = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::CreateNew,
                [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
            $payload = '{"agent":"' + $agent + '","created":"' + [datetime]::UtcNow.ToString('o') + '"}'
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Dispose()
            return $true
        } catch [System.IO.IOException] {
            # Another process holds the lock -- wait with exponential back-off.
            Start-Sleep -Milliseconds ([int]($delayMs * [Math]::Pow(1.5, $i)))
        }
    }
    return $false
}

<#
.SYNOPSIS
  Release the .lock file for a given JSON path.
#>
function Unlock-JsonFile([string]$jsonPath) {
    $lockPath = $jsonPath + '.lock'
    Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
}

<#
.SYNOPSIS
  Run a script block with an exclusive lock on $jsonPath.
  Automatically releases on success or error.
#>
function Invoke-WithJsonLock([string]$jsonPath, [string]$agent = 'cli', [scriptblock]$fn) {
    $acquired = Lock-JsonFile $jsonPath $agent
    if (-not $acquired) { throw "Lock timeout for '$jsonPath'" }
    try {
        & $fn
    } finally {
        Unlock-JsonFile $jsonPath
    }
}

function Get-Timestamp { return (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ') }

function Get-ConfigValue($cfg, [string]$name, $default = $null) {
    if ($cfg -is [hashtable]) {
        if ($cfg.ContainsKey($name)) { return $cfg[$name] }
        return $default
    }

    if ($null -eq $cfg) { return $default }
    $prop = $cfg.PSObject.Properties[$name]
    if ($prop) { return $prop.Value }
    return $default
}

function Set-ConfigValue($cfg, [string]$name, $value) {
    if ($cfg -is [hashtable]) {
        $cfg[$name] = $value
        return
    }

    $cfg | Add-Member -NotePropertyName $name -NotePropertyValue $value -Force
}

function Get-AgentXConfig {
    $cfg = Read-JsonFile $Script:CONFIG_FILE
    if (-not $cfg) { return @{ provider = 'local'; mode = 'local' } }
    return $cfg
}

function Resolve-AgentXProviderName([string]$value) {
    $normalized = if ($value) { $value.Trim().ToLowerInvariant() } else { 'local' }
    switch ($normalized) {
        'github' { return 'github' }
        'ado' { return 'ado' }
        'azure-devops' { return 'ado' }
        'azure_devops' { return 'ado' }
        'local' { return 'local' }
        default { return 'local' }
    }
}

function Get-AgentXProvider {
    return (Get-AgentXProviderResolution).name
}

function Get-AgentXMode { return Get-AgentXProvider }

function Get-AdoOrganizationUrl {
    $cfg = Get-AgentXConfig
    $organization = [string](Get-ConfigValue $cfg 'organization' '')
    if ([string]::IsNullOrWhiteSpace($organization)) { return '' }
    if ($organization -match '^https?://') { return $organization.TrimEnd('/') }
    return "https://dev.azure.com/$($organization.Trim('/'))"
}

function Get-AdoProjectName {
    $cfg = Get-AgentXConfig
    return [string](Get-ConfigValue $cfg 'project' '')
}

function Test-CommandAvailable([string]$commandName) {
    try {
        $null = Get-Command $commandName -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Test-InteractiveConsole {
    try {
        return -not [Console]::IsInputRedirected
    } catch {
        return $false
    }
}

function Test-GitHubCliAuthenticated {
    if (-not (Test-CommandAvailable 'gh')) { return $false }
    try {
        $null = & gh auth status 2>$null
        $exitCode = if (Test-Path variable:LASTEXITCODE) { $LASTEXITCODE } else { 0 }
        return $exitCode -eq 0
    } catch {
        return $false
    }
}

$Script:ProviderInferencePrompted = $false

function Try-PersistInferredProvider([string]$provider, [string]$reason, [string]$repo = '') {
    if ($Script:ProviderInferencePrompted) { return }
    $Script:ProviderInferencePrompted = $true

    try {
        Invoke-WithJsonLock $Script:CONFIG_FILE 'cli' {
            $cfg = Get-AgentXConfig
            Set-ConfigValue $cfg 'provider' $provider
            Set-ConfigValue $cfg 'integration' $provider
            Set-ConfigValue $cfg 'mode' $provider
            if ($provider -eq 'github' -and -not [string]::IsNullOrWhiteSpace($repo)) {
                Set-ConfigValue $cfg 'repo' $repo
            }
            Write-JsonFile $Script:CONFIG_FILE $cfg
        }
        if (-not $Script:JsonOutput) {
            Write-Host "$($C.y)  [WARN] Auto-switched provider to '$provider' because $reason.$($C.n)"
        }
        if ($provider -eq 'github' -and -not [string]::IsNullOrWhiteSpace($repo)) {
            Sync-LocalBacklogToGitHubIfNeeded -Repo $repo -Reason $reason
        }
    } catch {
        if (-not $Script:JsonOutput) {
            Write-Host "$($C.y)  [WARN] Failed to persist inferred provider '$provider': $_$($C.n)"
        }
    }
}

function Get-AgentXProviderResolution {
    $cfg = Get-AgentXConfig
    $provider = Get-ConfigValue $cfg 'provider'
    $integration = Get-ConfigValue $cfg 'integration'
    $mode = Get-ConfigValue $cfg 'mode'
    $repo = [string](Get-ConfigValue $cfg 'repo' '')

    if ($provider) {
        $resolved = Resolve-AgentXProviderName "$provider"
        if ($resolved -eq 'github') {
            $repoSlug = Get-GitHubRepoSlug
            if (-not [string]::IsNullOrWhiteSpace($repoSlug) -and (Test-GitHubCliAuthenticated)) {
                Sync-LocalBacklogToGitHubIfNeeded -Repo $repoSlug -Reason 'GitHub provider is configured'
            }
        }
        return [PSCustomObject]@{ name = $resolved; source = 'provider'; inferred = $false; warning = '' }
    }

    if ($integration) {
        $resolved = Resolve-AgentXProviderName "$integration"
        if ($resolved -eq 'github') {
            $repoSlug = Get-GitHubRepoSlug
            if (-not [string]::IsNullOrWhiteSpace($repoSlug) -and (Test-GitHubCliAuthenticated)) {
                Sync-LocalBacklogToGitHubIfNeeded -Repo $repoSlug -Reason 'GitHub integration is configured'
            }
        }
        return [PSCustomObject]@{ name = $resolved; source = 'integration'; inferred = $false; warning = '' }
    }

    $repoSlug = Get-GitHubRepoSlug
    if (-not [string]::IsNullOrWhiteSpace($repoSlug) -and (Test-GitHubCliAuthenticated)) {
        $source = if (-not [string]::IsNullOrWhiteSpace($repo)) { 'repo' } else { 'remote' }
        $reason = if ($source -eq 'repo') {
            "repo '$repoSlug' is configured and GitHub CLI authentication is available"
        } else {
            "GitHub remote '$repoSlug' is configured and GitHub CLI authentication is available"
        }
        if (Resolve-AgentXProviderName "$mode" -eq 'local') {
            Try-PersistInferredProvider -provider 'github' -reason $reason -repo $repoSlug
        }
        return [PSCustomObject]@{ name = 'github'; source = $source; inferred = $true; warning = "Inferred GitHub provider because $reason." }
    }

    $resolved = Resolve-AgentXProviderName "$mode"
    return [PSCustomObject]@{ name = $resolved; source = 'mode'; inferred = $false; warning = '' }
}

function Assert-AdoCliAvailable {
    if (-not (Test-CommandAvailable 'az')) {
        throw 'Azure CLI is required for ADO provider support. Install Azure CLI and the azure-devops extension.'
    }
}

function Get-AgentXProviderInfo {
    $providerResolution = Get-AgentXProviderResolution
    $provider = $providerResolution.name
    return [PSCustomObject]@{
        name = $provider
        source = $providerResolution.source
        inferred = $providerResolution.inferred
        warning = $providerResolution.warning
        readyUsesExplicitReadyState = ($provider -eq 'local')
        validationHost = if ($provider -eq 'github') { 'github-actions' } elseif ($provider -eq 'ado') { 'azure-pipelines' } else { 'local' }
    }
}

function Get-LocalBacklogIssues {
    if ((Get-PersistenceMode) -eq 'git') {
        $files = Get-GitFileList 'issues'
        return @($files | Where-Object { $_ -match '\.json$' } | ForEach-Object {
            Read-GitJson "issues/$_"
        } | Where-Object { $_ } | Sort-Object -Property number)
    }

    if (-not (Test-Path $Script:ISSUES_DIR)) { return @() }
    return @(Get-ChildItem $Script:ISSUES_DIR -Filter '*.json' |
        ForEach-Object { Read-JsonFile $_.FullName } |
        Where-Object { $_ } |
        Sort-Object -Property number)
}

function Get-BacklogSyncStatus($issue) {
    if ($issue.state -eq 'closed') { return 'Done' }
    if (-not [string]::IsNullOrWhiteSpace([string]$issue.status)) { return [string]$issue.status }
    return 'Backlog'
}

function Get-GitHubBacklogSyncState($cfg, [string]$repo) {
    $rawState = Get-ConfigValue $cfg 'githubBacklogSync'
    $issueMap = @{}
    if ($rawState) {
        $rawMap = Get-ConfigValue $rawState 'issueMap'
        if ($rawMap -is [hashtable]) {
            foreach ($entry in $rawMap.GetEnumerator()) {
                $issueMap[[string]$entry.Key] = [int]$entry.Value
            }
        } elseif ($rawMap) {
            foreach ($property in $rawMap.PSObject.Properties) {
                $issueMap[[string]$property.Name] = [int]$property.Value
            }
        }
    }

    $stateRepo = [string](Get-ConfigValue $rawState 'repo' '')
    if ($stateRepo -and $repo -and $stateRepo -ne $repo) {
        $issueMap = @{}
        $rawState = $null
        $stateRepo = ''
    }

    return [PSCustomObject]@{
        repo = if ($stateRepo) { $stateRepo } else { $repo }
        completed = [bool](Get-ConfigValue $rawState 'completed' $false)
        issueMap = $issueMap
        migratedAt = [string](Get-ConfigValue $rawState 'migratedAt' '')
    }
}

function Save-GitHubBacklogSyncState($cfg, [string]$repo, [hashtable]$issueMap, [bool]$completed) {
    $syncState = [PSCustomObject]@{
        repo = $repo
        completed = $completed
        issueMap = $issueMap
        migratedAt = if ($completed) { Get-Timestamp } else { '' }
    }
    Set-ConfigValue $cfg 'githubBacklogSync' $syncState
}

function Sync-LocalIssueCommentsToGitHub($localIssue, $remoteIssue, [int]$remoteIssueNumber) {
    $remoteCommentBodies = @{}
    foreach ($remoteComment in @($remoteIssue.comments)) {
        $body = [string](Get-ConfigValue $remoteComment 'body' '')
        if (-not [string]::IsNullOrWhiteSpace($body)) {
            $remoteCommentBodies[$body] = $true
        }
    }

    $syncStatus = Get-BacklogSyncStatus $localIssue
    $migrationSummary = "[AgentX migration] Migrated from local issue #$($localIssue.number). Original status: $syncStatus. Original state: $($localIssue.state)."
    if (-not $remoteCommentBodies.ContainsKey($migrationSummary)) {
        $null = Invoke-GitHubCli @('issue', 'comment', "$remoteIssueNumber", '--body', $migrationSummary) "Failed to write migration summary for GitHub issue #$remoteIssueNumber." -AllowEmptyOutput
        $remoteCommentBodies[$migrationSummary] = $true
    }

    foreach ($comment in @($localIssue.comments)) {
        $commentBody = [string](Get-ConfigValue $comment 'body' '')
        if ([string]::IsNullOrWhiteSpace($commentBody)) { continue }
        $createdAt = [string](Get-ConfigValue $comment 'created' '')
        $prefix = if ($createdAt) {
            "[Migrated local comment from $createdAt]"
        } else {
            '[Migrated local comment]'
        }
        $formattedBody = "$prefix`n$commentBody"
        if ($remoteCommentBodies.ContainsKey($formattedBody)) { continue }
        $null = Invoke-GitHubCli @('issue', 'comment', "$remoteIssueNumber", '--body', $formattedBody) "Failed to migrate a comment for GitHub issue #$remoteIssueNumber." -AllowEmptyOutput
        $remoteCommentBodies[$formattedBody] = $true
    }
}

function Sync-LocalIssueToGitHub($localIssue, [int]$remoteIssueNumber) {
    $remoteIssue = Get-GitHubIssue $remoteIssueNumber
    if (-not $remoteIssue) { return $false }

    $editArgs = @('issue', 'edit', "$remoteIssueNumber")
    $hasEdit = $false
    if ($remoteIssue.title -ne $localIssue.title) {
        $editArgs += @('--title', $localIssue.title)
        $hasEdit = $true
    }

    $localBody = if ($localIssue.body) { [string]$localIssue.body } else { '' }
    $remoteBody = if ($remoteIssue.body) { [string]$remoteIssue.body } else { '' }
    if ($remoteBody -ne $localBody) {
        $editArgs += @('--body', $localBody)
        $hasEdit = $true
    }

    $localLabels = @($localIssue.labels | ForEach-Object { [string]$_ } | Where-Object { $_ })
    $remoteLabels = @($remoteIssue.labels | ForEach-Object { [string]$_ } | Where-Object { $_ })
    foreach ($label in ($localLabels | Where-Object { $_ -notin $remoteLabels })) {
        $editArgs += @('--add-label', $label)
        $hasEdit = $true
    }
    foreach ($label in ($remoteLabels | Where-Object { $_ -notin $localLabels })) {
        $editArgs += @('--remove-label', $label)
        $hasEdit = $true
    }

    if ($hasEdit) {
        $null = Invoke-GitHubCli $editArgs "Failed to update migrated GitHub issue #$remoteIssueNumber." -AllowEmptyOutput
        $remoteIssue = Get-GitHubIssue $remoteIssueNumber
        if (-not $remoteIssue) { return $false }
    }

    Sync-LocalIssueCommentsToGitHub $localIssue $remoteIssue $remoteIssueNumber

    $syncStatus = Get-BacklogSyncStatus $localIssue
    if ($localIssue.state -eq 'closed') {
        if ($remoteIssue.state -ne 'closed') {
            $null = Invoke-GitHubCli @('issue', 'close', "$remoteIssueNumber", '--reason', 'completed') "Failed to close migrated GitHub issue #$remoteIssueNumber." -AllowEmptyOutput
        }
        if (Test-GitHubProjectConfigured) {
            $null = Set-GitHubProjectIssueStatus $remoteIssueNumber 'Done' $true
        }
        return $true
    }

    if ($remoteIssue.state -eq 'closed') {
        $null = Invoke-GitHubCli @('issue', 'reopen', "$remoteIssueNumber") "Failed to reopen migrated GitHub issue #$remoteIssueNumber." -AllowEmptyOutput
    }
    if (Test-GitHubProjectConfigured) {
        $null = Set-GitHubProjectIssueStatus $remoteIssueNumber $syncStatus $true
    }
    return $true
}

function Create-GitHubIssueFromLocalIssue($localIssue, [string]$localIssueNumber) {
    $createArgs = @('issue', 'create', '--title', $localIssue.title)
    if ($localIssue.body) { $createArgs += @('--body', $localIssue.body) }
    foreach ($label in @($localIssue.labels)) {
        if ($label) { $createArgs += @('--label', [string]$label) }
    }

    $createResult = Invoke-GitHubCli $createArgs "Failed to migrate local issue #$localIssueNumber to GitHub."
    $createText = ($createResult | Out-String).Trim()
    if ($createText -notmatch '/issues/(\d+)') {
        throw "GitHub migration created local issue #$localIssueNumber but could not determine the remote issue number."
    }

    return [int]$Matches[1]
}

function Sync-LocalBacklogToGitHubIfNeeded([string]$Repo, [string]$Reason, [switch]$Force) {
    if ([string]::IsNullOrWhiteSpace($Repo) -or -not (Test-GitHubCliAuthenticated)) { return }

    $localIssues = @(Get-LocalBacklogIssues)
    Invoke-WithJsonLock $Script:CONFIG_FILE 'cli' {
        $cfg = Get-AgentXConfig
        $syncState = Get-GitHubBacklogSyncState $cfg $Repo
        Set-ConfigValue $cfg 'provider' 'github'
        Set-ConfigValue $cfg 'integration' 'github'
        Set-ConfigValue $cfg 'mode' 'github'
        Set-ConfigValue $cfg 'repo' $Repo
        if (-not $syncState.completed) {
            Save-GitHubBacklogSyncState $cfg $Repo $syncState.issueMap $false
        }
        Write-JsonFile $Script:CONFIG_FILE $cfg
    }

    $cfg = Get-AgentXConfig
    $syncState = Get-GitHubBacklogSyncState $cfg $Repo
    if ($syncState.completed -and -not $Force) { return }

    if ($localIssues.Count -eq 0) {
        Invoke-WithJsonLock $Script:CONFIG_FILE 'cli' {
            $lockedCfg = Get-AgentXConfig
            Save-GitHubBacklogSyncState $lockedCfg $Repo $syncState.issueMap $true
            Write-JsonFile $Script:CONFIG_FILE $lockedCfg
        }
        return
    }

    $migratedCount = 0
    $syncedCount = 0
    foreach ($issue in $localIssues) {
        $localIssueNumber = [string]$issue.number
        if ($syncState.issueMap.ContainsKey($localIssueNumber)) {
            $remoteIssueNumber = [int]$syncState.issueMap[$localIssueNumber]
            if (-not (Sync-LocalIssueToGitHub $issue $remoteIssueNumber)) {
                $remoteIssueNumber = Create-GitHubIssueFromLocalIssue $issue $localIssueNumber
                $syncState.issueMap[$localIssueNumber] = $remoteIssueNumber
                $migratedCount++
            } else {
                $syncedCount++
                continue
            }
        } else {
            $remoteIssueNumber = Create-GitHubIssueFromLocalIssue $issue $localIssueNumber
            $syncState.issueMap[$localIssueNumber] = $remoteIssueNumber
            $migratedCount++
        }

        $null = Sync-LocalIssueToGitHub $issue $remoteIssueNumber

        Invoke-WithJsonLock $Script:CONFIG_FILE 'cli' {
            $lockedCfg = Get-AgentXConfig
            Save-GitHubBacklogSyncState $lockedCfg $Repo $syncState.issueMap $false
            Write-JsonFile $Script:CONFIG_FILE $lockedCfg
        }
    }

    Invoke-WithJsonLock $Script:CONFIG_FILE 'cli' {
        $lockedCfg = Get-AgentXConfig
        Save-GitHubBacklogSyncState $lockedCfg $Repo $syncState.issueMap $true
        Write-JsonFile $Script:CONFIG_FILE $lockedCfg
    }

    if (-not $Script:JsonOutput -and ($migratedCount -gt 0 -or $syncedCount -gt 0)) {
        Write-Host "$($C.g)  Synced local backlog to GitHub for $Repo. Created: $migratedCount, refreshed: $syncedCount.$($C.n)"
    }
}

# ---------------------------------------------------------------------------
# Git-backed persistence helpers
# ---------------------------------------------------------------------------
# When config.persistence = 'git', issues and memory are stored on a Git
# orphan branch (agentx/data) using low-level plumbing commands. The working
# tree and real index are never touched.
# ---------------------------------------------------------------------------

$Script:DATA_BRANCH = 'agentx/data'
$Script:EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf899d15f3277a76d'

function Get-PersistenceMode {
    $cfg = Get-AgentXConfig
    if ($cfg -is [hashtable]) { return $cfg['persistence'] ?? 'file' }
    $p = $cfg.PSObject.Properties['persistence']
    if ($p) { return $p.Value }
    return 'file'
}

function Test-GitDataBranch {
    try {
        $null = & git -C $Script:ROOT rev-parse --verify "refs/heads/$Script:DATA_BRANCH" 2>$null
        return $LASTEXITCODE -eq 0
    } catch { return $false }
}

function Initialize-GitDataBranch {
    if (Test-GitDataBranch) { return }
    try {
        $commitHash = (& git -C $Script:ROOT commit-tree $Script:EMPTY_TREE_HASH -m 'Initialize agentx data branch' 2>$null).Trim()
        & git -C $Script:ROOT update-ref "refs/heads/$Script:DATA_BRANCH" $commitHash 2>$null
    } catch {
        throw "Failed to initialize Git data branch: $_"
    }
}

function Read-GitFile([string]$filePath) {
    $normalized = $filePath -replace '\\', '/'
    try {
        $content = & git -C $Script:ROOT show "${Script:DATA_BRANCH}:${normalized}" 2>$null
        if ($LASTEXITCODE -ne 0) { return $null }
        return ($content -join "`n")
    } catch { return $null }
}

function Read-GitJson([string]$filePath) {
    $raw = Read-GitFile $filePath
    if (-not $raw) { return $null }
    try { return $raw | ConvertFrom-Json } catch { return $null }
}

function Write-GitFiles([array]$entries, [string]$message) {
    Initialize-GitDataBranch
    $gitDir = (& git -C $Script:ROOT rev-parse --git-dir 2>$null).Trim()
    if (-not [System.IO.Path]::IsPathRooted($gitDir)) {
        $gitDir = Join-Path $Script:ROOT $gitDir
    }
    $rand = [System.IO.Path]::GetRandomFileName() -replace '\.', ''
    $tmpIndex = Join-Path $gitDir "agentx-tmp-index-$rand"
    $savedIndex = $env:GIT_INDEX_FILE

    try {
        $env:GIT_INDEX_FILE = $tmpIndex

        # Read current tree into temp index
        if (Test-GitDataBranch) {
            & git -C $Script:ROOT read-tree $Script:DATA_BRANCH 2>$null
        }

        # Hash each file and add to temp index
        foreach ($entry in $entries) {
            $normalized = $entry.filePath -replace '\\', '/'
            $blobHash = ($entry.content | & git -C $Script:ROOT hash-object -w --stdin 2>$null).Trim()
            & git -C $Script:ROOT update-index --add --cacheinfo "100644,$blobHash,$normalized" 2>$null
        }

        # Write tree from temp index
        $treeHash = (& git -C $Script:ROOT write-tree 2>$null).Trim()

        # Get parent commit
        $parentArgs = @()
        try {
            $parent = (& git -C $Script:ROOT rev-parse $Script:DATA_BRANCH 2>$null).Trim()
            if ($parent) { $parentArgs = @('-p', $parent) }
        } catch {}

        # Create commit
        $commitHash = (& git -C $Script:ROOT commit-tree $treeHash @parentArgs -m $message 2>$null).Trim()

        # Update branch ref
        & git -C $Script:ROOT update-ref "refs/heads/$Script:DATA_BRANCH" $commitHash 2>$null

        return $commitHash
    } finally {
        if ($savedIndex) { $env:GIT_INDEX_FILE = $savedIndex }
        else { Remove-Item Env:GIT_INDEX_FILE -ErrorAction SilentlyContinue }
        Remove-Item $tmpIndex -Force -ErrorAction SilentlyContinue
    }
}

function Write-GitFile([string]$filePath, [string]$content, [string]$message) {
    return Write-GitFiles @(@{ filePath = $filePath; content = $content }) $message
}

function Write-GitJson([string]$filePath, $data, [string]$message) {
    $json = ($data | ConvertTo-Json -Depth 10) + "`n"
    return Write-GitFile $filePath $json $message
}

function Remove-GitFile([string]$filePath, [string]$message) {
    if (-not (Test-GitDataBranch)) { return $null }
    $gitDir = (& git -C $Script:ROOT rev-parse --git-dir 2>$null).Trim()
    if (-not [System.IO.Path]::IsPathRooted($gitDir)) {
        $gitDir = Join-Path $Script:ROOT $gitDir
    }
    $rand = [System.IO.Path]::GetRandomFileName() -replace '\.', ''
    $tmpIndex = Join-Path $gitDir "agentx-tmp-index-$rand"
    $savedIndex = $env:GIT_INDEX_FILE

    try {
        $env:GIT_INDEX_FILE = $tmpIndex
        & git -C $Script:ROOT read-tree $Script:DATA_BRANCH 2>$null
        $normalized = $filePath -replace '\\', '/'
        & git -C $Script:ROOT update-index --force-remove $normalized 2>$null
        $treeHash = (& git -C $Script:ROOT write-tree 2>$null).Trim()
        $parent = (& git -C $Script:ROOT rev-parse $Script:DATA_BRANCH 2>$null).Trim()
        $commitHash = (& git -C $Script:ROOT commit-tree $treeHash -p $parent -m $message 2>$null).Trim()
        & git -C $Script:ROOT update-ref "refs/heads/$Script:DATA_BRANCH" $commitHash 2>$null
        return $commitHash
    } finally {
        if ($savedIndex) { $env:GIT_INDEX_FILE = $savedIndex }
        else { Remove-Item Env:GIT_INDEX_FILE -ErrorAction SilentlyContinue }
        Remove-Item $tmpIndex -Force -ErrorAction SilentlyContinue
    }
}

function Get-GitFileList([string]$dirPath) {
    $normalized = ($dirPath -replace '\\', '/').TrimEnd('/')
    if ($normalized) { $normalized += '/' }
    try {
        $output = & git -C $Script:ROOT ls-tree --name-only "${Script:DATA_BRANCH}" $normalized 2>$null
        if ($LASTEXITCODE -ne 0) { return @() }
        return @($output | Where-Object { $_ } | ForEach-Object {
            if ($_.StartsWith($normalized)) { $_.Substring($normalized.Length) } else { $_ }
        })
    } catch { return @() }
}

# ---------------------------------------------------------------------------
# Git Sync: Push/pull the data branch to/from remote
# ---------------------------------------------------------------------------

function Invoke-GitSyncCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'status' }
    switch ($action) {
        'push' {
            if (-not (Test-GitDataBranch)) { Write-Host "$($C.y)No data branch to push.$($C.n)"; return }
            try {
                & git -C $Script:ROOT push origin "${Script:DATA_BRANCH}:${Script:DATA_BRANCH}" 2>&1
                Write-Host "$($C.g)  Pushed data branch to origin.$($C.n)"
            } catch {
                Write-Host "$($C.r)  Push failed: $_$($C.n)"
            }
        }
        'pull' {
            try {
                & git -C $Script:ROOT fetch origin "${Script:DATA_BRANCH}:${Script:DATA_BRANCH}" 2>&1
                Write-Host "$($C.g)  Pulled data branch from origin.$($C.n)"
            } catch {
                Write-Host "$($C.r)  Pull failed: $_$($C.n)"
            }
        }
        default {
            Write-Host "`n$($C.c)  Git Data Sync$($C.n)"
            Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
            $persistence = Get-PersistenceMode
            Write-Host "  Persistence mode: $persistence"
            if (Test-GitDataBranch) {
                $lastCommit = (& git -C $Script:ROOT log -1 --format='%h %s (%ar)' $Script:DATA_BRANCH 2>$null)
                if ($lastCommit) { Write-Host "  Branch: $Script:DATA_BRANCH" ; Write-Host "  Last commit: $lastCommit" }
            } else {
                Write-Host "  No data branch found. Run 'agentx config set persistence git' to enable."
            }
            Write-Host "`n  Usage: agentx git-sync [push|pull]`n"
        }
    }
}

function Invoke-BacklogSyncCmd {
    $target = if ($Script:SubArgs.Count -gt 0 -and -not $Script:SubArgs[0].StartsWith('-')) { $Script:SubArgs[0] } else { 'github' }
    $force = Test-Flag @('--force', '-f')

    switch ($target.ToLowerInvariant()) {
        'github' {
            $repo = Get-GitHubRepoSlug
            if ([string]::IsNullOrWhiteSpace($repo)) {
                Write-Host 'Error: No GitHub repo configured or detected from origin.'
                exit 1
            }
            if (-not (Test-GitHubCliAuthenticated)) {
                Write-Host 'Error: GitHub CLI authentication is required to sync backlog to GitHub.'
                exit 1
            }
            Sync-LocalBacklogToGitHubIfNeeded -Repo $repo -Reason 'manual backlog sync request' -Force:$force
            if (-not $Script:JsonOutput) {
                Write-Host "$($C.g)  GitHub backlog sync completed for $repo.$($C.n)"
            }
        }
        default {
            Write-Host "Usage: agentx backlog-sync [github] [--force]"
            exit 1
        }
    }
}

function Invoke-Shell([string]$cmd) {
    try {
        $result = & $env:COMSPEC /c $cmd 2>$null
        if ($IsLinux -or $IsMacOS) {
            $result = bash -c $cmd 2>$null
        }
        return ($result -join "`n").Trim()
    } catch { return '' }
}

# ANSI colors (disabled when NO_COLOR env is set per https://no-color.org/)
if ($env:NO_COLOR) {
    $Script:C = @{ r = ''; g = ''; y = ''; b = ''; m = ''; c = ''; w = ''; d = ''; n = '' }
} else {
    $Script:C = @{
        r = "`e[31m"; g = "`e[32m"; y = "`e[33m"; b = "`e[34m"
        m = "`e[35m"; c = "`e[36m"; w = "`e[37m"; d = "`e[90m"; n = "`e[0m"
    }
}

# ---------------------------------------------------------------------------
# Parse CLI args
# ---------------------------------------------------------------------------

$Script:CliArgs = @($args)
$Script:Command = if ($CliArgs.Count -gt 0) { $CliArgs[0] } else { 'help' }
$Script:SubArgs = @(if ($CliArgs.Count -gt 1) { $CliArgs[1..($CliArgs.Count - 1)] } else { @() })

function Get-Flag([string[]]$flags, [string]$default = '') {
    for ($i = 0; $i -lt $Script:SubArgs.Count; $i++) {
        if ($flags -contains $Script:SubArgs[$i] -and ($i + 1) -lt $Script:SubArgs.Count) {
            return $Script:SubArgs[$i + 1]
        }
    }
    return $default
}

function Test-Flag([string[]]$flags) {
    return @($Script:SubArgs | Where-Object { $flags -contains $_ }).Count -gt 0
}

$Script:JsonOutput = Test-Flag @('--json', '-j')

# ---------------------------------------------------------------------------
# ISSUE: Local issue manager
# ---------------------------------------------------------------------------

function Invoke-IssueCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'list' }
    # Shift subargs past the action for issue subcommands
    $Script:SubArgs = @(if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1..($Script:SubArgs.Count - 1)] } else { @() })
    switch ($action) {
        'create'  { Invoke-IssueCreate }
        'update'  { Invoke-IssueUpdate }
        'close'   { Invoke-IssueClose }
        'get'     { Invoke-IssueGet }
        'comment' { Invoke-IssueComment }
        'list'    { Invoke-IssueList }
        default   { Write-Host "Unknown issue action: $action"; exit 1 }
    }
}

function Get-NextIssueNumber {
    if ((Get-PersistenceMode) -eq 'git') {
        Initialize-GitDataBranch
        $counter = Read-GitJson 'state/counter.json'
        $num = if ($counter -and $counter.PSObject.Properties['nextIssueNumber']) { $counter.nextIssueNumber } else { 1 }
        $newCounter = [PSCustomObject]@{ nextIssueNumber = ($num + 1) }
        Write-GitJson 'state/counter.json' $newCounter "state: increment issue counter to $($num + 1)"
        return $num
    }
    $cfg = Get-AgentXConfig
    $num = if ($cfg.PSObject.Properties['nextIssueNumber']) { $cfg.nextIssueNumber } else { 1 }
    $cfg | Add-Member -NotePropertyName 'nextIssueNumber' -NotePropertyValue ($num + 1) -Force
    Write-JsonFile $Script:CONFIG_FILE $cfg
    return $num
}

function Get-Issue([int]$num) {
    if ((Get-PersistenceMode) -eq 'git') {
        return Read-GitJson "issues/$num.json"
    }
    return Read-JsonFile (Join-Path $Script:ISSUES_DIR "$num.json")
}

function Convert-GitHubIssueStateToIssueState([string]$state) {
    $normalized = if ($state) { $state.Trim().ToLowerInvariant() } else { '' }
    if ($normalized -eq 'closed') { return 'closed' }
    return 'open'
}

function Convert-GitHubIssueToAgentXIssue($issue, [string]$status = '') {
    return [PSCustomObject]@{
        number = $issue.number
        title = $issue.title
        body = if ($issue.body) { $issue.body } else { '' }
        state = Convert-GitHubIssueStateToIssueState $(if ($issue.state) { [string]$issue.state } else { '' })
        url = if ($issue.url) { $issue.url } else { '' }
        labels = @(($issue.labels ?? @()) | ForEach-Object {
            if ($_ -is [string]) { $_ } else { $_.name }
        } | Where-Object { $_ })
        status = $status
        comments = @($issue.comments | ForEach-Object {
            [PSCustomObject]@{ body = $_.body; created = $_.createdAt }
        })
    }
}

function Convert-AdoStateToIssueState([string]$state) {
    $normalized = if ($state) { $state.Trim().ToLowerInvariant() } else { '' }
    if ($normalized -in @('closed', 'done', 'completed', 'removed')) { return 'closed' }
    return 'open'
}

function Convert-AdoWorkItemToAgentXIssue($item) {
    $fields = if ($item.fields) { $item.fields } else { [PSCustomObject]@{} }
    $tagsRaw = ''
    $tagsProp = $fields.PSObject.Properties['System.Tags']
    if ($tagsProp) { $tagsRaw = [string]$tagsProp.Value }
    $labels = @($tagsRaw -split ';' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    $stateProp = $fields.PSObject.Properties['System.State']
    $titleProp = $fields.PSObject.Properties['System.Title']
    $descriptionProp = $fields.PSObject.Properties['System.Description']

    return [PSCustomObject]@{
        number = [int]$item.id
        title = if ($titleProp) { [string]$titleProp.Value } else { "Work item $($item.id)" }
        body = if ($descriptionProp) { [string]$descriptionProp.Value } else { '' }
        state = Convert-AdoStateToIssueState $(if ($stateProp) { [string]$stateProp.Value } else { '' })
        labels = $labels
        status = if ($stateProp) { [string]$stateProp.Value } else { '' }
        comments = @()
    }
}

function Get-GitHubIssue([int]$num) {
    $json = & gh issue view $num --json number,title,body,state,url,labels,comments 2>$null
    if (-not $json) { return $null }
    return Convert-GitHubIssueToAgentXIssue ($json | ConvertFrom-Json)
}

function Invoke-GitHubCli([string[]]$arguments, [string]$failureMessage, [switch]$AllowEmptyOutput) {
    Assert-GitHubCliAvailable
    $repo = Get-GitHubRepoSlug
    if (-not [string]::IsNullOrWhiteSpace($repo) -and $arguments.Count -gt 0 -and $arguments[0] -eq 'issue' -and ('-R' -notin $arguments) -and ('--repo' -notin $arguments)) {
        $arguments = @($arguments[0], '-R', $repo) + @($arguments[1..($arguments.Count - 1)])
    }
    $output = & gh @arguments 2>&1
    $exitCode = if (Test-Path variable:LASTEXITCODE) { $LASTEXITCODE } else { 0 }
    $outputText = ($output | Out-String).Trim()

    if ($exitCode -ne 0) {
        if ($outputText) {
            throw "$failureMessage $outputText"
        }
        throw $failureMessage
    }

    if (-not $AllowEmptyOutput -and [string]::IsNullOrWhiteSpace($outputText)) {
        throw $failureMessage
    }

    return $output
}

function Get-GitHubRepoSlug {
    $cfg = Get-AgentXConfig
    $repo = [string](Get-ConfigValue $cfg 'repo' '')
    if (-not [string]::IsNullOrWhiteSpace($repo)) { return $repo }

    try {
        $remoteUrl = (& git -C $Script:ROOT remote get-url origin 2>$null | Out-String).Trim()
        if ($remoteUrl -match 'github\.com[:/]([^/]+/[^/.]+)') {
            return $Matches[1].Trim()
        }
    } catch { }

    return ''
}

function Get-GitHubProjectOwner {
    $cfg = Get-AgentXConfig
    $owner = [string](Get-ConfigValue $cfg 'projectOwner' '')
    if (-not [string]::IsNullOrWhiteSpace($owner)) { return $owner }

    $repo = Get-GitHubRepoSlug
    if ($repo -match '^([^/]+)/') { return $Matches[1] }
    return ''
}

function Get-GitHubProjectNumber {
    $cfg = Get-AgentXConfig
    $project = Get-ConfigValue $cfg 'project'
    if ($project -is [int]) { return $project }
    if ($project -and "$project" -match '^\d+$') { return [int]$project }
    return 0
}

function Test-GitHubProjectConfigured {
    return (Get-GitHubProjectNumber) -gt 0
}

function Resolve-GitHubProjectStatusName([string]$status) {
    $cfg = Get-AgentXConfig
    $customMap = Get-ConfigValue $cfg 'githubProjectStatusMap'
    if ($customMap) {
        if ($customMap -is [hashtable]) {
            if ($customMap.ContainsKey($status)) { return [string]$customMap[$status] }
        } else {
            $prop = $customMap.PSObject.Properties[$status]
            if ($prop) { return [string]$prop.Value }
        }
    }

    switch ($status) {
        'Backlog' { return 'Backlog' }
        'Ready' { return 'Ready' }
        'In Progress' { return 'In progress' }
        'In Review' { return 'In review' }
        'Validating' { return 'In review' }
        'Done' { return 'Done' }
        default { return $status }
    }
}

function Get-GitHubProjectView {
    $projectNumber = Get-GitHubProjectNumber
    $owner = Get-GitHubProjectOwner
    if ($projectNumber -le 0 -or [string]::IsNullOrWhiteSpace($owner)) { return $null }

    $json = & gh project view $projectNumber --owner $owner --format json 2>$null
    if (-not $json) { return $null }
    $result = $json | ConvertFrom-Json
    if ($result.PSObject.Properties['id']) { return $result }
    if ($result.PSObject.Properties['project']) { return $result.project }
    return $result
}

function Get-GitHubProjectStatusField {
    Assert-GitHubCliAvailable
    $projectNumber = Get-GitHubProjectNumber
    $owner = Get-GitHubProjectOwner
    if ($projectNumber -le 0 -or [string]::IsNullOrWhiteSpace($owner)) { return $null }

    $json = & gh project field-list $projectNumber --owner $owner --format json 2>$null
    if (-not $json) { return $null }
    $result = $json | ConvertFrom-Json
    $fields = if ($result.PSObject.Properties['fields']) { @($result.fields) } else { @($result) }
    return ($fields | Where-Object { $_.name -eq 'Status' } | Select-Object -First 1)
}

function Get-GitHubProjectIssueItem([int]$issueNumber) {
    Assert-GitHubCliAvailable
    $projectNumber = Get-GitHubProjectNumber
    $owner = Get-GitHubProjectOwner
    $repo = Get-GitHubRepoSlug
    if ($projectNumber -le 0 -or [string]::IsNullOrWhiteSpace($owner)) { return $null }

    $json = & gh project item-list $projectNumber --owner $owner --limit 500 --format json 2>$null
    if (-not $json) { return $null }
    $result = $json | ConvertFrom-Json
    $items = if ($result.PSObject.Properties['items']) { @($result.items) } else { @($result) }

    return ($items | Where-Object {
        $content = $_.content
        if (-not $content) { return $false }
        $matchesNumber = ($content.PSObject.Properties['number'] -and [int]$content.number -eq $issueNumber)
        if (-not $matchesNumber) { return $false }
        if ([string]::IsNullOrWhiteSpace($repo)) { return $true }
        return ($content.repository -eq $repo) -or ($content.url -like "*/issues/$issueNumber")
    } | Select-Object -First 1)
}

function Get-GitHubProjectIssueStatusMap {
    $map = @{}
    $projectNumber = Get-GitHubProjectNumber
    $owner = Get-GitHubProjectOwner
    $repo = Get-GitHubRepoSlug
    if ($projectNumber -le 0 -or [string]::IsNullOrWhiteSpace($owner)) { return $map }

    $json = & gh project item-list $projectNumber --owner $owner --limit 500 --format json 2>$null
    if (-not $json) { return $map }
    $result = $json | ConvertFrom-Json
    $items = if ($result.PSObject.Properties['items']) { @($result.items) } else { @($result) }

    foreach ($item in $items) {
        $content = $item.content
        if (-not $content) { continue }
        if (-not $content.PSObject.Properties['number']) { continue }
        $issueNumber = [int]$content.number
        if ($issueNumber -le 0) { continue }
        if (-not [string]::IsNullOrWhiteSpace($repo)) {
            $matchesRepo = ($content.repository -eq $repo) -or ($content.url -like "*/issues/$issueNumber")
            if (-not $matchesRepo) { continue }
        }
        $map[$issueNumber] = if ($item.PSObject.Properties['status']) { [string]$item.status } else { '' }
    }

    return $map
}

function Ensure-GitHubIssueInProject([int]$issueNumber) {
    $existing = Get-GitHubProjectIssueItem $issueNumber
    if ($existing) { return $existing }

    $projectNumber = Get-GitHubProjectNumber
    $owner = Get-GitHubProjectOwner
    $repo = Get-GitHubRepoSlug
    if ($projectNumber -le 0 -or [string]::IsNullOrWhiteSpace($owner) -or [string]::IsNullOrWhiteSpace($repo)) { return $null }

    $issueUrl = "https://github.com/$repo/issues/$issueNumber"
    try {
        $args = @('project', 'item-add', "$projectNumber", '--owner', $owner, '--url', $issueUrl)
        $null = Invoke-GitHubCli $args "Failed to add GitHub issue #$issueNumber to project $projectNumber." -AllowEmptyOutput
    } catch {
        return $null
    }
    return Get-GitHubProjectIssueItem $issueNumber
}

function Set-GitHubProjectIssueStatus([int]$issueNumber, [string]$status, [bool]$addIfMissing = $false) {
    $projectInfo = Get-GitHubProjectView
    if (-not $projectInfo) { return $false }

    $statusField = Get-GitHubProjectStatusField
    if (-not $statusField) { return $false }

    $targetStatusName = Resolve-GitHubProjectStatusName $status
    $targetOption = ($statusField.options | Where-Object { $_.name -ieq $targetStatusName } | Select-Object -First 1)
    if (-not $targetOption) { return $false }

    $item = if ($addIfMissing) { Ensure-GitHubIssueInProject $issueNumber } else { Get-GitHubProjectIssueItem $issueNumber }
    if (-not $item) { return $false }

    try {
        $args = @('project', 'item-edit', '--id', $item.id, '--project-id', $projectInfo.id, '--field-id', $statusField.id, '--single-select-option-id', $targetOption.id)
        $null = Invoke-GitHubCli $args "Failed to set GitHub project status for issue #$issueNumber." -AllowEmptyOutput
        return $true
    } catch {
        return $false
    }
}

function Get-AdoIssue([int]$num) {
    Assert-AdoCliAvailable
    $orgUrl = Get-AdoOrganizationUrl
    $project = Get-AdoProjectName
    if ([string]::IsNullOrWhiteSpace($orgUrl) -or [string]::IsNullOrWhiteSpace($project)) {
        throw 'ADO provider requires organization and project in .agentx/config.json.'
    }
    $json = & az boards work-item show --id $num --organization $orgUrl --project $project --output json 2>$null
    if (-not $json) { return $null }
    return Convert-AdoWorkItemToAgentXIssue ($json | ConvertFrom-Json)
}

function Assert-GitHubCliAvailable {
    if (-not (Test-CommandAvailable 'gh')) {
        throw 'GitHub CLI is required for GitHub provider support. Install gh and run gh auth login.'
    }
}

function ConvertTo-IssueLabels([string]$labelStr) {
    if (-not $labelStr) { return @() }
    return @(($labelStr -split ',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Get-IssueTypeFromLabels([string[]]$labels) {
    foreach ($label in @($labels)) {
        if ($label -match '^type:(.+)$') { return $Matches[1].Trim().ToLowerInvariant() }
    }
    return 'story'
}

function Convert-AgentXTypeToAdoWorkItemType([string[]]$labels) {
    switch (Get-IssueTypeFromLabels $labels) {
        'epic' { return 'Epic' }
        'feature' { return 'Feature' }
        'bug' { return 'Bug' }
        'story' { return 'User Story' }
        default { return 'Task' }
    }
}

function Convert-AgentXStatusToAdoState([string]$status) {
    $cfg = Get-AgentXConfig
    $customMap = Get-ConfigValue $cfg 'adoStateMap'
    if ($customMap) {
        if ($customMap -is [hashtable]) {
            if ($customMap.ContainsKey($status)) { return [string]$customMap[$status] }
        } else {
            $prop = $customMap.PSObject.Properties[$status]
            if ($prop) { return [string]$prop.Value }
        }
    }

    switch ($status) {
        'Backlog' { return 'New' }
        'Ready' { return 'New' }
        'In Progress' { return 'Active' }
        'In Review' { return 'Resolved' }
        'Validating' { return 'Resolved' }
        'Done' { return 'Closed' }
        default { return $status }
    }
}

function Save-Issue($issue) {
    if ((Get-PersistenceMode) -eq 'git') {
        Write-GitJson "issues/$($issue.number).json" $issue "issue: update #$($issue.number) - $($issue.title)"
        return
    }
    if (-not (Test-Path $Script:ISSUES_DIR)) { New-Item -ItemType Directory -Path $Script:ISSUES_DIR -Force | Out-Null }
    Write-JsonFile (Join-Path $Script:ISSUES_DIR "$($issue.number).json") $issue
}

function Invoke-IssueCreate {
    $provider = Get-AgentXProvider
    $title = Get-Flag @('-t', '--title')
    $body = Get-Flag @('-b', '--body')
    $labelStr = Get-Flag @('-l', '--labels')
    if (-not $title) { Write-Host 'Error: --title is required'; exit 1 }

    $labels = ConvertTo-IssueLabels $labelStr

    if ($provider -eq 'github') {
        $args = @('issue', 'create', '--title', $title)
        if ($body) { $args += @('--body', $body) }
        foreach ($label in $labels) {
            $args += @('--label', $label)
        }

        try {
            $result = Invoke-GitHubCli $args "Failed to create GitHub issue '$title'."
        } catch {
            Write-Host "Error: $($_.Exception.Message)"
            exit 1
        }
        $issueNumber = 0
        $resultText = ($result | Out-String).Trim()
        if ($resultText -match '/issues/(\d+)') {
            $issueNumber = [int]$Matches[1]
        }
        $issue = if ($issueNumber -gt 0) { Get-GitHubIssue $issueNumber } else { $null }
        if (-not $issue) {
            Write-Host "Error: GitHub issue was created but could not be read back for verification."
            exit 1
        }
        if (Test-GitHubProjectConfigured) {
            if (-not (Set-GitHubProjectIssueStatus $issue.number 'Backlog' $true)) {
                Write-Host "$($C.y)GitHub project status was not updated for issue #$($issue.number). Ensure the configured project is accessible and has a matching Status option.$($C.n)"
            }
        }
        Write-Host "$($C.g)Created issue #$($issue.number): $($issue.title)$($C.n)"
        if ($Script:JsonOutput) { $issue | ConvertTo-Json -Depth 5 }
        return
    }

    if ($provider -eq 'ado') {
        Assert-AdoCliAvailable
        $orgUrl = Get-AdoOrganizationUrl
        $project = Get-AdoProjectName
        if ([string]::IsNullOrWhiteSpace($orgUrl) -or [string]::IsNullOrWhiteSpace($project)) {
            Write-Host 'Error: ADO provider requires organization and project in .agentx/config.json'; exit 1
        }

        $workItemType = Get-Flag @('--type')
        if (-not $workItemType) { $workItemType = Convert-AgentXTypeToAdoWorkItemType $labels }

        $args = @('boards', 'work-item', 'create', '--title', $title, '--type', $workItemType, '--organization', $orgUrl, '--project', $project, '--output', 'json')
        if ($body) { $args += @('--description', $body) }
        if ($labels.Count -gt 0) { $args += @('--fields', "System.Tags=$($labels -join '; ')") }

        $json = & az @args 2>$null
        $issue = if ($json) { Convert-AdoWorkItemToAgentXIssue ($json | ConvertFrom-Json) } else { $null }
        if (-not $issue) {
            Write-Host "$($C.g)Created ADO work item: $title$($C.n)"
            return
        }
        Write-Host "$($C.g)Created issue #$($issue.number): $($issue.title)$($C.n)"
        if ($Script:JsonOutput) { $issue | ConvertTo-Json -Depth 5 }
        return
    }

    $num = Get-NextIssueNumber

    $issue = [PSCustomObject]@{
        number   = $num
        title    = $title
        body     = $body
        labels   = @($labels)
        status   = 'Backlog'
        state    = 'open'
        created  = Get-Timestamp
        updated  = Get-Timestamp
        comments = @()
    }
    Save-Issue $issue
    Write-Host "$($C.g)Created issue #${num}: ${title}$($C.n)"
    if ($Script:JsonOutput) { $issue | ConvertTo-Json -Depth 5 }
}

function Invoke-IssueUpdate {
    $provider = Get-AgentXProvider
    $num = [int](Get-Flag @('-n', '--number') '0')
    if (-not $num) { Write-Host 'Error: --number required'; exit 1 }
    $issue = if ($provider -eq 'github') { Get-GitHubIssue $num } elseif ($provider -eq 'ado') { Get-AdoIssue $num } else { Get-Issue $num }
    if (-not $issue) { Write-Host "Error: Issue #$num not found"; exit 1 }

    $title = Get-Flag @('-t', '--title')
    $body = Get-Flag @('-b', '--body')
    $status = Get-Flag @('-s', '--status')
    $labelStr = Get-Flag @('-l', '--labels')

    if ($provider -eq 'github') {
        $args = @('issue', 'edit', "$num")
        $hasEdit = $false

        if ($title) {
            $args += @('--title', $title)
            $hasEdit = $true
        }
        if ($body) {
            $args += @('--body', $body)
            $hasEdit = $true
        }
        if ($labelStr) {
            $newLabels = ConvertTo-IssueLabels $labelStr
            $existingLabels = @($issue.labels)
            foreach ($label in $newLabels | Where-Object { $_ -notin $existingLabels }) {
                $args += @('--add-label', $label)
                $hasEdit = $true
            }
            foreach ($label in $existingLabels | Where-Object { $_ -notin $newLabels }) {
                $args += @('--remove-label', $label)
                $hasEdit = $true
            }
        }

        if ($hasEdit) {
            try {
                $null = Invoke-GitHubCli $args "Failed to update GitHub issue #$num." -AllowEmptyOutput
            } catch {
                Write-Host "Error: $($_.Exception.Message)"
                exit 1
            }
        }
        if ($status) {
            if (-not (Set-GitHubProjectIssueStatus $num $status $false)) {
                if (Test-GitHubProjectConfigured) {
                    Write-Host "$($C.y)GitHub project status was not updated for issue #${num}. Ensure the issue is added to the configured project and the project has a matching Status option.$($C.n)"
                } else {
                    Write-Host "$($C.y)GitHub project status was not updated because no project number is configured. Set .agentx/config.json `project` to enable Project V2 status sync.$($C.n)"
                }
            }
        }

        $updatedIssue = Get-GitHubIssue $num
        Write-Host "$($C.g)Updated issue #${num}$($C.n)"
        if ($Script:JsonOutput) { $updatedIssue | ConvertTo-Json -Depth 5 }
        return
    }

    if ($provider -eq 'ado') {
        Assert-AdoCliAvailable
        $orgUrl = Get-AdoOrganizationUrl
        $project = Get-AdoProjectName
        $args = @('boards', 'work-item', 'update', '--id', "$num", '--organization', $orgUrl, '--project', $project, '--output', 'json')
        $hasEdit = $false

        if ($title) {
            $args += @('--title', $title)
            $hasEdit = $true
        }
        if ($body) {
            $args += @('--description', $body)
            $hasEdit = $true
        }
        if ($status) {
            $args += @('--state', (Convert-AgentXStatusToAdoState $status))
            $hasEdit = $true
        }
        if ($labelStr) {
            $labels = ConvertTo-IssueLabels $labelStr
            $args += @('--fields', "System.Tags=$($labels -join '; ')")
            $hasEdit = $true
        }

        if ($hasEdit) {
            $null = & az @args 2>$null
        }

        $updatedIssue = Get-AdoIssue $num
        Write-Host "$($C.g)Updated issue #${num}$($C.n)"
        if ($Script:JsonOutput) { $updatedIssue | ConvertTo-Json -Depth 5 }
        return
    }

    if ($title) { $issue.title = $title }
    if ($status) { $issue.status = $status }
    if ($body) { $issue.body = $body }
    if ($labelStr) { $issue.labels = @(ConvertTo-IssueLabels $labelStr) }
    $issue.updated = Get-Timestamp
    Save-Issue $issue
    Write-Host "$($C.g)Updated issue #${num}$($C.n)"
    if ($Script:JsonOutput) { $issue | ConvertTo-Json -Depth 5 }
}

function Invoke-IssueClose {
    $provider = Get-AgentXProvider
    $num = [int](Get-Flag @('-n', '--number') '')
    if (-not $num -and $Script:SubArgs.Count -gt 0) { $num = [int]$Script:SubArgs[0] }
    if (-not $num) { Write-Host 'Error: issue number required'; exit 1 }

    if ($provider -eq 'github') {
        try {
            $args = @('issue', 'close', "$num", '--reason', 'completed')
            $null = Invoke-GitHubCli $args "Failed to close GitHub issue #$num." -AllowEmptyOutput
        } catch {
            Write-Host "Error: $($_.Exception.Message)"
            exit 1
        }
        if (Test-GitHubProjectConfigured) {
            if (-not (Set-GitHubProjectIssueStatus $num 'Done' $false)) {
                Write-Host "$($C.y)GitHub issue #${num} was closed, but the configured project status could not be updated to Done.$($C.n)"
            }
        }
        Write-Host "$($C.g)Closed issue #${num}$($C.n)"
        if ($Script:JsonOutput) {
            $issue = Get-GitHubIssue $num
            if ($issue) { $issue | ConvertTo-Json -Depth 5 }
        }
        return
    }

    if ($provider -eq 'ado') {
        Assert-AdoCliAvailable
        $orgUrl = Get-AdoOrganizationUrl
        $project = Get-AdoProjectName
        $null = & az boards work-item update --id $num --state Closed --organization $orgUrl --project $project --output json 2>$null
        Write-Host "$($C.g)Closed issue #${num}$($C.n)"
        if ($Script:JsonOutput) {
            $issue = Get-AdoIssue $num
            if ($issue) { $issue | ConvertTo-Json -Depth 5 }
        }
        return
    }

    $issue = Get-Issue $num
    if (-not $issue) { Write-Host "Error: Issue #$num not found"; exit 1 }
    $issue.state = 'closed'; $issue.status = 'Done'; $issue.updated = Get-Timestamp
    Save-Issue $issue
    Write-Host "$($C.g)Closed issue #${num}$($C.n)"
}

function Invoke-IssueGet {
    $provider = Get-AgentXProvider
    $num = [int](Get-Flag @('-n', '--number') '')
    if (-not $num -and $Script:SubArgs.Count -gt 0) { $num = [int]$Script:SubArgs[0] }
    if (-not $num) { Write-Host 'Error: issue number required'; exit 1 }
    $issue = if ($provider -eq 'github') { Get-GitHubIssue $num } elseif ($provider -eq 'ado') { Get-AdoIssue $num } else { Get-Issue $num }
    if (-not $issue) { Write-Host "Error: Issue #$num not found"; exit 1 }
    $issue | ConvertTo-Json -Depth 5
}

function Invoke-IssueComment {
    $provider = Get-AgentXProvider
    $num = [int](Get-Flag @('-n', '--number') '0')
    $body = Get-Flag @('-c', '--comment', '-b', '--body')
    if (-not $num -or -not $body) { Write-Host 'Error: --number and --comment required'; exit 1 }

    if ($provider -eq 'github') {
        try {
            $args = @('issue', 'comment', "$num", '--body', $body)
            $null = Invoke-GitHubCli $args "Failed to add a comment to GitHub issue #$num." -AllowEmptyOutput
        } catch {
            Write-Host "Error: $($_.Exception.Message)"
            exit 1
        }
        Write-Host "$($C.g)Added comment to issue #${num}$($C.n)"
        if ($Script:JsonOutput) {
            $issue = Get-GitHubIssue $num
            if ($issue) { $issue | ConvertTo-Json -Depth 5 }
        }
        return
    }

    if ($provider -eq 'ado') {
        Assert-AdoCliAvailable
        $orgUrl = Get-AdoOrganizationUrl
        $project = Get-AdoProjectName
        $null = & az boards work-item update --id $num --discussion $body --organization $orgUrl --project $project --output json 2>$null
        Write-Host "$($C.g)Added comment to issue #${num}$($C.n)"
        if ($Script:JsonOutput) {
            $issue = Get-AdoIssue $num
            if ($issue) { $issue | ConvertTo-Json -Depth 5 }
        }
        return
    }

    $issue = Get-Issue $num
    if (-not $issue) { Write-Host "Error: Issue #$num not found"; exit 1 }
    $comment = [PSCustomObject]@{ body = $body; created = Get-Timestamp }
    $issue.comments = @($issue.comments) + @($comment)
    $issue.updated = Get-Timestamp
    Save-Issue $issue
    Write-Host "$($C.g)Added comment to issue #${num}$($C.n)"
}

function Invoke-IssueList {
    $issues = @(Get-AllIssues | Sort-Object -Property number -Descending)

    if ($Script:JsonOutput) { $issues | ConvertTo-Json -Depth 5; return }
    if ($issues.Count -eq 0) { Write-Host "$($C.y)No issues found.$($C.n)"; return }

    Write-Host "`n$($C.c)Issues [$((Get-AgentXProviderInfo).name)]:$($C.n)"
    Write-Host "$($C.c)===========================================================$($C.n)"
    foreach ($i in $issues) {
        $icon = if ($i.state -eq 'open') { '( )' } else { '(*)' }
        $labels = if ($i.labels -and $i.labels.Count -gt 0) { " [$($i.labels -join ', ')]" } else { '' }
        Write-Host "$icon #$($i.number) $($i.status) - $($i.title)$labels"
    }
    Write-Host "$($C.c)===========================================================$($C.n)"
}

# ---------------------------------------------------------------------------
# READY: Show unblocked work
# ---------------------------------------------------------------------------

function Get-AllIssues {
    $provider = Get-AgentXProvider
    if ($provider -eq 'github') {
        try {
            $json = & gh issue list --state all --json number,title,labels,body,state --limit 200 2>$null
            if ($json) {
                $raw = $json | ConvertFrom-Json
                $statusByIssue = if (Test-GitHubProjectConfigured) { Get-GitHubProjectIssueStatusMap } else { @{} }
                return @($raw | ForEach-Object {
                    $status = ''
                    $issueNumber = [int]$_.number
                    if ($statusByIssue.ContainsKey($issueNumber)) {
                        $status = [string]$statusByIssue[$issueNumber]
                    }
                    Convert-GitHubIssueToAgentXIssue $_ $status
                })
            }
        } catch { <# fall through to local #> }
    }
    if ($provider -eq 'ado') {
        try {
            Assert-AdoCliAvailable
            $orgUrl = Get-AdoOrganizationUrl
            $project = Get-AdoProjectName
            if (-not [string]::IsNullOrWhiteSpace($orgUrl) -and -not [string]::IsNullOrWhiteSpace($project)) {
                $wiql = "Select [System.Id] From WorkItems Where [System.TeamProject] = '$project' Order By [System.ChangedDate] Desc"
                $json = & az boards query --wiql $wiql --organization $orgUrl --project $project --output json 2>$null
                if ($json) {
                    $queryResult = $json | ConvertFrom-Json
                    $refs = @()
                    if ($queryResult.workItems) { $refs = @($queryResult.workItems) }
                    elseif ($queryResult.value) { $refs = @($queryResult.value) }
                    else { $refs = @($queryResult) }

                    $issues = @()
                    foreach ($ref in ($refs | Select-Object -First 200)) {
                        $workItemId = if ($ref.id) { [int]$ref.id } elseif ($ref.fields.'System.Id') { [int]$ref.fields.'System.Id' } else { 0 }
                        if ($workItemId -le 0) { continue }
                        $issue = Get-AdoIssue $workItemId
                        if ($issue) { $issues += $issue }
                    }
                    if ($issues.Count -gt 0) { return $issues }
                }
            }
        } catch { <# fall through to local #> }
    }
    # Git-backed persistence
    if ((Get-PersistenceMode) -eq 'git') {
        $files = Get-GitFileList 'issues'
        return @($files | Where-Object { $_ -match '\.json$' } | ForEach-Object {
            Read-GitJson "issues/$_"
        } | Where-Object { $_ })
    }
    # File-based persistence (default)
    if (-not (Test-Path $Script:ISSUES_DIR)) { return @() }
    return @(Get-ChildItem $Script:ISSUES_DIR -Filter '*.json' |
        ForEach-Object { Read-JsonFile $_.FullName } | Where-Object { $_ })
}

function Get-IssueDeps($issue) {
    $deps = @{ blocks = @(); blocked_by = @() }
    if (-not $issue.body) { return $deps }
    $inDeps = $false
    foreach ($line in ($issue.body -split "`n")) {
        if ($line -match '^\s*##\s*Dependencies') { $inDeps = $true; continue }
        if ($line -match '^\s*##\s' -and $inDeps) { break }
        if (-not $inDeps) { continue }
        if ($line -match '^\s*-?\s*Blocks:\s*(.+)') {
            $deps.blocks = @([regex]::Matches($Matches[1], '#(\d+)') | ForEach-Object { [int]$_.Groups[1].Value })
        }
        if ($line -match '^\s*-?\s*Blocked[- ]by:\s*(.+)') {
            $deps.blocked_by = @([regex]::Matches($Matches[1], '#(\d+)') | ForEach-Object { [int]$_.Groups[1].Value })
        }
    }
    return $deps
}

function Get-IssuePriority($issue) {
    foreach ($l in @($issue.labels ?? @())) {
        $label = if ($l -is [string]) { $l } else { $l.name ?? '' }
        if ($label -match 'priority:p(\d)') { return [int]$Matches[1] }
    }
    return 9
}

function Get-IssueType($issue) {
    foreach ($l in @($issue.labels ?? @())) {
        $label = if ($l -is [string]) { $l } else { $l.name ?? '' }
        if ($label -match 'type:(\w+)') { return $Matches[1] }
    }
    return 'story'
}

function Invoke-ReadyCmd {
    $all = Get-AllIssues
    $providerInfo = Get-AgentXProviderInfo
    $usesExplicitReadyState = $providerInfo.readyUsesExplicitReadyState -or ($providerInfo.name -eq 'github' -and (Test-GitHubProjectConfigured))
    $open = if ($usesExplicitReadyState) {
        @($all | Where-Object { $_.state -eq 'open' -and $_.status -eq 'Ready' })
    } else {
        @($all | Where-Object { $_.state -eq 'open' })
    }

    $ready = @($open | Where-Object {
        $deps = Get-IssueDeps $_
        $blocked = $false
        foreach ($bid in $deps.blocked_by) {
            $b = $all | Where-Object { $_.number -eq $bid } | Select-Object -First 1
            if ($b -and $b.state -eq 'open') { $blocked = $true }
        }
        -not $blocked
    } | Sort-Object { Get-IssuePriority $_ })

    if ($Script:JsonOutput) { $ready | ConvertTo-Json -Depth 5; return }
    if ($ready.Count -eq 0) { Write-Host 'No ready work found.'; return }

    Write-Host "`n$($C.c)  Ready Work (unblocked, sorted by priority):$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
    foreach ($i in $ready) {
        $p = Get-IssuePriority $i
        $pLabel = if ($p -lt 9) { "P$p" } else { '  ' }
        $pc = switch ($p) { 0 { $C.r } 1 { $C.y } default { $C.d } }
        $typ = Get-IssueType $i

        Write-Host "  $pc[$pLabel]$($C.n) $($C.c)#$($i.number)$($C.n) $($C.d)($typ)$($C.n) $($i.title)"
    }
    Write-Host ''
}

# ---------------------------------------------------------------------------
# STATE: Agent status tracking
# ---------------------------------------------------------------------------

function Invoke-StateCmd {
    $agent = Get-Flag @('-a', '--agent')
    $set = Get-Flag @('-s', '--set')
    $issue = [int](Get-Flag @('-i', '--issue') '0')

    $data = Read-JsonFile $Script:STATE_FILE
    if (-not $data) { $data = [PSCustomObject]@{} }

    if ($agent -and $set) {
        $entry = [PSCustomObject]@{ status = $set; issue = $(if ($issue) { $issue } else { $null }); lastActivity = Get-Timestamp }
        $data | Add-Member -NotePropertyName $agent -NotePropertyValue $entry -Force
        Write-JsonFile $Script:STATE_FILE $data
        Write-Host "$($C.g)  Agent '$agent' -> $set$($C.n)"
        if ($issue) { Write-Host "$($C.d)  Working on: #$issue$($C.n)" }
        return
    }

    if ($Script:JsonOutput) { $data | ConvertTo-Json -Depth 5; return }

    Write-Host "`n$($C.c)  Agent Status:$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
    $agents = @('product-manager', 'ux-designer', 'architect', 'engineer', 'reviewer', 'auto-fix-reviewer', 'devops-engineer', 'data-scientist', 'tester', 'consulting-research')
    foreach ($a in $agents) {
        $prop = $data.PSObject.Properties[$a]
        $info = if ($prop) { $prop.Value } else { $null }
        $status = if ($info -and $info.status) { $info.status } else { 'idle' }
        $sc = switch ($status) { 'working' { $C.y } 'reviewing' { $C.m } 'stuck' { $C.r } 'done' { $C.g } default { $C.d } }
        $ref = if ($info -and $info.issue) { " -> #$($info.issue)" } else { '' }
        $dt = if ($info -and $info.lastActivity) { " ($("$($info.lastActivity)".Substring(0, 10)))" } else { '' }
        Write-Host "  $($C.w)$a$($C.n) $sc[$status]$($C.n)$($C.d)$ref$dt$($C.n)"
    }
    Write-Host ''
}

# ---------------------------------------------------------------------------
# DEPS: Dependency check
# ---------------------------------------------------------------------------

function Invoke-DepsCmd {
    $rawNum = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { Get-Flag @('-n', '--number') '0' }
    $num = [int]$rawNum
    if (-not $num) { Write-Host 'Usage: agentx deps <issue-number>'; exit 1 }

    $all = Get-AllIssues
    $issue = $all | Where-Object { $_.number -eq $num } | Select-Object -First 1
    if (-not $issue) { Write-Host "Error: Issue #$num not found"; exit 1 }

    $deps = Get-IssueDeps $issue
    $hasBlockers = $false

    Write-Host "`n$($C.c)  Dependency Check: #$num - $($issue.title)$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"

    if ($deps.blocked_by.Count -gt 0) {
        Write-Host "$($C.y)  Blocked by:$($C.n)"
        foreach ($bid in $deps.blocked_by) {
            $b = $all | Where-Object { $_.number -eq $bid } | Select-Object -First 1
            if ($b) {
                $ok = $b.state -eq 'closed'
                $mark = if ($ok) { "$($C.g)[PASS]" } else { "$($C.r)[FAIL]" }
                Write-Host "    $mark #$bid - $($b.title) [$($b.state)]$($C.n)"
                if (-not $ok) { $hasBlockers = $true }
            } else {
                Write-Host "    $($C.y)? #$bid - (not found)$($C.n)"
            }
        }
    } else {
        Write-Host "$($C.g)  No blockers - ready to start.$($C.n)"
    }

    if ($deps.blocks.Count -gt 0) {
        Write-Host "$($C.d)  Blocks:$($C.n)"
        foreach ($bid in $deps.blocks) {
            $b = $all | Where-Object { $_.number -eq $bid } | Select-Object -First 1
            $bTitle = if ($b -and $b.title) { $b.title } else { '(not found)' }
            Write-Host "$($C.d)    -> #$bid - $bTitle$($C.n)"
        }
    }

    if ($hasBlockers) {
        Write-Host "`n$($C.r)  [WARN] BLOCKED - resolve open blockers first.$($C.n)`n"
    } else {
        Write-Host "`n$($C.g)  [PASS] All clear - issue is unblocked.$($C.n)`n"
    }
}

# ---------------------------------------------------------------------------
# DIGEST: Weekly summary
# ---------------------------------------------------------------------------

function Invoke-DigestCmd {
    if (-not (Test-Path $Script:DIGESTS_DIR)) { New-Item -ItemType Directory -Path $Script:DIGESTS_DIR -Force | Out-Null }
    $all = Get-AllIssues
    $closed = @($all | Where-Object { $_.state -eq 'closed' } | Sort-Object { $_.updated ?? '' } -Descending)

    if ($closed.Count -eq 0) { Write-Host 'No closed issues to digest.'; return }

    $d = Get-Date
    $weekOfYear = [math]::Ceiling(($d.DayOfYear + [int]([datetime]::new($d.Year, 1, 1)).DayOfWeek) / 7)
    $weekNum = '{0}-W{1:D2}' -f $d.Year, [int]$weekOfYear
    $digestFile = Join-Path $Script:DIGESTS_DIR "DIGEST-$weekNum.md"

    $lines = @(
        "# Weekly Digest - $weekNum", ''
        "> Auto-generated on $($d.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm'))", ''
        '## Completed Issues', ''
        '| # | Type | Title | Closed |', '|---|------|-------|--------|'
    )
    foreach ($i in $closed) {
        $typ = Get-IssueType $i
        $updatedStr = "$($i.updated ?? '')"
        $closedDate = if ($updatedStr.Length -ge 10) { $updatedStr.Substring(0, 10) } else { $updatedStr }
        $lines += "| #$($i.number) | $typ | $($i.title) | $closedDate |"
    }
    $lines += @('', '## Key Decisions', '', '_Review closed issues above and note key decisions._', ''
        '## Outcomes', '', "- **Issues closed**: $($closed.Count)", "- **Generated**: $($d.ToString('yyyy-MM-dd'))", '')

    $lines -join "`n" | Set-Content $digestFile -Encoding utf8
    Write-Host "$($C.g)  Digest generated: $digestFile$($C.n)"
    Write-Host "$($C.d)  Closed issues: $($closed.Count)$($C.n)"
}

# ---------------------------------------------------------------------------
# WORKFLOW: Show/run workflow steps
# ---------------------------------------------------------------------------

function Invoke-WorkflowCmd {
    $agentName = if ($Script:SubArgs.Count -gt 0 -and -not $Script:SubArgs[0].StartsWith('-')) {
        $Script:SubArgs[0]
    } else {
        Get-Flag @('-t', '--type', '-Type', '--Type')
    }

    $agentsDir = Join-Path $Script:ROOT '.github' 'agents'

    if (-not $agentName) {
        Write-Host "`n$($C.c)  Agent Handoff Chains:$($C.n)"
        Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
        if (Test-Path $agentsDir) {
            foreach ($f in (Get-ChildItem $agentsDir -Filter '*.agent.md')) {
                $name = $f.BaseName -replace '\.agent$', ''
                $content = Get-Content $f.FullName -Raw -Encoding utf8
                $desc = ''
                if ($content -match '(?m)^description:\s*[''"]?(.+?)[''"]?\s*$') { $desc = $Matches[1] }
                Write-Host "  $($C.w)$name$($C.n) $($C.d)- $desc$($C.n)"
            }
        }
        Write-Host "`n$($C.d)  Usage: agentx workflow <agent-name>$($C.n)`n"
        return
    }

    $agentFile = Join-Path $agentsDir "$agentName.agent.md"
    if (-not (Test-Path $agentFile)) { Write-Host "Error: Agent '$agentName' not found"; exit 1 }

    $content = Get-Content $agentFile -Raw -Encoding utf8

    # Extract handoffs from YAML frontmatter
    $handoffs = @()
    if ($content -match '(?s)^---\r?\n(.+?)\r?\n---') {
        $fm = $Matches[1]
        # Parse handoffs: array
        $inHandoffs = $false
        foreach ($line in ($fm -split '\r?\n')) {
            if ($line -match '^\s*handoffs:\s*$') { $inHandoffs = $true; continue }
            if ($inHandoffs -and $line -match '^\s+-\s+') {
                # Start of a new handoff entry
                $agent = ''; $label = ''
                if ($line -match 'agent:\s*(.+)') { $agent = $Matches[1].Trim().Trim("'`"") }
            }
            if ($inHandoffs -and $line -match '^\s+agent:\s*(.+)') { $agent = $Matches[1].Trim().Trim("'`"") }
            if ($inHandoffs -and $line -match '^\s+label:\s*(.+)') { $label = $Matches[1].Trim().Trim("'`"") }
            if ($inHandoffs -and $line -match '^\s+send:\s*(.+)') {
                if ($agent) { $handoffs += [PSCustomObject]@{ agent = $agent; label = $label } }
            }
            # Stop parsing handoffs when we hit a non-indented line (next top-level key)
            if ($inHandoffs -and $line -match '^\w' -and $line -notmatch '^\s*handoffs:') { $inHandoffs = $false }
        }
    }

    Write-Host "`n$($C.c)  Handoff Chain: $agentName$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"

    if ($handoffs.Count -eq 0) {
        Write-Host "  $($C.d)(no handoffs defined)$($C.n)"
    } else {
        $n = 1
        foreach ($h in $handoffs) {
            Write-Host "  $($C.c)$n.$($C.n) -> $($C.y)$($h.agent)$($C.n) $($C.d)$($h.label)$($C.n)"
            $n++
        }
    }
    Write-Host ''
}

# ---------------------------------------------------------------------------
# LOOP: Iterative refinement
# ---------------------------------------------------------------------------

function Invoke-LoopCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'status' }
    # Shift subargs past the action for loop subcommands
    $Script:SubArgs = @(if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1..($Script:SubArgs.Count - 1)] } else { @() })
    switch ($action) {
        'start'    { Invoke-LoopStart }
        'status'   { Invoke-LoopStatus }
        'iterate'  { Invoke-LoopIterate }
        'complete' { Invoke-LoopComplete }
        'cancel'   { Invoke-LoopCancel }
        default    { Write-Host "Unknown loop action: $action" }
    }
}

function Invoke-LoopStart {
    $prompt = Get-Flag @('-p', '--prompt')
    if (-not $prompt) { Write-Host 'Error: --prompt required'; exit 1 }
    $max = [int](Get-Flag @('-m', '--max') '20')
    $criteria = Get-Flag @('-c', '--criteria') 'TASK_COMPLETE'
    $issue = [int](Get-Flag @('-i', '--issue') '0')
    if (-not $issue) { $issue = $null }

    $existing = Read-JsonFile $Script:LOOP_STATE_FILE
    if ($existing -and $existing.active) { Write-Host 'An active loop exists. Cancel it first.'; return }

    $state = [PSCustomObject]@{
        active             = $true
        status             = 'active'
        prompt             = $prompt
        iteration          = 1
        maxIterations      = $max
        completionCriteria = $criteria
        issueNumber        = $issue
        startedAt          = Get-Timestamp
        lastIterationAt    = Get-Timestamp
        history            = @([PSCustomObject]@{ iteration = 1; timestamp = Get-Timestamp; summary = 'Loop started'; status = 'in-progress' })
    }
    Write-JsonFile $Script:LOOP_STATE_FILE $state

    Write-Host "`n$($C.c)  Iterative Loop Started$($C.n)"
    Write-Host "$($C.d)  Iteration: 1/$max  |  Criteria: $criteria$($C.n)"
    if ($issue) { Write-Host "$($C.d)  Issue: #$issue$($C.n)" }
    Write-Host "`n$($C.w)  Prompt:$($C.n) $prompt`n"
}

function Invoke-LoopStatus {
    $state = Read-JsonFile $Script:LOOP_STATE_FILE
    if (-not $state) {
        if ($Script:JsonOutput) { Write-Host '{"active":false}' } else { Write-Host '  No active loop.' }
        return
    }
    if ($Script:JsonOutput) { $state | ConvertTo-Json -Depth 5; return }

    Write-Host "`n$($C.c)  Iterative Loop Status$($C.n)"
    Write-Host "$($C.d)  Active: $($state.active)  |  Iteration: $($state.iteration)/$($state.maxIterations)$($C.n)"
    Write-Host "$($C.d)  Criteria: $($state.completionCriteria)$($C.n)"
    if ($state.history -and $state.history.Count -gt 0) {
        Write-Host "`n$($C.w)  History (last 5):$($C.n)"
        $recent = $state.history | Select-Object -Last 5
        foreach ($h in $recent) {
            $mark = if ($h.status -eq 'complete') { '[PASS]' } else { '[...]' }
            Write-Host "$($C.d)    $mark Iteration $($h.iteration): $($h.summary)$($C.n)"
        }
    }
    Write-Host ''
}

function Invoke-LoopIterate {
    $state = Read-JsonFile $Script:LOOP_STATE_FILE
    if (-not $state) { Write-Host 'No loop state found.'; return }
    if (-not $state.active) { $state.active = $true; $state.status = 'active' }

    $next = $state.iteration + 1
    if ($next -gt $state.maxIterations) {
        $state.active = $false
        $state.history = @($state.history) + @([PSCustomObject]@{ iteration = $next; timestamp = Get-Timestamp; summary = 'Max iterations reached'; status = 'stopped' })
        Write-JsonFile $Script:LOOP_STATE_FILE $state
        Write-Host "$($C.r)  Max iterations ($($state.maxIterations)) reached. Loop stopped.$($C.n)"
        return
    }

    $summary = Get-Flag @('-s', '--summary') "Iteration $next"
    $state.iteration = $next
    $state.lastIterationAt = Get-Timestamp
    $state.history = @($state.history) + @([PSCustomObject]@{ iteration = $next; timestamp = Get-Timestamp; summary = $summary; status = 'in-progress' })
    Write-JsonFile $Script:LOOP_STATE_FILE $state
    Write-Host "`n$($C.c)  Iteration $next/$($state.maxIterations)$($C.n)"
    Write-Host "$($C.d)  Summary: $summary$($C.n)`n"
}

function Invoke-LoopComplete {
    $state = Read-JsonFile $Script:LOOP_STATE_FILE
    if (-not $state -or -not $state.active) { Write-Host 'No active loop.'; return }
    $summary = Get-Flag @('-s', '--summary') 'Criteria met'
    $state.active = $false; $state.status = 'complete'; $state.lastIterationAt = Get-Timestamp
    $state.history = @($state.history) + @([PSCustomObject]@{ iteration = $state.iteration; timestamp = Get-Timestamp; summary = $summary; status = 'complete' })
    Write-JsonFile $Script:LOOP_STATE_FILE $state
    Write-Host "`n$($C.g)  [PASS] Loop Complete! Iterations: $($state.iteration)/$($state.maxIterations)$($C.n)`n"
}

function Invoke-LoopCancel {
    $state = Read-JsonFile $Script:LOOP_STATE_FILE
    if (-not $state -or -not $state.active) { Write-Host 'No active loop.'; return }
    $state.active = $false; $state.status = 'cancelled'; $state.lastIterationAt = Get-Timestamp
    $state.history = @($state.history) + @([PSCustomObject]@{ iteration = $state.iteration; timestamp = Get-Timestamp; summary = 'Cancelled'; status = 'cancelled' })
    Write-JsonFile $Script:LOOP_STATE_FILE $state
    Write-Host "$($C.y)  Loop cancelled at iteration $($state.iteration).$($C.n)"
}

# ---------------------------------------------------------------------------
# VALIDATE: Pre-handoff validation
# ---------------------------------------------------------------------------

function Invoke-ValidateCmd {
    $rawNum = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { '0' }
    $num = [int]$rawNum
    $role = if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1] } else { '' }
    if (-not $num -or -not $role) { Write-Host 'Usage: agentx validate <issue-number> <role>'; exit 1 }

    Write-Host "`n$($C.c)  Handoff Validation: #$num [$role]$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"

    $script:validationPass = $true
    function Test-Check([bool]$ok, [string]$msg) {
        $mark = if ($ok) { "$($C.g)[PASS]" } else { "$($C.r)[FAIL]" }
        Write-Host "  $mark $msg$($C.n)"
        if (-not $ok) { $script:validationPass = $false }
    }

    switch ($role) {
        'pm' {
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/prd/PRD-$num.md")) "PRD-$num.md exists"
        }
        'ux' {
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/ux/UX-$num.md")) "UX-$num.md exists"
        }
        'architect' {
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/adr/ADR-$num.md")) "ADR-$num.md exists"
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/specs/SPEC-$num.md")) "SPEC-$num.md exists"
        }
        'engineer' {
            $gitLog = & git log --oneline --grep="#$num" -1 2>$null
            Test-Check ([bool]$gitLog) "Commits reference #$num"

            # Quality loop check: loop must be status=complete (cancelled does NOT satisfy this).
            $loopState = Read-JsonFile $Script:LOOP_STATE_FILE
            $loopActive = $loopState -and $loopState.active -eq $true
            $loopComplete = $loopState -and $loopState.status -eq 'complete'
            Test-Check (-not $loopActive) "Quality loop not still running (finish it first)"
            Test-Check $loopComplete "Quality loop is complete (cancelled does not satisfy this gate)"
        }
        'reviewer' {
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/reviews/REVIEW-$num.md")) "REVIEW-$num.md exists"
        }
        'devops' {
            Test-Check (Test-Path (Join-Path $Script:ROOT '.github/workflows')) 'Workflows directory exists'
        }
        'data-scientist' {
            Test-Check (Test-Path (Join-Path $Script:ROOT 'docs/data-science')) 'Data science docs directory exists'
        }
        'tester' {
            Test-Check (Test-Path (Join-Path $Script:ROOT 'tests')) 'Tests directory exists'
            Test-Check (Test-Path (Join-Path $Script:ROOT "docs/testing/TEST-$num.md")) "TEST-$num.md exists"
        }
        'consulting-research' {
            Test-Check (Test-Path (Join-Path $Script:ROOT 'docs/coaching')) 'Coaching docs directory exists'
        }
        default {
            Write-Host "  Unknown role: $role"
            $script:validationPass = $false
        }
    }

    if ($script:validationPass) {
        Write-Host "`n$($C.g)  VALIDATION PASSED$($C.n)`n"
    } else {
        Write-Host "`n$($C.r)  VALIDATION FAILED$($C.n)`n"
        exit 1
    }
}

# ---------------------------------------------------------------------------
# HOOKS: Install git hooks
# ---------------------------------------------------------------------------

function Invoke-HooksCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'install' }
    $gitHooksDir = Join-Path $Script:ROOT '.git' 'hooks'
    if (-not (Test-Path (Join-Path $Script:ROOT '.git'))) { Write-Host 'Not a git repo. Run git init first.'; return }
    if (-not (Test-Path $gitHooksDir)) { New-Item -ItemType Directory -Path $gitHooksDir -Force | Out-Null }

    if ($action -eq 'install') {
        foreach ($hook in @('pre-commit', 'commit-msg')) {
            $src = Join-Path $Script:ROOT '.github' 'hooks' $hook
            if (Test-Path $src) {
                Copy-Item $src (Join-Path $gitHooksDir $hook) -Force
                Write-Host "$($C.g)  Installed: $hook$($C.n)"
            }
        }
        Write-Host "$($C.g)  Git hooks installed.$($C.n)"
    }
}

# ---------------------------------------------------------------------------
# CONFIG: View and update configuration
# ---------------------------------------------------------------------------

function Invoke-ConfigCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'show' }

    switch ($action) {
        'show' {
            $cfg = Get-AgentXConfig
            $providerInfo = Get-AgentXProviderInfo
            if ($Script:JsonOutput) {
                [PSCustomObject]@{
                    config = $cfg
                    activeProvider = $providerInfo.name
                    providerSource = $providerInfo.source
                    providerInferred = $providerInfo.inferred
                    providerWarning = $providerInfo.warning
                } | ConvertTo-Json -Depth 10 | Write-Host
            } else {
                Write-Host "$($C.c)  AgentX Configuration$($C.n)"
                Write-Host "$($C.d)  -----------------------------------$($C.n)"
                foreach ($key in ($cfg.PSObject.Properties ?? $cfg.Keys)) {
                    $k = if ($key -is [string]) { $key } else { $key.Name }
                    $v = $cfg.$k
                    Write-Host "  $($C.w)$k$($C.n) = $v"
                }
                Write-Host "  $($C.w)activeProvider$($C.n) = $($providerInfo.name)"
                Write-Host "  $($C.w)providerSource$($C.n) = $($providerInfo.source)"
                if ($providerInfo.inferred) {
                    Write-Host "$($C.y)  [WARN] $($providerInfo.warning)$($C.n)"
                }
            }
        }
        'set' {
            if ($Script:SubArgs.Count -lt 3) {
                Write-Host "Usage: agentx config set <key> <value>"
                Write-Host "Example: agentx config set enforceIssues true"
                return
            }
            $key = $Script:SubArgs[1]
            $rawValue = $Script:SubArgs[2]
            # Parse boolean and numeric values
            $value = switch -Regex ($rawValue) {
                '^true$'  { $true }
                '^false$' { $false }
                '^\d+$'   { [int]$rawValue }
                default   { $rawValue }
            }
            Invoke-WithJsonLock $Script:CONFIG_FILE 'cli' {
                $cfg = Get-AgentXConfig
                Set-ConfigValue $cfg $key $value
                Write-JsonFile $Script:CONFIG_FILE $cfg
            }
            Write-Host "$($C.g)  Set $key = $value$($C.n)"
            if ($key -in @('provider', 'integration', 'mode', 'repo')) {
                $repoSlug = Get-GitHubRepoSlug
                if (-not [string]::IsNullOrWhiteSpace($repoSlug) -and (Get-AgentXProvider) -eq 'github' -and (Test-GitHubCliAuthenticated)) {
                    Sync-LocalBacklogToGitHubIfNeeded -Repo $repoSlug -Reason "config '$key' changed"
                }
            }
        }
        'get' {
            if ($Script:SubArgs.Count -lt 2) {
                Write-Host "Usage: agentx config get <key>"
                return
            }
            $key = $Script:SubArgs[1]
            $cfg = Get-AgentXConfig
            $val = $cfg.$key
            if ($null -ne $val) {
                Write-Host $val
            } else {
                Write-Host "$($C.y)  Key '$key' not set$($C.n)"
            }
        }
        default {
            Write-Host "Usage: agentx config [show|get|set]"
        }
    }
}

# ---------------------------------------------------------------------------
# VERSION
# ---------------------------------------------------------------------------

function Invoke-VersionCmd {
    $ver = Read-JsonFile $Script:VERSION_FILE
    if (-not $ver) { Write-Host 'AgentX version unknown.'; return }
    if ($Script:JsonOutput) { $ver | ConvertTo-Json -Depth 5; return }
    $installed = if ($ver.installedAt) { "$($ver.installedAt)".Substring(0, 10) } else { '?' }
    $provider = Get-AgentXProvider
    Write-Host "`n$($C.c)  AgentX $($ver.version)$($C.n)"
    Write-Host "$($C.d)  Provider: $provider  |  Installed: $installed$($C.n)`n"
}





# ---------------------------------------------------------------------------
# HOOK: Agent lifecycle hooks (start/finish)
# ---------------------------------------------------------------------------

function Invoke-AgentHookCmd {
    $phase = Get-Flag @('-p', '--phase', '-Phase')
    if (-not $phase -and $Script:SubArgs.Count -gt 0) { $phase = $Script:SubArgs[0] }
    $agent = Get-Flag @('-a', '--agent', '-Agent')
    if (-not $agent -and $Script:SubArgs.Count -gt 1) { $agent = $Script:SubArgs[1] }
    $issue = [int](Get-Flag @('-i', '--issue', '-Issue') '')
    if (-not $issue -and $Script:SubArgs.Count -gt 2) { $issue = [int]$Script:SubArgs[2] }

    if (-not $phase -or -not $agent) { Write-Host 'Usage: agentx hook <start|finish> <agent> [issue]'; return }

    $data = Read-JsonFile $Script:STATE_FILE
    if (-not $data) { $data = [PSCustomObject]@{} }

    if ($phase -eq 'start') {
        $status = if ($agent -eq 'reviewer') { 'reviewing' } else { 'working' }
        $entry = [PSCustomObject]@{ status = $status; issue = $(if ($issue) { $issue } else { $null }); lastActivity = Get-Timestamp }
        $data | Add-Member -NotePropertyName $agent -NotePropertyValue $entry -Force
        Write-JsonFile $Script:STATE_FILE $data
        $issueRef = if ($issue) { " (issue #$issue)" } else { '' }
        Write-Host "$($C.g)  [PASS] $agent -> $status$issueRef$($C.n)"
    } elseif ($phase -eq 'finish') {
        # -----------------------------------------------------------------
        # QUALITY GATE (engineer only): block finish unless quality loop
        # is status=complete.  active=true AND cancelled both block.
        # Other agent roles (reviewer, architect, etc.) are not affected.
        # -----------------------------------------------------------------
        if ($agent -eq 'engineer') {
            $loopState = Read-JsonFile $Script:LOOP_STATE_FILE
            if ($loopState -and $loopState.active -eq $true) {
                Write-Host "$($C.r)  [FAIL] QUALITY LOOP STILL ACTIVE -- cannot finish yet.$($C.n)"
                Write-Host "$($C.y)  Loop iteration $($loopState.iteration)/$($loopState.maxIterations) is in progress.$($C.n)"
                Write-Host "$($C.d)  Run: agentx loop iterate -s <summary>  (to record progress)$($C.n)"
                Write-Host "$($C.d)  Run: agentx loop complete -s <summary>  (when criteria met)$($C.n)`n"
                exit 1
            }
            if (-not $loopState -or $loopState.status -ne 'complete') {
                $reason = if (-not $loopState) { 'no loop was started' } else { "loop status is '$($loopState.status)'" }
                Write-Host "$($C.r)  [FAIL] Quality loop not completed ($reason).$($C.n)"
                Write-Host "$($C.y)  A completed loop ('agentx loop complete') is required before handoff.$($C.n)"
                Write-Host "$($C.d)  Cancelling a loop does not satisfy the quality gate.$($C.n)`n"
                exit 1
            }
        }

        $entry = [PSCustomObject]@{ status = 'done'; issue = $(if ($issue) { $issue } else { $null }); lastActivity = Get-Timestamp }
        $data | Add-Member -NotePropertyName $agent -NotePropertyValue $entry -Force
        Write-JsonFile $Script:STATE_FILE $data
        Write-Host "$($C.g)  [PASS] $agent -> done$($C.n)"
    }
}

# ---------------------------------------------------------------------------
# RUN: Agentic loop execution (LLM + tools via GitHub Models API)
# ---------------------------------------------------------------------------

function Invoke-RunCmd {
    # Dot-source the agentic runner module
    . (Join-Path $PSScriptRoot 'agentic-runner.ps1')

    $agent = Get-Flag @('-a', '--agent')
    $prompt = Get-Flag @('-p', '--prompt')
    $model = Get-Flag @('-m', '--model')
    $max = [int](Get-Flag @('--max', '-n') '30')
    $issue = [int](Get-Flag @('-i', '--issue') '0')
    $resumeSession = Get-Flag @('--resume-session')
    $clarificationResponse = Get-Flag @('--clarification-response')

    if (-not $agent -and $Script:SubArgs.Count -gt 0 -and $Script:SubArgs[0] -notmatch '^-') {
        $agent = $Script:SubArgs[0]
    }
    if (-not $prompt -and $Script:SubArgs.Count -gt 1 -and $Script:SubArgs[1] -notmatch '^-') {
        # Collect remaining non-flag args as the prompt
        $promptParts = @()
        for ($i = 1; $i -lt $Script:SubArgs.Count; $i++) {
            if ($Script:SubArgs[$i] -match '^-') { break }
            $promptParts += $Script:SubArgs[$i]
        }
        if ($promptParts.Count -gt 0) { $prompt = $promptParts -join ' ' }
    }

    if (-not $agent -and -not $resumeSession) {
        Write-Host "`n$($C.c)  AgentX Run - Agentic Loop (LLM + Tools)$($C.n)"
        Write-Host "$($C.d)  Auto-detects: Copilot API (all models) or GitHub Models (GPT only).$($C.n)"
        Write-Host "$($C.d)  To unlock Claude/Gemini/o-series: gh auth refresh -s copilot$($C.n)`n"
        Write-Host "$($C.w)  Usage:$($C.n)"
        Write-Host '  agentx run <agent> <prompt>'
        Write-Host '  agentx run -a engineer -p "Fix the failing tests"'
        Write-Host '  agentx run architect "Design the auth system" -i 42'
        Write-Host '  agentx run engineer "Implement login" --max 20 -m gpt-4.1'
        Write-Host '  agentx run --resume-session <session-id> --clarification-response "Use the existing auth flow"'
        Write-Host "`n$($C.w)  Available agents:$($C.n)"
        $agentsDir = Join-Path $Script:ROOT '.github' 'agents'
        if (Test-Path $agentsDir) {
            foreach ($f in (Get-ChildItem $agentsDir -Filter '*.agent.md')) {
                $name = $f.BaseName -replace '\.agent$', ''
                Write-Host "  $($C.c)$name$($C.n)"
            }
        }
        Write-Host ''
        return
    }

    if ($resumeSession) {
        $session = Read-Session -sessionId $resumeSession -root $Script:ROOT
        if (-not $session) {
            Write-Host "$($C.r)  [FAIL] Session '$resumeSession' not found.$($C.n)"
            return
        }

        if (-not $agent) {
            $agent = [string]$session.meta.agentName
        }

        if (-not $clarificationResponse) {
            Write-Host "$($C.r)  [FAIL] Clarification response required. Use: agentx run --resume-session $resumeSession --clarification-response \"your guidance\"$($C.n)"
            return
        }
    } elseif (-not $prompt) {
        Write-Host "$($C.r)  [FAIL] Prompt required. Use: agentx run $agent \"your prompt\"$($C.n)"
        return
    }

    # Verify gh auth
    $ghToken = $null
    try { $ghToken = (gh auth token 2>$null) } catch {}
    if (-not $ghToken) {
        Write-Host "$($C.r)  [FAIL] GitHub CLI not authenticated.$($C.n)"
        Write-Host "$($C.d)  Run: gh auth login --scopes 'models:read'$($C.n)"
        return
    }

    if ($resumeSession) {
        Write-Host "`n$($C.c)  Resuming agentic loop...$($C.n)`n"
    } else {
        Write-Host "`n$($C.c)  Starting agentic loop...$($C.n)`n"
    }

    $params = @{
        Agent = $agent
        MaxIterations = $max
        WorkspaceRoot = $Script:ROOT
    }
    if ($resumeSession) {
        $params['ResumeSessionId'] = $resumeSession
        $params['HumanClarificationResponse'] = $clarificationResponse
    } else {
        $params['Prompt'] = $prompt
    }
    if ($issue) { $params['IssueNumber'] = $issue }
    if ($model) { $params['Model'] = $model }

    $result = Invoke-AgenticLoop @params

    if ($Script:JsonOutput -and $result) {
        $result | ConvertTo-Json -Depth 5
    }
}

# ---------------------------------------------------------------------------
# LESSONS: Learning pipeline management
# ---------------------------------------------------------------------------

function Invoke-LessonsCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'list' }
    # Shift subargs past the action for lesson subcommands
    $Script:SubArgs = @(if ($Script:SubArgs.Count -gt 1) { $Script:SubArgs[1..($Script:SubArgs.Count - 1)] } else { @() })
    
    switch ($action) {
        'list'    { Invoke-LessonsList }
        'query'   { Invoke-LessonsQuery }
        'show'    { Invoke-LessonsShow }
        'promote' { Invoke-LessonsPromote }
        'archive' { Invoke-LessonsArchive }
        'stats'   { Invoke-LessonsStats }
        'clean'   { Invoke-LessonsClean }
        default   { Write-Host "Unknown lessons action: $action"; Invoke-LessonsHelp }
    }
}

function Invoke-LessonsList {
    $lessonsDir = Join-Path $Script:AGENTX_DIR 'lessons'
    $globalLessonsDir = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)) '.agentx' 'lessons'
    
    $projectLessons = @()
    $globalLessons = @()
    
    # Read project lessons
    if (Test-Path $lessonsDir) {
        foreach ($file in (Get-ChildItem $lessonsDir -Filter '*.jsonl' -ErrorAction SilentlyContinue)) {
            try {
                $content = Get-Content $file.FullName -Encoding utf8
                foreach ($line in $content) {
                    if ($line.Trim()) {
                        $lesson = $line | ConvertFrom-Json
                        $lesson | Add-Member -NotePropertyName '__source' -NotePropertyValue 'project' -Force
                        $projectLessons += $lesson
                    }
                }
            } catch {}
        }
    }
    
    # Read global lessons (top 5 for overview)
    if (Test-Path $globalLessonsDir) {
        foreach ($file in (Get-ChildItem $globalLessonsDir -Filter '*.jsonl' -ErrorAction SilentlyContinue | Select-Object -First 3)) {
            try {
                $content = Get-Content $file.FullName -Encoding utf8 | Select-Object -Last 5
                foreach ($line in $content) {
                    if ($line.Trim()) {
                        $lesson = $line | ConvertFrom-Json
                        $lesson | Add-Member -NotePropertyName '__source' -NotePropertyValue 'global' -Force
                        $globalLessons += $lesson
                    }
                }
            } catch {}
        }
    }
    
    $allLessons = @($projectLessons) + @($globalLessons)
    
    if ($Script:JsonOutput) {
        $allLessons | ConvertTo-Json -Depth 5
        return
    }
    
    if ($allLessons.Count -eq 0) {
        Write-Host "$($C.y)No lessons found. Lessons are extracted automatically from agent sessions.$($C.n)"
        return
    }
    
    Write-Host "`n$($C.c)  Lessons Learned Overview$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
    Write-Host "  Project lessons: $(@($projectLessons).Count)"
    Write-Host "  Global lessons:  $(@($globalLessons).Count) (showing sample)"
    Write-Host ""
    
    # Group by category and show recent
    $byCategory = @{}
    foreach ($lesson in ($allLessons | Sort-Object updatedAt -Descending | Select-Object -First 10)) {
        if (-not $byCategory[$lesson.category]) {
            $byCategory[$lesson.category] = @()
        }
        $byCategory[$lesson.category] += $lesson
    }
    
    foreach ($category in $byCategory.Keys) {
        $categoryLessons = @($byCategory[$category])
        Write-Host "$($C.w)  $($category.ToUpper()) ($($categoryLessons.Count)):$($C.n)"
        foreach ($lesson in ($categoryLessons | Select-Object -First 3)) {
            $source = if ($lesson.__source -eq 'project') { '' } else { ' (global)' }
            $confidence = $lesson.confidence
            $cc = switch ($confidence) { 'high' { $C.g } 'medium' { $C.y } 'low' { $C.d } }
            Write-Host "    $cc[$confidence]$($C.n) $($lesson.pattern)$source"
        }
        Write-Host ""
    }
    
    Write-Host "$($C.d)Use 'agentx lessons query' for specific searches or 'agentx lessons show <id>' for details.$($C.n)"
}

function Invoke-LessonsQuery {
    $category = Get-Flag @('-c', '--category')
    $confidence = Get-Flag @('--confidence')
    $tag = Get-Flag @('-t', '--tag')
    $pattern = Get-Flag @('-p', '--pattern')
    $limit = [int](Get-Flag @('-l', '--limit') '10')
    
    if (-not $category -and -not $confidence -and -not $tag -and -not $pattern) {
        Write-Host "`n$($C.c)  Query Lessons$($C.n)"
        Write-Host "$($C.w)  Usage:$($C.n)"
        Write-Host "    agentx lessons query -c error-pattern"
        Write-Host "    agentx lessons query -t typescript --confidence high"
        Write-Host "    agentx lessons query -p \"timeout\" -l 5"
        Write-Host "`n$($C.w)  Categories:$($C.n)"
        Write-Host "    error-pattern, success-pattern, tool-usage, security"
        Write-Host "    performance, configuration, integration, workflow, testing"
        Write-Host "`n$($C.w)  Confidence:$($C.n)"
        Write-Host "    high, medium, low"
        Write-Host ""
        return
    }
    
    # Query is handled by memory.instructions.md in the declarative architecture
    Write-Host "$($C.y)Query functionality uses /memories/*.md files in v8.0.0.$($C.n)"
    Write-Host "$($C.d)Use 'agentx lessons list' for the local JSONL overview, or check /memories/ for cross-session facts.$($C.n)"
}

function Invoke-LessonsShow {
    $id = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { '' }
    if (-not $id) {
        Write-Host "Usage: agentx lessons show <lesson-id>"
        return
    }
    
    # Search for lesson by ID
    Write-Host "$($C.y)Show lesson by ID uses /memories/*.md files in v8.0.0.$($C.n)"
    Write-Host "$($C.d)Check /memories/ for cross-session decisions and pitfalls.$($C.n)"
}

function Invoke-LessonsPromote {
    $id = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { '' }
    if (-not $id) {
        Write-Host "Usage: agentx lessons promote <lesson-id>"
        return
    }
    
    Write-Host "$($C.y)Promote functionality uses /memories/*.md files in v8.0.0.$($C.n)"
    Write-Host "$($C.d)Promote lessons by editing /memories/conventions.md or project-conventions.instructions.md.$($C.n)"
}

function Invoke-LessonsArchive {
    $id = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { '' }
    if (-not $id) {
        Write-Host "Usage: agentx lessons archive <lesson-id>"
        return
    }
    
    Write-Host "$($C.y)Archive functionality uses /memories/*.md files in v8.0.0.$($C.n)"
    Write-Host "$($C.d)Archive lessons by moving entries from /memories/ to /memories/session/.$($C.n)"
}

function Invoke-LessonsStats {
    $lessonsDir = Join-Path $Script:AGENTX_DIR 'lessons'
    $globalLessonsDir = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)) '.agentx' 'lessons'
    
    $projectCount = 0
    $globalCount = 0
    
    # Count project lessons
    if (Test-Path $lessonsDir) {
        foreach ($file in (Get-ChildItem $lessonsDir -Filter '*.jsonl' -ErrorAction SilentlyContinue)) {
            try {
                $lines = @(Get-Content $file.FullName -Encoding utf8 | Where-Object { $_.Trim() })
                $projectCount += $lines.Count
            } catch {}
        }
    }
    
    # Count global lessons
    if (Test-Path $globalLessonsDir) {
        foreach ($file in (Get-ChildItem $globalLessonsDir -Filter '*.jsonl' -ErrorAction SilentlyContinue)) {
            try {
                $lines = @(Get-Content $file.FullName -Encoding utf8 | Where-Object { $_.Trim() })
                $globalCount += $lines.Count
            } catch {}
        }
    }
    
    Write-Host "`n$($C.c)  Learning Pipeline Statistics$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
    Write-Host "  Project lessons:     $projectCount"
    Write-Host "  Global lessons:      $globalCount"
    Write-Host "  Total lessons:       $($projectCount + $globalCount)"
    Write-Host ""
    
    $configFile = Join-Path $Script:AGENTX_DIR 'config.json'
    $config = Read-JsonFile $configFile
    $learningEnabled = if ($config -and $config.PSObject.Properties['learningEnabled']) { $config.learningEnabled } else { $true }
    
    Write-Host "  Learning enabled:    $learningEnabled"
    Write-Host "  Storage mode:        JSONL (two-tier)"
    Write-Host ""
    
    if ($projectCount -eq 0 -and $globalCount -eq 0) {
        Write-Host "$($C.y)  No lessons found yet. Lessons are automatically extracted from agent sessions$($C.n)"
        Write-Host "$($C.d)  when context compaction occurs. Start using agents to build your lesson base.$($C.n)"
    }
    Write-Host ""
}

function Invoke-LessonsClean {
    $dryRun = Test-Flag @('--dry-run', '-d')
    $lessonsDir = Join-Path $Script:AGENTX_DIR 'lessons'
    
    if ($dryRun) {
        Write-Host "$($C.c)  Dry Run: Lesson Cleanup$($C.n)"
        Write-Host "$($C.d)  Would clean up archived and low-confidence lessons older than 90 days$($C.n)"
    } else {
        Write-Host "$($C.y)Clean functionality uses /memories/*.md files in v8.0.0.$($C.n)"
        Write-Host "$($C.d)Manually review and prune /memories/ files as needed.$($C.n)"
    }
}

function Invoke-LessonsHelp {
    Write-Host "`n$($C.c)  Lessons Commands$($C.n)"
    Write-Host "$($C.d)  ---------------------------------------------$($C.n)"
    Write-Host "$($C.w)  Usage:$($C.n)"
    Write-Host "    agentx lessons list                  Show lessons overview"
    Write-Host "    agentx lessons query [options]       Search lessons"
    Write-Host "    agentx lessons show <id>             Show lesson details"
    Write-Host "    agentx lessons promote <id>          Promote lesson to higher confidence"
    Write-Host "    agentx lessons archive <id>          Archive lesson"
    Write-Host "    agentx lessons stats                 Show learning pipeline statistics"
    Write-Host "    agentx lessons clean [--dry-run]     Clean up old archived lessons"
    Write-Host ""
    Write-Host "$($C.w)  Query Options:$($C.n)"
    Write-Host "    -c, --category <name>     Filter by category (error-pattern, success-pattern, etc.)"
    Write-Host "    -t, --tag <tag>           Filter by tag"
    Write-Host "    -p, --pattern <text>      Search in lesson patterns and descriptions"
    Write-Host "    --confidence <level>      Filter by confidence (high, medium, low)"
    Write-Host "    -l, --limit <n>           Limit results (default: 10)"
    Write-Host ""
    Write-Host "$($C.d)  Note: Lessons are automatically extracted from agent sessions during context$($C.n)"
    Write-Host "$($C.d)  compaction. Full query/modify uses /memories/*.md files in v8.0.0.$($C.n)"
    Write-Host ""
}

# ---------------------------------------------------------------------------
# TOKENS: Token budget management
# ---------------------------------------------------------------------------

function Invoke-TokensCmd {
    $action = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { 'check' }
    $scriptPath = Join-Path $Script:ROOT 'scripts/token-counter.ps1'
    if (-not (Test-Path $scriptPath)) {
        Write-Host "$($C.r)  Error: scripts/token-counter.ps1 not found.$($C.n)"
        exit 1
    }
    & $scriptPath -Action $action
}

# ---------------------------------------------------------------------------
# SCORE: Agent output quality scoring
# ---------------------------------------------------------------------------

function Invoke-ScoreCmd {
    $role = if ($Script:SubArgs.Count -gt 0) { $Script:SubArgs[0] } else { '' }
    if (-not $role) { Write-Host 'Usage: agentx score <engineer|architect|pm> [issue-number]'; exit 1 }
    $issue = if ($Script:SubArgs.Count -gt 1) { [int]$Script:SubArgs[1] } else { 0 }
    $scriptPath = Join-Path $Script:ROOT 'scripts/score-output.ps1'
    if (-not (Test-Path $scriptPath)) {
        Write-Host "$($C.r)  Error: scripts/score-output.ps1 not found.$($C.n)"
        exit 1
    }
    $params = @{ Role = $role }
    if ($issue -gt 0) { $params.IssueNumber = $issue }
    & $scriptPath @params
}

# ---------------------------------------------------------------------------
# HELP
# ---------------------------------------------------------------------------

function Invoke-HelpCmd {
    Write-Host @"

$($C.c)  AgentX CLI$($C.n)
$($C.d)  ---------------------------------------------$($C.n)

$($C.w)  Commands:$($C.n)
  ready                            Show unblocked work, sorted by priority
  state [-a agent -s status]       Show/update agent states
  deps <issue>                     Check dependencies for an issue
  digest                           Generate weekly digest
  workflow [type]                   List/show workflow steps
  loop <start|status|iterate|complete|cancel>  Iterative refinement
  run <agent> <prompt>             Run agentic loop (LLM + tools via GitHub Models API)
  validate <issue> <role>          Pre-handoff validation
  hook <start|finish> <agent> [#]  Agent lifecycle hooks
  hooks install                    Install git hooks
  config [show|get|set]            View/update configuration
  issue <create|list|get|update|close|comment>  Issue management
    backlog-sync [github] [--force]  Force sync local backlog to GitHub on demand
  lessons [list|query|show|stats|promote|archive|clean]  Learning pipeline management
  tokens [count|check|report]      Token budget management
  score <engineer|architect|pm> [issue]  Score agent output quality
  git-sync [push|pull]             Push/pull data branch to/from remote
  version                          Show installed version
  help                             Show this help

$($C.w)  Config Commands:$($C.n)
  config show                        Show all config values
  config get <key>                   Get a config value
  config set <key> <value>           Set a config value
  config set enforceIssues true      Enable issue enforcement in local mode

$($C.w)  Issue Commands:$($C.n)
  issue create -t "Title" -l "type:story"
  issue list
  issue get -n 1
  issue update -n 1 -s "In Progress"
  issue close -n 1
  issue comment -n 1 -c "Started"

$($C.w)  Flags:$($C.n)
  --json / -j                      Output as JSON

"@
}

# ---------------------------------------------------------------------------
# Main router
# ---------------------------------------------------------------------------

switch ($Script:Command) {
    'ready'    { Invoke-ReadyCmd }
    'state'    { Invoke-StateCmd }
    'deps'     { Invoke-DepsCmd }
    'digest'   { Invoke-DigestCmd }
    'workflow'  { Invoke-WorkflowCmd }
    'loop'     { Invoke-LoopCmd }
    'validate'  { Invoke-ValidateCmd }
    'hook'     { Invoke-AgentHookCmd }
    'hooks'    { Invoke-HooksCmd }
    'config'   { Invoke-ConfigCmd }
    'issue'    { Invoke-IssueCmd }
    'backlog-sync' { Invoke-BacklogSyncCmd }
    'lessons'  { Invoke-LessonsCmd }
    'git-sync' { Invoke-GitSyncCmd }
    'run'      { Invoke-RunCmd }
    'tokens'   { Invoke-TokensCmd }
    'score'    { Invoke-ScoreCmd }
    'version'  { Invoke-VersionCmd }
    'help'     { Invoke-HelpCmd }
    default {
        Write-Host "Unknown command: $($Script:Command). Run 'agentx help' for usage."
        exit 1
    }
}
