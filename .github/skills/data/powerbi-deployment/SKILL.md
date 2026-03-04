````skill
---
name: "powerbi-deployment"
description: 'Automate Power BI report and semantic model deployment from GitHub Enterprise using Power BI REST API, XMLA endpoints, and pbi-tools. Covers Service Principal authentication, workspace publish, deployment pipelines (Dev/Test/Prod), dataset refresh orchestration, and CI/CD integration via GitHub Actions. Use when publishing reports to Power BI Service, configuring deployment pipelines, setting up automated refresh, or integrating Power BI into CI/CD workflows.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2026-03-03"
 updated: "2026-03-03"
compatibility:
 languages: ["powershell", "yaml", "json"]
 frameworks: ["power-bi", "github-actions", "microsoft-fabric"]
 platforms: ["windows", "linux"]
prerequisites:
 - "Power BI Service with Pro, Premium Per User, or Fabric capacity"
 - "Service Principal registered in Microsoft Entra ID with Power BI API permissions"
 - "pbi-tools CLI installed in CI agent"
 - "GitHub Actions runner with .NET 8+ for pbi-tools"
 - "Client Secret or Managed Identity stored in GitHub Secrets / Azure Key Vault"
allowed-tools: "read_file run_in_terminal create_file replace_string_in_file semantic_search"
---

# Power BI Deployment

> Automated, repeatable deployment of Power BI reports and semantic models from GitHub Enterprise to Power BI Service workspaces.

## When to Use

- Publishing compiled .pbix to a Power BI workspace from CI/CD
- Promoting reports between Dev, Test, and Production deployment pipeline stages
- Triggering dataset refresh after successful deployment
- Configuring data source credentials post-deploy
- Setting up Service Principal authentication for headless deployment

## Decision Tree

```
Deploying Power BI artifacts?
+- First-time workspace setup?
|  - Use REST API to create workspace and assign capacity
+- Promote between environments?
|  +- Using Fabric Deployment Pipelines -> Promote via REST API
|  - Using workspace-per-env pattern -> Publish to each workspace separately
+- Publishing semantic model only (no report)?
|  - Use XMLA endpoint + Tabular Editor CLI
+- Triggering refresh after deploy?
   - Use Enhanced Refresh API (async, supports partitions)
```

## Authentication: Service Principal

**NEVER use personal credentials in CI/CD.** Always authenticate as a Service Principal.

### Entra ID Setup

```powershell
# 1. Register app in Entra ID (one-time)
# App Registrations -> New Registration -> "pbi-deploy-sp"

# 2. Add Power BI API permissions:
#    - Dataset.ReadWrite.All
#    - Report.ReadWrite.All
#    - Workspace.ReadWrite.All
#    - Pipeline.Deploy (for deployment pipelines)

# 3. Grant admin consent in Entra ID portal

# 4. Create client secret (store in GitHub Secrets / Key Vault)
# Secret name: PBI_CLIENT_SECRET
```

### Power BI Tenant Admin Settings

```
Power BI Admin Portal -> Tenant Settings:
[ON] Allow service principals to use Power BI APIs
[ON] Allow service principals to create and use profiles
Security Group: "pbi-deploy-principals" (contains the SP)
```

### Token Acquisition

```powershell
# Acquire OAuth token for Power BI API
function Get-PBIToken {
    param(
        [string]$TenantId,
        [string]$ClientId,
        [string]$ClientSecret
    )

    $body = @{
        grant_type    = "client_credentials"
        scope         = "https://analysis.windows.net/powerbi/api/.default"
        client_id     = $ClientId
        client_secret = $ClientSecret
    }

    $response = Invoke-RestMethod `
        -Uri "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token" `
        -Method POST `
        -Body $body `
        -ContentType "application/x-www-form-urlencoded"

    return $response.access_token
}
```

## Compilation: PBIP to .pbix

```powershell
# Install pbi-tools (one-time on CI agent or as dotnet tool)
dotnet tool install --global pbi-tools

# Compile PBIP folder to .pbix for publishing
pbi-tools compile `
    -folder "reports/SalesReport" `
    -outPath "dist/SalesReport.pbix" `
    -overwrite
