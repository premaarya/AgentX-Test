````skill
---
name: "powerbi-reports"
description: 'Design and develop Power BI reports and dashboards using PBIP source-control format. Covers report authoring, DAX measures, visuals, Row-Level Security (RLS), themes, bookmarks, and deployment pipeline targets. Use when creating or modifying .pbip report files, dashboard layouts, visual configurations, RLS roles, or semantic model measures.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2026-03-03"
 updated: "2026-03-03"
compatibility:
 languages: ["dax", "power-query", "json"]
 frameworks: ["power-bi", "microsoft-fabric"]
 platforms: ["windows"]
prerequisites:
 - "Power BI Desktop (March 2024+ for full PBIP support)"
 - "pbi-tools CLI for source control operations"
 - "Tabular Editor 3 CLI for DAX validation and BPA rules"
 - "Power BI workspace with appropriate capacity (Pro, Premium, or Fabric)"
allowed-tools: "read_file run_in_terminal create_file replace_string_in_file semantic_search"
---

# Power BI Reports & Dashboards

> Design, author, and deliver production-quality Power BI reports and dashboards stored in PBIP format for GitHub source control.

## When to Use

- Creating new Power BI reports or dashboards from scratch
- Modifying existing .pbip report files committed to GitHub
- Defining or updating DAX measures on a semantic model
- Configuring Row-Level Security (RLS) roles and filters
- Building custom themes, bookmarks, or drill-through paths
- Designing dashboard layouts for executive or operational audiences

## Decision Tree

```
Building a Power BI artifact?
+- New report from existing semantic model?
|  +- Dashboard (single-page, KPI tiles) -> Dashboard Layout pattern
|  - Multi-page report (narrative, drill-down) -> Report Layout pattern
+- Need new data measures?
|  - Define DAX measures in semantic model (see dax SKILL.md)
+- Need to filter by user identity?
|  - Configure RLS roles (see RLS section below)
+- Need custom visual appearance?
|  - Create theme JSON (see Theming section)
+- Deploying to multiple environments?
   - Use deployment pipelines (Dev -> Test -> Prod)
   - See: powerbi-deployment SKILL.md
```

## PBIP Format (Required for Source Control)

Always use **PBIP format** instead of `.pbix` for any report stored in GitHub.

### Why PBIP

| Factor | .pbix | .pbip |
|--------|-------|-------|
| Source control diff | Binary blob - no diff | Folder of JSON/DAX files - fully diffable |
| Code review | Not possible | PR review on individual measures/visuals |
| Merge conflicts | Cannot merge | JSON merge with standard git tools |
| CI/CD pipeline | Manual publish only | Automated via pbi-tools |

### PBIP Folder Structure

```
reports/
+-- SalesReport.Report/
|   +-- report.json              # Pages, visuals, layout, filters
|   +-- StaticResources/
|       +-- SharedResources/
|           +-- BaseThemes/      # Custom theme JSON
+-- SalesReport.SemanticModel/
    +-- definition/
    |   +-- model.tmdl           # Tabular Model Definition Language
    |   +-- tables/              # One .tmdl file per table
    |   +-- relationships.tmdl   # All relationships
    |   +-- cultures/            # Localization
    +-- .pbi/
        +-- localSettings.json   # Local overrides - gitignored
```

### pbi-tools Commands

```powershell
# Extract .pbix to PBIP folder structure (one-time migration)
pbi-tools extract -pbixPath "SalesReport.pbix" -extractFolder "reports/SalesReport"

# Compile PBIP folder back to .pbix (for desktop testing)
pbi-tools compile -folder "reports/SalesReport" -outPath "dist/SalesReport.pbix"

# Validate PBIP structure (run in CI)
pbi-tools info -folder "reports/SalesReport"

# Watch for changes during development (auto-compile on save)
pbi-tools watch -folder "reports/SalesReport"
```

## Report Layout Patterns

### Multi-Page Report (Standard)

```
Page 1: Executive Summary
  - KPI cards (top row): Revenue, Margin %, Variance vs Budget
  - Trend line chart: 13-month rolling
  - Top-N table: Products by revenue

Page 2: Detail Analysis
  - Matrix: Rows = Region, Columns = Month, Values = Revenue
  - Decomposition tree or waterfall for variance

Page N: Filters / Slicers (hidden navigation page)
  - Sync slicers across all pages
```

**Principles:**
- Max 8 visuals per page (cognitive load)
- Consistent color palette via theme JSON
- Slicer panel pattern: use bookmark + selection pane to show/hide
- Mobile layout: define separately for each page

### Dashboard (Tiles-Based)

Dashboards in Power BI Service are pinned tiles from reports. They do NOT support slicers or drill-through.

```
Use dashboards for:
- Executive real-time KPI monitoring
- Pinned Q&A visuals
- Cross-report tile aggregation

Use reports for:
- Interactive exploration
- Drill-through
- Filtering and slicing
```

## Row-Level Security (RLS)

### Static RLS

```dax
-- Role: "Region Manager"
-- Table: dim_geography
[Region] = "North"
```

### Dynamic RLS (Username-Based)

