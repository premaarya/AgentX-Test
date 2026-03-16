#!/usr/bin/env pwsh
# Provider behavior tests for local and GitHub CLI paths

$ErrorActionPreference = 'Stop'
$script:pass = 0
$script:fail = 0
$script:repoRoot = Split-Path $PSScriptRoot -Parent

function Assert-True($condition, $message) {
    if ($condition) {
        Write-Host " [PASS] $message" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host " [FAIL] $message" -ForegroundColor Red
        $script:fail++
    }
}

function New-TestWorkspace([string]$name) {
    $root = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-provider-test-{0}-{1}" -f $name, [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $root '.agentx') -Force | Out-Null
    Copy-Item (Join-Path $script:repoRoot '.agentx\agentx.ps1') (Join-Path $root '.agentx\agentx.ps1') -Force
    Copy-Item (Join-Path $script:repoRoot '.agentx\agentx-cli.ps1') (Join-Path $root '.agentx\agentx-cli.ps1') -Force
    return $root
}

function Remove-TestWorkspace([string]$root) {
    if ($root -and (Test-Path $root)) {
        Remove-Item $root -Recurse -Force
    }
}

function Invoke-AgentX([string]$root, [string[]]$arguments) {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'pwsh'
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-File')
    $startInfo.ArgumentList.Add((Join-Path $root '.agentx\agentx.ps1'))
    foreach ($argument in $arguments) {
        $startInfo.ArgumentList.Add($argument)
    }

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [PSCustomObject]@{
        Output = ($stdout + $stderr)
        ExitCode = $process.ExitCode
    }
}

