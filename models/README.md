# Models Directory

This directory stores shared Power BI semantic models in **PBIP format** for GitHub source control.

Use this directory for semantic models that are shared across multiple reports. Report-specific models live alongside their report in the `reports/` directory.

## Structure

```
models/
+-- {ModelName}.SemanticModel/
    +-- definition/
    |   +-- model.tmdl             <- Top-level model properties
    |   +-- tables/
    |   |   +-- {TableName}.tmdl   <- One file per table (columns, measures, partitions)
    |   +-- relationships.tmdl     <- All model relationships
    |   +-- cultures/              <- Localization (optional)
    |   +-- roles/                 <- RLS role definitions
    +-- .pbi/                      <- GITIGNORED - local settings only
        +-- localSettings.json
```

## Rules

- MUST use PBIP / TMDL format - never commit `.bim` or `.pbix` binary files here
- Add `.pbi/localSettings.json` to `.gitignore`
- Document all RLS roles in [docs/powerbi/RLS-MATRIX.md](../docs/powerbi/RLS-MATRIX.md)
- See [docs/powerbi/SOURCE-CONTROL.md](../docs/powerbi/SOURCE-CONTROL.md) for full standards
- See [.github/skills/languages/dax/SKILL.md](../.github/skills/languages/dax/SKILL.md) for DAX standards