```

## Publishing via REST API

```powershell
# Publish .pbix to workspace (import)
function Publish-PBIReport {
    param(
        [string]$Token,
        [string]$WorkspaceId,
        [string]$PbixPath,
        [string]$ReportName,
        [ValidateSet("CreateOrOverwrite","Abort","Ignore")]
        [string]$ConflictAction = "CreateOrOverwrite"
    )

    $headers = @{ Authorization = "Bearer $Token" }
    $uri = "https://api.powerbi.com/v1.0/myorg/groups/$WorkspaceId/imports" +
           "?datasetDisplayName=$ReportName&nameConflict=$ConflictAction"

    $form = @{ file = Get-Item $PbixPath }
    $response = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Form $form

    return $response.id  # Import operation ID
}

# Poll import status (imports are async)
function Wait-PBIImport {
    param([string]$Token, [string]$WorkspaceId, [string]$ImportId)

    $headers = @{ Authorization = "Bearer $Token" }
    $uri = "https://api.powerbi.com/v1.0/myorg/groups/$WorkspaceId/imports/$ImportId"

    do {
        Start-Sleep -Seconds 5
        $status = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers
    } while ($status.importState -eq "Publishing")

    if ($status.importState -ne "Succeeded") {
        throw "Import failed: $($status.importState)"
    }

    return $status
}
```

## Semantic Model Deployment via XMLA

Use XMLA for schema-only model deployments (no report layer) against Premium or Fabric capacity.

```powershell
# Deploy via Tabular Editor 3 CLI (XMLA)
TabularEditor3.exe "$modelFolder/model.bim" `
    -S "powerbi://api.powerbi.com/v1.0/myorg/$workspaceName" `
    -D "$datasetName" `
    -O -C -P -R -M `
    -X "$outputDir/Warnings.xml" `
    -E "$outputDir/Errors.xml" `
    -W

# Parameters:
# -O  Overwrite existing model
# -C  Deploy connections
# -P  Deploy partitions
# -R  Deploy roles
# -M  Deploy model properties
```

## Deployment Pipelines (Fabric)

Fabric Deployment Pipelines promote artifacts between stages without re-publishing.

```powershell
# Get pipeline stages
function Get-PipelineStages {
    param([string]$Token, [string]$PipelineId)
    $headers = @{ Authorization = "Bearer $Token" }
    $uri = "https://api.powerbi.com/v1.0/myorg/pipelines/$PipelineId/stages"
    return Invoke-RestMethod -Uri $uri -Method GET -Headers $headers
}

# Deploy stage to next stage (e.g., Dev -> Test)
function Deploy-PipelineStage {
    param(
        [string]$Token,
        [string]$PipelineId,
        [int]$SourceStageOrder,    # 0=Dev, 1=Test, 2=Prod
        [bool]$UpdateAppInTargetWorkspace = $false
    )

    $headers = @{
        Authorization  = "Bearer $Token"
        "Content-Type" = "application/json"
    }
    $body = @{
        sourceStageOrder               = $SourceStageOrder
        isBackwardDeployment           = $false
        newWorkspace                   = $null
        updateAppInTargetWorkspace     = $UpdateAppInTargetWorkspace
        allowPurgeData                 = $false
        allowCreateArtifact            = $true
        allowSkipTilesWithMissingPrerequisites = $false
    } | ConvertTo-Json

    $uri = "https://api.powerbi.com/v1.0/myorg/pipelines/$PipelineId/deploy"
    return Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $body
}
```

## Dataset Refresh (Enhanced Refresh API)

```powershell
# Trigger enhanced refresh (supports partitions, mail on failure)
function Start-PBIRefresh {
    param(
        [string]$Token,
        [string]$WorkspaceId,
        [string]$DatasetId,
        [ValidateSet("full","automatic","dataOnly","calculate","clearValues","defragment")]
        [string]$RefreshType = "full",
        [string]$NotifyOption = "MailOnFailure"
    )

    $headers = @{
        Authorization  = "Bearer $Token"
        "Content-Type" = "application/json"
    }
    $body = @{
        type          = $RefreshType
        commitMode    = "transactional"
        maxParallelism = 2
        retryCount    = 2
        objects       = @()   # empty = refresh all tables
        notifyOption  = $NotifyOption
    } | ConvertTo-Json -Depth 5

    $uri = "https://api.powerbi.com/v1.0/myorg/groups/$WorkspaceId/datasets/$DatasetId/refreshes"
    $response = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $body
    return $response.requestId
}