function Write-Utf8File([string]$path, [string]$content) {
    [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
}

function Initialize-GitHubMock([string]$root) {
    $toolsDir = Join-Path $root 'mock-tools'
    New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null

    $state = [PSCustomObject]@{
        nextIssueNumber = 300
        failCloseIssueNumbers = @(299)
        issues = @(
            [PSCustomObject]@{ number = 201; title = '[Story] Backlog'; body = 'Backlog item'; state = 'OPEN'; url = 'https://github.com/test-owner/test-repo/issues/201'; labels = @('type:story'); comments = @() },
            [PSCustomObject]@{ number = 202; title = '[Story] Ready'; body = 'Ready item'; state = 'OPEN'; url = 'https://github.com/test-owner/test-repo/issues/202'; labels = @('type:story', 'priority:p1'); comments = @() },
            [PSCustomObject]@{ number = 203; title = '[Story] In Progress'; body = 'In progress item'; state = 'OPEN'; url = 'https://github.com/test-owner/test-repo/issues/203'; labels = @('type:story'); comments = @() },
            [PSCustomObject]@{ number = 299; title = '[Story] Close Failure'; body = 'Close failure item'; state = 'OPEN'; url = 'https://github.com/test-owner/test-repo/issues/299'; labels = @('type:story'); comments = @() }
        )
        project = [PSCustomObject]@{
            number = 4
            id = 'PVT_TEST'
            owner = 'test-owner'
            repo = 'test-owner/test-repo'
            statusField = [PSCustomObject]@{
                id = 'FIELD_STATUS'
                options = @(
                    [PSCustomObject]@{ id = 'OPT_BACKLOG'; name = 'Backlog' },
                    [PSCustomObject]@{ id = 'OPT_READY'; name = 'Ready' },
                    [PSCustomObject]@{ id = 'OPT_IN_PROGRESS'; name = 'In progress' },
                    [PSCustomObject]@{ id = 'OPT_IN_REVIEW'; name = 'In review' },
                    [PSCustomObject]@{ id = 'OPT_DONE'; name = 'Done' }
                )
            }
            items = @(
                [PSCustomObject]@{ id = 'ITEM_201'; title = '[Story] Backlog'; status = 'Backlog'; labels = @('type:story'); repository = 'https://github.com/test-owner/test-repo'; content = [PSCustomObject]@{ number = 201; repository = 'test-owner/test-repo'; title = '[Story] Backlog'; type = 'Issue'; url = 'https://github.com/test-owner/test-repo/issues/201'; body = 'Backlog item' } },
                [PSCustomObject]@{ id = 'ITEM_202'; title = '[Story] Ready'; status = 'Ready'; labels = @('type:story', 'priority:p1'); repository = 'https://github.com/test-owner/test-repo'; content = [PSCustomObject]@{ number = 202; repository = 'test-owner/test-repo'; title = '[Story] Ready'; type = 'Issue'; url = 'https://github.com/test-owner/test-repo/issues/202'; body = 'Ready item' } },
                [PSCustomObject]@{ id = 'ITEM_203'; title = '[Story] In Progress'; status = 'In progress'; labels = @('type:story'); repository = 'https://github.com/test-owner/test-repo'; content = [PSCustomObject]@{ number = 203; repository = 'test-owner/test-repo'; title = '[Story] In Progress'; type = 'Issue'; url = 'https://github.com/test-owner/test-repo/issues/203'; body = 'In progress item' } },
                [PSCustomObject]@{ id = 'ITEM_299'; title = '[Story] Close Failure'; status = 'In review'; labels = @('type:story'); repository = 'https://github.com/test-owner/test-repo'; content = [PSCustomObject]@{ number = 299; repository = 'test-owner/test-repo'; title = '[Story] Close Failure'; type = 'Issue'; url = 'https://github.com/test-owner/test-repo/issues/299'; body = 'Close failure item' } }
            )
        }
    }

    Write-Utf8File (Join-Path $toolsDir 'gh-state.json') ($state | ConvertTo-Json -Depth 20)

    $mockScript = @'
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)

$ErrorActionPreference = 'Stop'
$statePath = Join-Path $PSScriptRoot 'gh-state.json'
$state = Get-Content $statePath -Raw | ConvertFrom-Json -Depth 20

    for ($i = 0; $i -lt $Args.Count; $i++) {
        if (($Args[$i] -eq '-R' -or $Args[$i] -eq '--repo') -and ($i + 1) -lt $Args.Count) {
            if ($i -eq 0) {
                $Args = @($Args[2..($Args.Count - 1)])
            } elseif (($i + 2) -le ($Args.Count - 1)) {
                $Args = @($Args[0..($i - 1)] + $Args[($i + 2)..($Args.Count - 1)])
            } else {
                $Args = @($Args[0..($i - 1)])
            }
            break
        }
    }

function Save-State {
    $state | ConvertTo-Json -Depth 20 | Set-Content $statePath -Encoding utf8
}

function Get-ArgValue([string[]]$AllArgs, [string]$Name, [string]$Default = '') {
    for ($i = 0; $i -lt $AllArgs.Count; $i++) {
        if ($AllArgs[$i] -eq $Name -and ($i + 1) -lt $AllArgs.Count) {
            return $AllArgs[$i + 1]
        }
    }
    return $Default
}

function Get-Issue([int]$Number) {
    return ($state.issues | Where-Object { [int]$_.number -eq $Number } | Select-Object -First 1)
}

function Get-ProjectItem([int]$Number) {
    return ($state.project.items | Where-Object { [int]$_.content.number -eq $Number } | Select-Object -First 1)
}

function Get-StatusOption([string]$OptionId) {
    return ($state.project.statusField.options | Where-Object { $_.id -eq $OptionId } | Select-Object -First 1)
}

switch ($Args[0]) {
    'issue' {
        switch ($Args[1]) {
            'create' {
                $title = Get-ArgValue $Args '--title'
                $body = Get-ArgValue $Args '--body'
                $labels = @()
                for ($i = 0; $i -lt $Args.Count; $i++) {
                    if ($Args[$i] -eq '--label' -and ($i + 1) -lt $Args.Count) {
                        $labels += $Args[$i + 1]
                    }
                }
                $number = [int]$state.nextIssueNumber
                $state.nextIssueNumber = $number + 1
                $issue = [PSCustomObject]@{
                    number = $number
                    title = $title
                    body = $body
                    state = 'OPEN'
                    url = "https://github.com/$($state.project.repo)/issues/$number"
                    labels = @($labels)
                    comments = @()
                }
                $state.issues = @($state.issues) + @($issue)
                Save-State
                Write-Output $issue.url
            }
            'view' {
                $number = [int]$Args[2]
                $issue = Get-Issue $number
                if (-not $issue) { Write-Error 'Issue not found'; exit 1 }
                $issue | ConvertTo-Json -Depth 10
            }
            'edit' {
                $number = [int]$Args[2]
                $issue = Get-Issue $number
                if (-not $issue) { Write-Error 'Issue not found'; exit 1 }
                $title = Get-ArgValue $Args '--title'
                $body = Get-ArgValue $Args '--body'
                if ($title) { $issue.title = $title }
                if ($body) { $issue.body = $body }
                for ($i = 0; $i -lt $Args.Count; $i++) {
                    if ($Args[$i] -eq '--add-label' -and ($i + 1) -lt $Args.Count) {
                        $label = $Args[$i + 1]
                        if ($label -notin @($issue.labels)) { $issue.labels = @($issue.labels) + @($label) }
                    }
                    if ($Args[$i] -eq '--remove-label' -and ($i + 1) -lt $Args.Count) {
                        $label = $Args[$i + 1]
                        $issue.labels = @($issue.labels | Where-Object { $_ -ne $label })
                    }
                }
                Save-State
            }
            'close' {
                $number = [int]$Args[2]
                if ($number -in @($state.failCloseIssueNumbers)) {
                    Write-Error 'Simulated close failure'
                    exit 1
                }
                $issue = Get-Issue $number
                if (-not $issue) { Write-Error 'Issue not found'; exit 1 }
                $issue.state = 'CLOSED'
                Save-State
            }
            'reopen' {
                $number = [int]$Args[2]
                $issue = Get-Issue $number
                if (-not $issue) { Write-Error 'Issue not found'; exit 1 }
                $issue.state = 'OPEN'
                Save-State
            }
            'comment' {
                $number = [int]$Args[2]
                $body = Get-ArgValue $Args '--body'
                $issue = Get-Issue $number
                if (-not $issue) { Write-Error 'Issue not found'; exit 1 }
                $issue.comments = @($issue.comments) + @([PSCustomObject]@{ body = $body; createdAt = '2026-03-08T00:00:00Z' })
                Save-State
            }
            'list' {
                $state.issues | ConvertTo-Json -Depth 10
            }
            default { Write-Error 'Unsupported issue command'; exit 1 }
        }
    }
    'project' {
        switch ($Args[1]) {
            'view' {
                [PSCustomObject]@{ id = $state.project.id; number = $state.project.number; owner = [PSCustomObject]@{ login = $state.project.owner }; title = 'Test Project' } | ConvertTo-Json -Depth 10
            }
            'field-list' {
                [PSCustomObject]@{ fields = @([PSCustomObject]@{ id = $state.project.statusField.id; name = 'Status'; type = 'ProjectV2SingleSelectField'; options = @($state.project.statusField.options) }) } | ConvertTo-Json -Depth 10
            }
            'item-list' {
                [PSCustomObject]@{ items = @($state.project.items) } | ConvertTo-Json -Depth 10
            }
            'item-add' {
                $url = Get-ArgValue $Args '--url'
                $issue = @($state.issues | Where-Object { $_.url -eq $url } | Select-Object -First 1)[0]
                if (-not $issue) { Write-Error 'Issue not found for project add'; exit 1 }
                $existing = Get-ProjectItem ([int]$issue.number)
                if (-not $existing) {
                    $item = [PSCustomObject]@{
                        id = "ITEM_$($issue.number)"
                        title = $issue.title
                        status = ''
                        labels = @($issue.labels)
                        repository = "https://github.com/$($state.project.repo)"
                        content = [PSCustomObject]@{ number = $issue.number; repository = $state.project.repo; title = $issue.title; type = 'Issue'; url = $issue.url; body = $issue.body }
                    }
                    $state.project.items = @($state.project.items) + @($item)
                    Save-State
                }
            }
            'item-edit' {
                $itemId = Get-ArgValue $Args '--id'
                $optionId = Get-ArgValue $Args '--single-select-option-id'
                $item = @($state.project.items | Where-Object { $_.id -eq $itemId } | Select-Object -First 1)[0]
                if (-not $item) { Write-Error 'Project item not found'; exit 1 }
                $option = Get-StatusOption $optionId
                if (-not $option) { Write-Error 'Status option not found'; exit 1 }
                $item.status = $option.name
                Save-State
            }
            default { Write-Error 'Unsupported project command'; exit 1 }
        }
    }
    'auth' {
        if ($Args[1] -eq 'status') {
            Write-Output 'github.com'
        } else {
            Write-Output 'fake-token'
        }
    }
    default { Write-Error 'Unsupported gh command'; exit 1 }
}
'@

    $cmdScript = "@echo off`r`npwsh -NoProfile -File `"%~dp0gh.ps1`" %*`r`n"
    Write-Utf8File (Join-Path $toolsDir 'gh.ps1') $mockScript
    Write-Utf8File (Join-Path $toolsDir 'gh.cmd') $cmdScript
    return $toolsDir
}

function Get-GitHubMockState([string]$toolsDir) {
    return Get-Content (Join-Path $toolsDir 'gh-state.json') -Raw | ConvertFrom-Json -Depth 20
}

Write-Host ''
Write-Host ' Provider Behavior Tests' -ForegroundColor Cyan
Write-Host ' ================================================' -ForegroundColor DarkGray

$localRoot = $null
$githubRoot = $null
$inferredRoot = $null
$remoteDetectedRoot = $null
$workflowRoot = $null

try {
    $localRoot = New-TestWorkspace 'local'
    New-Item -ItemType Directory -Path (Join-Path $localRoot '.agentx\issues') -Force | Out-Null
    Write-Utf8File (Join-Path $localRoot '.agentx\config.json') (@{
        provider = 'local'
        mode = 'local'
        created = '2026-03-08T00:00:00Z'
        enforceIssues = $false
        nextIssueNumber = 1
    } | ConvertTo-Json -Depth 5)

    $create = Invoke-AgentX $localRoot @('issue', 'create', '--title', '[Story] Local', '--body', 'Local body', '--labels', 'type:story,priority:p1')
    $issueFile = Join-Path $localRoot '.agentx\issues\1.json'
    $localIssue = Get-Content $issueFile -Raw | ConvertFrom-Json -Depth 10
    Assert-True ($create.ExitCode -eq 0) 'Local issue create exits successfully'
    Assert-True ($localIssue.title -eq '[Story] Local') 'Local issue create writes issue file'

    $update = Invoke-AgentX $localRoot @('issue', 'update', '-n', '1', '-s', 'In Progress', '-b', 'Updated body', '-l', 'type:story,priority:p0')
    $localIssue = Get-Content $issueFile -Raw | ConvertFrom-Json -Depth 10
    Assert-True ($update.ExitCode -eq 0) 'Local issue update exits successfully'
    Assert-True ($localIssue.status -eq 'In Progress' -and $localIssue.body -eq 'Updated body') 'Local issue update changes status and body'

    $comment = Invoke-AgentX $localRoot @('issue', 'comment', '-n', '1', '-c', 'Started work')
    $localIssue = Get-Content $issueFile -Raw | ConvertFrom-Json -Depth 10
    Assert-True ($comment.ExitCode -eq 0) 'Local issue comment exits successfully'
    Assert-True (@($localIssue.comments).Count -eq 1 -and $localIssue.comments[0].body -eq 'Started work') 'Local issue comment appends comment'

    $close = Invoke-AgentX $localRoot @('issue', 'close', '-n', '1')
    $localIssue = Get-Content $issueFile -Raw | ConvertFrom-Json -Depth 10
    Assert-True ($close.ExitCode -eq 0) 'Local issue close exits successfully'
    Assert-True ($localIssue.state -eq 'closed' -and $localIssue.status -eq 'Done') 'Local issue close updates state and status'

    $version = Invoke-AgentX $localRoot @('version')
    Assert-True ($version.ExitCode -eq 0) 'Version exits cleanly on success'
    Assert-True ($version.Output -match 'AgentX version') 'Version prints version details'

    $config = Invoke-AgentX $localRoot @('config', 'show')
    $configOutput = [string]::Join("`n", @($config.Output))
    $localConfigAfterShow = Get-Content (Join-Path $localRoot '.agentx\config.json') -Raw | ConvertFrom-Json -Depth 10
    Assert-True ($config.ExitCode -eq 0) 'Config show exits cleanly on success'
    Assert-True ($configOutput.Trim().Length -gt 0 -and $localConfigAfterShow.provider -eq 'local' -and $localConfigAfterShow.mode -eq 'local') 'Config show reports local mode'

    $workflowRoot = New-TestWorkspace 'workflow-type'
    Write-Utf8File (Join-Path $workflowRoot '.agentx\config.json') (@{
        provider = 'local'
        mode = 'local'
        created = '2026-03-08T00:00:00Z'
        enforceIssues = $false
        nextIssueNumber = 1
    } | ConvertTo-Json -Depth 5)
    Copy-Item (Join-Path $script:repoRoot '.github') (Join-Path $workflowRoot '.github') -Recurse -Force

    $featureWorkflow = Invoke-AgentX $workflowRoot @('workflow', 'feature')
    Assert-True ($featureWorkflow.ExitCode -eq 0) 'workflow feature exits successfully'
    Assert-True ($featureWorkflow.Output -match 'Handoff Chain: architect') 'workflow feature maps to architect'

    $bugWorkflow = Invoke-AgentX $workflowRoot @('workflow', 'bug')
    Assert-True ($bugWorkflow.ExitCode -eq 0) 'workflow bug exits successfully'
    Assert-True ($bugWorkflow.Output -match 'Handoff Chain: engineer') 'workflow bug maps to engineer'

    $githubRoot = New-TestWorkspace 'github'
    $toolsDir = Initialize-GitHubMock $githubRoot
    Write-Utf8File (Join-Path $githubRoot '.agentx\config.json') (@{
        provider = 'github'
        repo = 'test-owner/test-repo'
        project = 4
        created = '2026-03-08T00:00:00Z'
    } | ConvertTo-Json -Depth 5)

    $originalPath = $env:PATH
    $env:PATH = "$toolsDir;$originalPath"
    try {
        $ready = Invoke-AgentX $githubRoot @('ready', '--json')
        $readyIssues = $ready.Output | ConvertFrom-Json -Depth 10
        Assert-True ($ready.ExitCode -eq 0) 'GitHub ready exits successfully with mocked gh'
        Assert-True (@($readyIssues).Count -eq 1 -and [int]$readyIssues[0].number -eq 202) 'GitHub ready returns only issues with project status Ready'

        $ghCreate = Invoke-AgentX $githubRoot @('issue', 'create', '--title', '[Story] GitHub Create', '--body', 'GitHub body', '--labels', 'type:story,priority:p2')
        $state = Get-GitHubMockState $toolsDir
        $createdIssue = @($state.issues | Where-Object { $_.title -eq '[Story] GitHub Create' } | Select-Object -First 1)[0]
        $createdItem = @($state.project.items | Where-Object { [int]$_.content.number -eq [int]$createdIssue.number } | Select-Object -First 1)[0]
        Assert-True ($ghCreate.ExitCode -eq 0) 'GitHub issue create exits successfully'
        if (-not ($createdItem.status -eq 'Backlog')) {
            Write-Host $ghCreate.Output
            $createdItem | ConvertTo-Json -Depth 10 | Write-Host
        }
        Assert-True ($createdItem.status -eq 'Backlog') 'GitHub issue create adds new issue to project with Backlog status'

        $ghUpdate = Invoke-AgentX $githubRoot @('issue', 'update', '-n', "$($createdIssue.number)", '-s', 'In Progress')
        $state = Get-GitHubMockState $toolsDir
        $createdItem = @($state.project.items | Where-Object { [int]$_.content.number -eq [int]$createdIssue.number } | Select-Object -First 1)[0]
        if (-not ($ghUpdate.ExitCode -eq 0)) { Write-Host $ghUpdate.Output }
        Assert-True ($ghUpdate.ExitCode -eq 0) 'GitHub issue update exits successfully'
        if (-not ($createdItem.status -eq 'In progress')) {
            Write-Host $ghUpdate.Output
            $createdItem | ConvertTo-Json -Depth 10 | Write-Host
        }
        Assert-True ($createdItem.status -eq 'In progress') 'GitHub issue update syncs Project V2 status'

        $ghClose = Invoke-AgentX $githubRoot @('issue', 'close', '-n', "$($createdIssue.number)")
        $state = Get-GitHubMockState $toolsDir
        $closedIssue = @($state.issues | Where-Object { [int]$_.number -eq [int]$createdIssue.number } | Select-Object -First 1)[0]
        $closedItem = @($state.project.items | Where-Object { [int]$_.content.number -eq [int]$createdIssue.number } | Select-Object -First 1)[0]
        Assert-True ($ghClose.ExitCode -eq 0) 'GitHub issue close exits successfully'
        if (-not ($closedIssue.state -eq 'CLOSED' -and $closedItem.status -eq 'Done')) {
            Write-Host $ghClose.Output
            $closedItem | ConvertTo-Json -Depth 10 | Write-Host
        }
        Assert-True ($closedIssue.state -eq 'CLOSED' -and $closedItem.status -eq 'Done') 'GitHub issue close updates issue state and project status in order'

        $ghCloseFailure = Invoke-AgentX $githubRoot @('issue', 'close', '-n', '299')
        $state = Get-GitHubMockState $toolsDir
        $failedIssue = @($state.issues | Where-Object { [int]$_.number -eq 299 } | Select-Object -First 1)[0]
        $failedItem = @($state.project.items | Where-Object { [int]$_.content.number -eq 299 } | Select-Object -First 1)[0]
        if (-not ($ghCloseFailure.ExitCode -ne 0)) { Write-Host $ghCloseFailure.Output }
        Assert-True ($ghCloseFailure.ExitCode -ne 0) 'GitHub issue close returns non-zero when gh close fails'
        Assert-True ($failedIssue.state -eq 'OPEN' -and $failedItem.status -eq 'In review') 'GitHub project status is unchanged when gh close fails'

        $inferredRoot = New-TestWorkspace 'inferred-github'
        Write-Utf8File (Join-Path $inferredRoot '.agentx\config.json') (@{
            mode = 'local'
            repo = 'test-owner/test-repo'
            project = 4
            created = '2026-03-08T00:00:00Z'
        } | ConvertTo-Json -Depth 5)

        $inferredReady = Invoke-AgentX $inferredRoot @('ready', '--json')
        $inferredReadyIssues = $inferredReady.Output | ConvertFrom-Json -Depth 10
        Assert-True ($inferredReady.ExitCode -eq 0) 'Repo-configured workspace infers GitHub provider for ready command'
        Assert-True (@($inferredReadyIssues).Count -eq 1 -and [int]$inferredReadyIssues[0].number -eq 202) 'Repo-configured workspace uses GitHub issue source instead of local mode'

        $configShow = Invoke-AgentX $inferredRoot @('config', 'show', '--json')
        $configShowJson = $configShow.Output | ConvertFrom-Json -Depth 10
        Assert-True ($configShow.ExitCode -eq 0) 'Config show succeeds for repo-inferred provider'
        Assert-True ($configShowJson.activeProvider -eq 'github') 'Config show reports inferred GitHub provider'
        $persistedConfig = Get-Content (Join-Path $inferredRoot '.agentx\config.json') -Raw | ConvertFrom-Json -Depth 10
        Assert-True ($persistedConfig.provider -eq 'github' -and $persistedConfig.repo -eq 'test-owner/test-repo') 'Repo-configured workspace auto-persists GitHub provider settings'

        $remoteDetectedRoot = New-TestWorkspace 'remote-detected-transition'
        New-Item -ItemType Directory -Path (Join-Path $remoteDetectedRoot '.agentx\issues') -Force | Out-Null
        Write-Utf8File (Join-Path $remoteDetectedRoot '.agentx\config.json') (@{
            mode = 'local'
            project = 4
            created = '2026-03-08T00:00:00Z'
            enforceIssues = $false
            nextIssueNumber = 3
        } | ConvertTo-Json -Depth 5)
        Write-Utf8File (Join-Path $remoteDetectedRoot '.agentx\issues\1.json') (@{
            number = 1
            title = '[Story] Migrated Open'
            body = 'Open local backlog item'
            labels = @('type:story', 'priority:p1')
            status = 'In Progress'
            state = 'open'
            created = '2026-03-08T00:00:00Z'
            updated = '2026-03-08T00:10:00Z'
            comments = @(
                @{ body = 'Investigating locally'; created = '2026-03-08T00:11:00Z' }
            )
        } | ConvertTo-Json -Depth 10)
        Write-Utf8File (Join-Path $remoteDetectedRoot '.agentx\issues\2.json') (@{
            number = 2
            title = '[Bug] Migrated Closed'
            body = 'Closed local backlog item'
            labels = @('type:bug')
            status = 'Done'
            state = 'closed'
            created = '2026-03-08T00:20:00Z'
            updated = '2026-03-08T00:30:00Z'
            comments = @(
                @{ body = 'Fixed locally'; created = '2026-03-08T00:25:00Z' }
            )
        } | ConvertTo-Json -Depth 10)

        $null = & git -C $remoteDetectedRoot init 2>$null
        $null = & git -C $remoteDetectedRoot remote add origin 'https://github.com/test-owner/test-repo.git' 2>$null

        $transitionRun = Invoke-AgentX $remoteDetectedRoot @('config', 'show', '--json')
        $transitionJson = $transitionRun.Output | ConvertFrom-Json -Depth 10
        $state = Get-GitHubMockState $toolsDir
        $transitionConfig = Get-Content (Join-Path $remoteDetectedRoot '.agentx\config.json') -Raw | ConvertFrom-Json -Depth 20
        $migratedOpen = @($state.issues | Where-Object { $_.title -eq '[Story] Migrated Open' } | Select-Object -First 1)[0]
        $migratedClosed = @($state.issues | Where-Object { $_.title -eq '[Bug] Migrated Closed' } | Select-Object -First 1)[0]
        $migratedOpenItem = @($state.project.items | Where-Object { [int]$_.content.number -eq [int]$migratedOpen.number } | Select-Object -First 1)[0]
        $migratedClosedItem = @($state.project.items | Where-Object { [int]$_.content.number -eq [int]$migratedClosed.number } | Select-Object -First 1)[0]
        Assert-True ($transitionRun.ExitCode -eq 0) 'GitHub remote detection transition command succeeds'
        Assert-True ($transitionJson.activeProvider -eq 'github') 'GitHub remote detection activates GitHub provider'
        Assert-True ($transitionConfig.provider -eq 'github' -and $transitionConfig.repo -eq 'test-owner/test-repo') 'GitHub remote detection persists provider and repo'
        Assert-True ($transitionConfig.githubBacklogSync.completed -and $transitionConfig.githubBacklogSync.issueMap.'1' -and $transitionConfig.githubBacklogSync.issueMap.'2') 'GitHub remote detection records completed backlog sync with issue mappings'
        Assert-True ($migratedOpenItem.status -eq 'In progress') 'Migrated open local issue keeps latest status in GitHub project'
        Assert-True ($migratedClosed.state -eq 'CLOSED' -and $migratedClosedItem.status -eq 'Done') 'Migrated closed local issue is closed remotely and marked Done'
        Assert-True (@($migratedOpen.comments).Count -ge 2) 'Migrated open local issue preserves migration summary and local comments'

        Write-Utf8File (Join-Path $remoteDetectedRoot '.agentx\issues\1.json') (@{
            number = 1
            title = '[Story] Migrated Open Updated'
            body = 'Open local backlog item updated'
            labels = @('type:story', 'priority:p0')
            status = 'Ready'
            state = 'open'
            created = '2026-03-08T00:00:00Z'
            updated = '2026-03-08T01:00:00Z'
            comments = @(
                @{ body = 'Investigating locally'; created = '2026-03-08T00:11:00Z' },
                @{ body = 'Ready for pickup'; created = '2026-03-08T01:05:00Z' }
            )
        } | ConvertTo-Json -Depth 10)
        Write-Utf8File (Join-Path $remoteDetectedRoot '.agentx\issues\2.json') (@{
            number = 2
            title = '[Bug] Migrated Closed Reopened'
            body = 'Closed local backlog item reopened'
            labels = @('type:bug', 'priority:p2')
            status = 'In Review'
            state = 'open'
            created = '2026-03-08T00:20:00Z'
            updated = '2026-03-08T01:10:00Z'
            comments = @(
                @{ body = 'Fixed locally'; created = '2026-03-08T00:25:00Z' },
                @{ body = 'Reopened after regression'; created = '2026-03-08T01:15:00Z' }
            )
        } | ConvertTo-Json -Depth 10)

        $forceSync = Invoke-AgentX $remoteDetectedRoot @('backlog-sync', 'github', '--force')
        $state = Get-GitHubMockState $toolsDir
        $forceSyncedOpen = @($state.issues | Where-Object { [int]$_.number -eq [int]$transitionConfig.githubBacklogSync.issueMap.'1' } | Select-Object -First 1)[0]
        $forceSyncedReopened = @($state.issues | Where-Object { [int]$_.number -eq [int]$transitionConfig.githubBacklogSync.issueMap.'2' } | Select-Object -First 1)[0]
        $forceOpenItem = @($state.project.items | Where-Object { [int]$_.content.number -eq [int]$forceSyncedOpen.number } | Select-Object -First 1)[0]
        $forceReopenedItem = @($state.project.items | Where-Object { [int]$_.content.number -eq [int]$forceSyncedReopened.number } | Select-Object -First 1)[0]
        Assert-True ($forceSync.ExitCode -eq 0) 'backlog-sync github --force exits successfully'
        Assert-True ($forceSyncedOpen.title -eq '[Story] Migrated Open Updated' -and $forceOpenItem.status -eq 'Ready') 'Forced backlog sync refreshes mapped open issues with latest title and status'
        Assert-True ($forceSyncedReopened.state -eq 'OPEN' -and $forceReopenedItem.status -eq 'In review') 'Forced backlog sync can reopen mapped issues and apply latest status'
        Assert-True (@($forceSyncedReopened.comments).Count -ge 3) 'Forced backlog sync adds newly introduced local comments without dropping existing migration history'
    } finally {
        $env:PATH = $originalPath
    }
}
finally {
    Remove-TestWorkspace $localRoot
    Remove-TestWorkspace $githubRoot
    Remove-TestWorkspace $inferredRoot
    Remove-TestWorkspace $remoteDetectedRoot
    Remove-TestWorkspace $workflowRoot
}

Write-Host ''
Write-Host ' ================================================' -ForegroundColor DarkGray
$total = $script:pass + $script:fail
Write-Host " Results: $($script:pass)/$total passed" -ForegroundColor $(if ($script:fail -eq 0) { 'Green' } else { 'Yellow' })
if ($script:fail -gt 0) {
    Write-Host " Failures: $($script:fail)" -ForegroundColor Red
}
Write-Host ''

exit $script:fail