param(
    [string]$DatasetPath = "evaluation/datasets/regression.jsonl",
    [string]$PromptPath = "prompts/assistant-v1.md"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-RequiredPromptText {
    param(
        [AllowNull()]
        [string]$Text
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $false
    }

    $requiredPhrases = @(
        'type:bug',
        'type:docs',
        'type:story',
        'type:spike',
        'type:devops',
        'Return only the matching label'
    )

    foreach ($phrase in $requiredPhrases) {
        if ($Text -notmatch [regex]::Escape($phrase)) {
            return $false
        }
    }

    return $true
}

function Get-IssueTypePrediction {
    param(
        [AllowNull()]
        [string]$Text
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return 'type:story'
    }

    $normalized = $Text.ToLowerInvariant()

    if ($normalized -match '\b(readme|guide|document|documentation|docs?)\b') {
        return 'type:docs'
    }

    if ($normalized -match '\b(fix|bug|broken|error|fail|failing|regression|crash|timeout)\b') {
        return 'type:bug'
    }

    if ($normalized -match '\b(research|investigate|spike|assess|evaluate|explore|analysis)\b') {
        return 'type:spike'
    }

    if ($normalized -match '\b(workflow|pipeline|release|deployment|deploy|github actions|azure pipelines|ci/cd|ci)\b') {
        return 'type:devops'
    }

    return 'type:story'
}

if (-not (Test-Path -LiteralPath $DatasetPath)) {
    throw "Dataset file not found: $DatasetPath"
}

if (-not (Test-Path -LiteralPath $PromptPath)) {
    throw "Prompt file not found: $PromptPath"
}

$datasetRows = @()
Get-Content -LiteralPath $DatasetPath |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ } |
    ForEach-Object {
        $datasetRows += ($_ | ConvertFrom-Json)
    }

$promptText = Get-Content -LiteralPath $PromptPath -Raw
$failureSlices = @()
$correctCount = 0

if (-not (Test-RequiredPromptText -Text $promptText)) {
    $failureSlices += [pscustomobject]@{
        label = 'prompt-contract'
        severity = 'high'
        summary = 'The prompt is missing one or more required issue labels or the output constraint.'
        dataset = 'prompt'
    }
}

foreach ($row in $datasetRows) {
    $predicted = Get-IssueTypePrediction -Text ([string]$row.input)
    $expected = [string]$row.expected

    if ($predicted -eq $expected) {
        $correctCount += 1
    } else {
        $failureSlices += [pscustomobject]@{
            label = [string]$row.id
            severity = 'medium'
            summary = "Predicted $predicted but expected $expected."
            dataset = 'regression'
        }
    }
}

$score = if ($datasetRows.Count -gt 0) {
    [Math]::Round(($correctCount / $datasetRows.Count), 2)
} else {
    0.0
}

$reviewerNote = if ($failureSlices.Count -gt 0) {
    'The issue classification baseline has mismatches. Review the failing rows or update the prompt and heuristic logic together.'
} else {
    'The issue classification baseline matched every regression row.'
}

$output = [pscustomobject]@{
    runId = "sample-$(Get-Date -Format 'yyyyMMddHHmmss')"
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    models = @('agentx-issue-classifier-baseline')
    datasetCount = $datasetRows.Count
    aggregateMetrics = @(
        [pscustomobject]@{
            metric = 'correctness'
            score = $score
        },
        [pscustomobject]@{
            metric = 'task-completion'
            score = $score
        }
    )
    failureSlices = @($failureSlices)
    reviewerNote = $reviewerNote
}

$output | ConvertTo-Json -Depth 6