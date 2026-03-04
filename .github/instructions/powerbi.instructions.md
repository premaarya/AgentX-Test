---
description: 'Power BI development standards for reports, semantic models, and dashboards in PBIP format. Covers DAX conventions, Power Query rules, RLS patterns, theme standards, and pbi-tools usage.'
applyTo: "**/*.pbix, **/*.pbip, **/*.pbit, **/*.dax, **/reports/**, **/models/**, **/dashboards/**"
---

# Power BI Development Standards

## File Format

- MUST use PBIP format (folder structure) for all reports committed to GitHub - NEVER commit `.pbix` binary files to git
- `.pbix` files belong in `dist/` (generated, gitignored) or Git LFS only
- PBIP report folder: `reports/{ReportName}.Report/`
- PBIP semantic model folder: `models/{ModelName}.SemanticModel/` or `reports/{ReportName}.SemanticModel/`
- Add to `.gitignore`: `.pbi/localSettings.json`, `dist/*.pbix`, `**/.pbi/`

## DAX Standards

- MUST use `VAR`/`RETURN` pattern for all measures with more than one intermediate value
- MUST use `DIVIDE(numerator, denominator, 0)` - never the `/` operator
- MUST define all measures in the semantic model - never as visual-level calculated fields
- MUST mark the Date table (`Table Tools -> Mark as date table`) before using any time intelligence
- SHOULD use display folders: `KPI/`, `Time Intelligence/`, `Helpers/`
- SHOULD prefix helper/base measures with `_` and hide them from Report View
- SHOULD prefix percentage measures with `%`
- Format all DAX using DAX Formatter rules (one argument per line for 3+ args, 4-space indent)

```dax
-- CORRECT
Gross Margin % =
    VAR revenue = SUM(fact_sales[amount])
    VAR cogs    = SUM(fact_sales[cost])
    RETURN
        DIVIDE(revenue - cogs, revenue, 0)

-- INCORRECT
GM% = (SUM(fact_sales[amount]) - SUM(fact_sales[cost])) / SUM(fact_sales[amount])
```

## Power Query (M) Standards

- MUST set explicit column data types at the final step of every query
- MUST remove unused columns as early as possible (reduces data transfer)
- MUST verify query folding for filter steps on tables with > 100K rows (right-click step -> View Native Query)
- MUST use `RangeStart`/`RangeEnd` DateTime parameters for incremental refresh fact tables
- MUST NOT use `Table.Buffer()` except as a documented last resort
- MUST NOT enable load on staging/helper queries (right-click query -> uncheck "Enable Load")
- SHOULD use named M function queries (`fn*`) for shared transformation logic
- Step names MUST be descriptive (not "Step1", "Custom1")

## Semantic Model Structure

- Star schema preferred: fact tables + dimension tables, no many-to-many unless unavoidable
- Relationships: define cross-filter direction explicitly (single preferred, bidirectional only when justified)
- TMDL files live in `models/{ModelName}.SemanticModel/definition/`
- One `.tmdl` file per table in `tables/` subfolder
- RLS roles defined in `roles/` subfolder and documented in `docs/powerbi/RLS-MATRIX.md`

## Report Layout Standards

- Max 8 visuals per page (cognitive load limit)
- Apply custom brand theme JSON - stored at `reports/{Name}.Report/StaticResources/SharedResources/BaseThemes/`
- Page names MUST be descriptive (not "Page 1", "Page 2")
- Use slicer panel pattern with bookmarks for show/hide (not always-visible slicer bars)
- Define mobile layout for any report shared via Power BI mobile
- Sync slicers across pages using "Sync Slicers" pane

## RLS Rules

- MUST test each RLS role with at least one PASS and one FAIL user scenario
- MUST use `USERPRINCIPALNAME()` for dynamic RLS (not `USERNAME()`)
- MUST use security groups (not individual email addresses) for production role membership
- MUST document all roles in `docs/powerbi/RLS-MATRIX.md`

## pbi-tools Usage

```powershell
# Validate PBIP structure (run before every commit)
pbi-tools info -folder "reports/{ReportName}"

# Compile to .pbix for local testing
pbi-tools compile -folder "reports/{ReportName}" -outPath "dist/{ReportName}.pbix" -overwrite

# Extract existing .pbix to PBIP (migration)
pbi-tools extract -pbixPath "legacy.pbix" -extractFolder "reports/LegacyReport"
```

## Deployment Rules

- MUST NOT publish directly to Production - promote through Dev -> Test -> Prod deployment pipeline
- MUST authenticate as Service Principal (never personal credentials) in CI/CD
- MUST store all credentials in GitHub Secrets or Azure Key Vault
- MUST poll import and refresh API status before marking deployment successful
- MUST document all workspace GUIDs in `docs/powerbi/WORKSPACES.md`

## File Location Conventions

| Artifact | Path |
|----------|------|
| PBIP reports | `reports/{ReportName}.Report/` |
| Semantic models | `models/{ModelName}.SemanticModel/` |
| Compiled .pbix (CI output) | `dist/` (gitignored) |
| Theme JSON files | `reports/{Name}.Report/StaticResources/SharedResources/BaseThemes/` |
| RLS documentation | `docs/powerbi/RLS-MATRIX.md` |
| Workspace registry | `docs/powerbi/WORKSPACES.md` |
| Deployment scripts | `scripts/deploy/powerbi/` |