```dax
-- Role: "User Region Filter"
-- Table: dim_user_region
-- Filters dim_geography through relationship
[user_email] = USERPRINCIPALNAME()
```

### RLS Configuration in TMDL

```tmdl
role 'Region Manager'
    modelPermission: read

    tablePermission dim_geography
        filterExpression = [Region] = "North"
```

### RLS Testing

```powershell
# Test RLS role via pbi-tools (requires dataset published to service)
# Validate via Power BI Desktop: Modeling -> View As -> Roles
```

**Rules:**
- Always test RLS with at least one user who SHOULD and one who SHOULD NOT see data
- Use security groups, not individual email addresses, for production RLS mapping
- Document all roles in `docs/powerbi/RLS-MATRIX.md`

## Theming

Custom themes ensure brand consistency across all reports.

### Theme JSON Structure

```json
{
  "name": "PwC Brand Theme",
  "dataColors": [
    "#D04A02", "#EB8C00", "#FFB600",
    "#295477", "#299D8F", "#7D7D7D"
  ],
  "background": "#FFFFFF",
  "foreground": "#333333",
  "tableAccent": "#D04A02",
  "visualStyles": {
    "*": {
      "*": {
        "fontFamily": [{"value": "Arial"}],
        "fontSize": [{"value": 10}]
      }
    },
    "card": {
      "*": {
        "calloutValue": [{"fontSize": {"value": 28}}]
      }
    }
  }
}
```

Store theme files at: `reports/{ReportName}.Report/StaticResources/SharedResources/BaseThemes/`

## Bookmarks

Use bookmarks for show/hide slicer panels and guided narrative navigation.

```json
// report.json bookmark definition (managed by Power BI Desktop)
// Name bookmarks descriptively: "Slicer_Open", "Slicer_Closed", "View_YTD", "View_MTD"
// Group related bookmarks: Navigation group, Filter group
```

**Rules:**
- Always create bookmarks in pairs (open/closed, on/off)
- Use the Selection Pane to name all visuals before creating bookmarks
- Test bookmarks after any page layout change

## Visuals Selection Guide

| Scenario | Recommended Visual | Avoid |
|----------|--------------------|-------|
| Single metric vs target | KPI card or Gauge | Pie chart |
| Trend over time | Line chart | Bar chart for time series |
| Part-to-whole (< 5 categories) | Donut or bar | Pie with many slices |
| Comparison across dimensions | Clustered bar | 3D charts |
| Rankings / top-N | Bar chart sorted desc | Tables without sorting |
| Hierarchical drill-down | Matrix or Decomposition tree | Nested pie charts |
| Geospatial | Filled map or Shape map | Bubble map for precise values |
| Many rows of data | Table with conditional formatting | Card visuals |

## Performance Guidelines

- Limit report pages to **< 15 visuals** combined across all pages rendered simultaneously
- Avoid high-cardinality slicers (> 10,000 members) - use search slicer or filter pane
- Use DirectLake or Import mode; avoid DirectQuery unless real-time is required
- Disable "Show items with no data" on visuals unless explicitly needed
- Use report-level filters instead of visual-level filters where possible
- Measure execution time with DAX Studio Performance Analyzer

## Core Rules

1. MUST use PBIP format for all reports committed to GitHub - never commit `.pbix` binaries
2. MUST define all measures in the semantic model - never as visual-level calculated fields
3. MUST document RLS roles in `docs/powerbi/RLS-MATRIX.md` when security is configured
4. MUST test reports with the target user persona (not the report author's permissions)
5. MUST apply a custom theme JSON for brand consistency
6. MUST NOT commit `.pbix` binary files to git (compile to `dist/` which is gitignored)
7. MUST NOT hardcode data source credentials in connection strings
8. SHOULD define mobile layout for any report shared on mobile devices
9. SHOULD use bookmark pairs (open/closed) for slicer panel show/hide patterns
10. SHOULD name all visuals in the Selection Pane before creating bookmarks

## Anti-Patterns

| Do Not | Do Instead |
|--------|------------|
| Commit `.pbix` binary to `reports/` | Use PBIP format; compile to `dist/` (gitignored) |
| Create measures in the visual pane | Create all measures in the semantic model |
| Use personal credentials in connections | Use parameters + Service Principal |
| Design without an audience persona | Define audience before choosing visual types |
| Skip mobile layout for exec reports | Define mobile layout on every summarised page |
| Use pie charts with > 5 slices | Use clustered bar sorted descending |
| Add RLS without testing | Test with explicit PASS/FAIL users every time |

## Reference Index

| Document | Description |
|----------|-------------|
| [references/rls-patterns.md](references/rls-patterns.md) | Static and dynamic RLS TMDL examples, testing checklist |
| [references/theme-patterns.md](references/theme-patterns.md) | Full theme JSON template with colour and font configurations |
| [references/bookmark-patterns.md](references/bookmark-patterns.md) | Slicer panel open/close and navigation bookmark patterns |

## Asset Templates

| File | Description |
|------|-------------|
| [assets/brand-theme.json](assets/brand-theme.json) | Starter theme JSON with brand colour placeholders |
| [assets/rls-matrix-template.md](assets/rls-matrix-template.md) | RLS documentation table template |
````
