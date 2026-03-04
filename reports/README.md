# Reports Directory

This directory stores Power BI reports and dashboards in **PBIP format** for GitHub source control.

## Structure

Each report lives in its own subfolder using the PBIP naming convention:

```
reports/
+-- {ReportName}.Report/          <- Report layer (pages, visuals, layout)
|   +-- report.json
|   +-- StaticResources/
|       +-- SharedResources/
|           +-- BaseThemes/
|               +-- *.json        <- Custom theme files
+-- {ReportName}.SemanticModel/   <- Semantic model (if report-specific)
    +-- definition/
        +-- model.tmdl
        +-- tables/
        +-- relationships.tmdl
        +-- roles/
```

## Rules

- MUST use PBIP format - never commit `.pbix` binary files here
- Add `.pbi/localSettings.json` to `.gitignore`
- See [docs/powerbi/SOURCE-CONTROL.md](../docs/powerbi/SOURCE-CONTROL.md) for full standards
- See [.github/instructions/powerbi.instructions.md](../.github/instructions/powerbi.instructions.md) for coding standards