# Poll refresh status
function Wait-PBIRefresh {
    param([string]$Token, [string]$WorkspaceId, [string]$DatasetId)

    $headers = @{ Authorization = "Bearer $Token" }
    $uri = "https://api.powerbi.com/v1.0/myorg/groups/$WorkspaceId/datasets/$DatasetId/refreshes?$top=1"

    do {
        Start-Sleep -Seconds 15
        $latest = (Invoke-RestMethod -Uri $uri -Method GET -Headers $headers).value[0]
    } while ($latest.status -eq "Unknown")  # Unknown = in progress

    if ($latest.status -ne "Completed") {
        throw "Refresh failed: $($latest.serviceExceptionJson)"
    }
}
```

## Data Source Credential Configuration

After publishing, bind data source credentials (required for refresh):

```powershell
# Update data source credentials (SQL Server example)
function Set-PBIDatasourceCredentials {
    param(
        [string]$Token,
        [string]$GatewayId,
        [string]$DatasourceId,
        [string]$Username,
        [string]$Password
    )

    $headers = @{
        Authorization  = "Bearer $Token"
        "Content-Type" = "application/json"
    }
    $body = @{
        credentialDetails = @{
            credentialType       = "Basic"
            credentials          = "{`"credentialData`":[{`"name`":`"username`",`"value`":`"$Username`"},{`"name`":`"password`",`"value`":`"$Password`"}]}"
            encryptedConnection  = "Encrypted"
            encryptionAlgorithm  = "None"
            privacyLevel         = "Organizational"
        }
    } | ConvertTo-Json -Depth 5

    $uri = "https://api.powerbi.com/v1.0/myorg/gateways/$GatewayId/datasources/$DatasourceId"
    Invoke-RestMethod -Uri $uri -Method PATCH -Headers $headers -Body $body
}
```

## Environment Variable Reference

| GitHub Secret | Description |
|---------------|-------------|
| `PBI_TENANT_ID` | Microsoft Entra Tenant ID |
| `PBI_CLIENT_ID` | Service Principal Application (Client) ID |
| `PBI_CLIENT_SECRET` | Service Principal Client Secret |
| `PBI_WORKSPACE_DEV_ID` | Target Dev workspace GUID |
| `PBI_WORKSPACE_TEST_ID` | Target Test workspace GUID |
| `PBI_WORKSPACE_PROD_ID` | Target Prod workspace GUID |
| `PBI_PIPELINE_ID` | Fabric Deployment Pipeline GUID (if used) |

## Core Rules

1. MUST authenticate as Service Principal - never use personal credentials in CI/CD
2. MUST store all credentials in GitHub Secrets or Azure Key Vault - never commit secrets
3. MUST poll import/refresh status before marking a deployment step as successful
4. MUST set data source credentials after first publish to a new workspace
5. MUST validate `pbi-tools compile` succeeds locally before attempting publish
6. MUST NOT publish directly to Production - always promote via deployment pipeline
7. MUST NOT embed workspace GUIDs or tenant IDs in source code - use GitHub Secrets
8. SHOULD configure `MailOnFailure` notify option for all scheduled refreshes
9. SHOULD document all workspace GUIDs and pipeline IDs in `docs/powerbi/WORKSPACES.md`
10. SHOULD add retry logic for transient REST API failures (429 Too Many Requests)

## Anti-Patterns

| Do Not | Do Instead |
|--------|------------|
| Hardcode client secrets in scripts | Store in GitHub Secrets; reference as `$env:PBI_CLIENT_SECRET` |
| Use personal user credentials in CI/CD | Register a Service Principal with least-privilege API permissions |
| Publish directly to Production workspace | Promote through Dev -> Test -> Prod deployment pipeline stages |
| Ignore import/refresh status polling | Always poll until Succeeded/Completed before proceeding |
| Skip data source credential binding | Set credentials after every first publish to a new workspace |
| Store workspace GUIDs in source code | Reference as GitHub Secrets or environment variables |

## Reference Index

| Document | Description |
|----------|-------------|
| [references/rest-api-functions.ps1](references/rest-api-functions.ps1) | Full PowerShell functions: Get-PBIToken, Publish-PBIReport, Wait-PBIImport, Start-PBIRefresh, Wait-PBIRefresh |
| [references/deployment-pipeline-guide.md](references/deployment-pipeline-guide.md) | Step-by-step guide for Fabric deployment pipeline setup and stage promotion |
| [references/xmla-deployment.md](references/xmla-deployment.md) | XMLA endpoint deployment via Tabular Editor CLI for semantic-model-only deploys |

## Asset Templates

| File | Description |
|------|-------------|
| [assets/deploy-template.ps1](assets/deploy-template.ps1) | End-to-end deployment script template (compile, publish, credential bind, refresh) |
| [assets/github-secrets-table.md](assets/github-secrets-table.md) | Required GitHub Secrets names and descriptions template |
````
