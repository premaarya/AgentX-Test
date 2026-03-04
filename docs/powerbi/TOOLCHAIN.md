# Power BI Toolchain Setup

Required tools for PowerBI report development and automated deployment from GitHub Enterprise.

## Developer Workstation

### Required

| Tool | Purpose | Install |
|------|---------|---------|
| Power BI Desktop (Mar 2024+) | Report authoring, PBIP format support | [Microsoft Store / Download Center](https://powerbi.microsoft.com/desktop) |
| pbi-tools | PBIP extract, compile, validate for source control | `dotnet tool install --global pbi-tools` |
| Tabular Editor 3 | DAX measure authoring, BPA rules, XMLA deploy | [tabulareditor.com](https://tabulareditor.com) or `choco install tabulareditor3` |
| DAX Studio | DAX query profiling, server timing, performance analyzer | [daxstudio.org](https://daxstudio.org) or `choco install daxstudio` |
| Git | Source control | `winget install Git.Git` |
| .NET 8 SDK | Required by pbi-tools | `winget install Microsoft.DotNet.SDK.8` |

### Recommended

| Tool | Purpose | Install |
|------|---------|---------|
| VS Code + Power Query SDK | M language development and unit testing | `winget install Microsoft.VisualStudioCode` + Power Query extension |
| ALM Toolkit | Semantic model schema compare and merge | [alm-toolkit.com](http://alm-toolkit.com) |

## CI/CD Agent (GitHub Actions Runner)

### Required on windows-latest runner

| Tool | Purpose | How Installed in Workflow |
|------|---------|--------------------------|
| .NET 8 SDK | pbi-tools dependency | `actions/setup-dotnet@v4` |
| pbi-tools | PBIP compile and validate | `dotnet tool install --global pbi-tools` |
| Tabular Editor 3 CLI | DAX BPA rules, XMLA deploy | Pre-installed in tool cache or `choco install tabulareditor3` |

### Power BI Service Prerequisites

| Requirement | Where to Configure |
|------------|-------------------|
| Service Principal registered in Entra ID | Azure Portal -> App Registrations |
| Power BI API permissions granted (admin consent) | Entra ID -> App -> API Permissions |
| Service Principal enabled for Power BI API | Power BI Admin Portal -> Tenant Settings |
| Service Principal added to target workspace | Workspace Settings -> Access |
| Capacity assigned to workspace (Pro / PPU / Fabric) | Fabric Admin Portal |
| XMLA read/write enabled (for Tabular Editor deploy) | Capacity Settings -> XMLA Endpoint |

## GitHub Repository Secrets

Configure these secrets in **Settings -> Secrets and variables -> Actions**:

| Secret Name | Value |
|------------|-------|
| `PBI_TENANT_ID` | Microsoft Entra Directory (Tenant) ID |
| `PBI_CLIENT_ID` | Service Principal Application (Client) ID |
| `PBI_CLIENT_SECRET` | Service Principal Client Secret (rotate every 12 months) |
| `PBI_WORKSPACE_DEV_ID` | GUID of the Dev Power BI workspace |
| `PBI_WORKSPACE_TEST_ID` | GUID of the Test Power BI workspace |
| `PBI_WORKSPACE_PROD_ID` | GUID of the Production Power BI workspace |
| `PBI_PIPELINE_ID` | GUID of the Fabric Deployment Pipeline (if using pipelines) |

## GitHub Repository Variables

Configure these in **Settings -> Secrets and variables -> Actions -> Variables**:

| Variable Name | Example Value | Purpose |
|--------------|--------------|---------|
| `SQL_SERVER_NAME` | `sqlserver-dev.company.com` | Data source connection (per environment) |
| `SQL_DATABASE_NAME` | `SalesDB_Dev` | Data source database name (per environment) |

## Service Principal Setup (Step-by-Step)

```powershell
# Step 1: Create App Registration (run once)
# Azure Portal -> Entra ID -> App Registrations -> New Registration
# Name: "pbi-github-deploy"
# Supported account types: Single tenant

# Step 2: Add API permissions
# API: Power BI Service (PowerBI)
# Permissions (Application, not Delegated):
#   - Dataset.ReadWrite.All
#   - Report.ReadWrite.All
#   - Workspace.ReadWrite.All
#   - Pipeline.Deploy
# Click: Grant admin consent

# Step 3: Create client secret
# Certificates & Secrets -> New client secret
# Expiry: 12 months (set a calendar reminder to rotate)
# Copy value immediately - shown only once
# Store in GitHub Secret: PBI_CLIENT_SECRET

# Step 4: Enable in Power BI Admin Portal
# Settings -> Admin Portal -> Tenant Settings
# "Allow service principals to use Power BI APIs" -> Enabled
# Security Group: create "pbi-deploy-principals" group, add the SP

# Step 5: Add SP to each workspace
# Workspace -> Settings -> Access -> Add: <sp-name> as Member or Admin
```

## Entra ID Permission Reference

| Permission | Type | Purpose |
|-----------|------|---------|
| `Dataset.ReadWrite.All` | Application | Create and update datasets |
| `Report.ReadWrite.All` | Application | Create and update reports |
| `Workspace.ReadWrite.All` | Application | Access workspace contents |
| `Pipeline.Deploy` | Application | Promote via deployment pipelines |

## Recommended Power BI Desktop Settings

Enable PBIP format as default:
```
File -> Options -> Preview features -> [ON] Power BI Project (.pbip)
File -> Options -> Data load -> [OFF] Autodetect column types
File -> Options -> DirectQuery -> [ON] Limit the number of rows returned to...
```
