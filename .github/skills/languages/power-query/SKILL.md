````skill
---
name: "power-query"
description: 'Write Power Query M code for data transformation in Power BI semantic models. Covers query folding, incremental refresh, custom functions, error handling, parameters, and performance optimisation. Use when building data transformations in Power Query Editor, writing M expressions, designing incremental refresh policies, or optimising slow queries.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2026-03-03"
 updated: "2026-03-03"
compatibility:
 languages: ["m", "power-query"]
 frameworks: ["power-bi", "microsoft-fabric", "excel"]
 platforms: ["windows"]
prerequisites:
 - "Power BI Desktop for interactive query development"
 - "Access to source data system (SQL Server, APIs, files)"
 - "Understanding of source schema and available indexes"
allowed-tools: "read_file run_in_terminal semantic_search"
---

# Power Query (M Language)

> Write efficient, maintainable Power Query M code that folds to the source system and loads clean data into the semantic model.

## When to Use

- Connecting to SQL Server, APIs, SharePoint, Excel, or other data sources
- Cleaning and transforming raw data before loading to the model
- Defining incremental refresh policies for large tables
- Building reusable custom functions for shared transformation logic
- Parameterising queries for environment-specific connections

## Decision Tree

```
Building a Power Query transformation?
+- Source is a relational database (SQL Server, PostgreSQL)?
|  - Prioritise query folding (see Query Folding section)
+- Table has millions of rows refreshed daily?
|  - Configure incremental refresh policy
+- Same transformation pattern used in multiple queries?
|  - Extract to a reusable custom function
+- Connecting to different envs (Dev/Test/Prod)?
|  - Use query parameters for server/database names
+- Query errors from bad source data?
   - Use error handling patterns (try...otherwise)
```

## Core Concepts

### The M Pipeline - let/in

Every M query is a `let` expression that defines named steps, ending with `in`:

```m
let
    // Step 1: Connect to source
    Source = Sql.Database("sqlserver.company.com", "SalesDB"),

    // Step 2: Navigate to table
    RawOrders = Source{[Schema="dbo", Item="Orders"]}[Data],

    // Step 3: Filter rows (should fold to SQL WHERE)
    FilteredOrders = Table.SelectRows(RawOrders, each [Status] = "Completed"),

    // Step 4: Remove unused columns (reduces data transfer)
    SelectedColumns = Table.SelectColumns(FilteredOrders,
        {"OrderId", "CustomerId", "OrderDate", "Amount", "Status"}),

    // Step 5: Set correct data types (ALWAYS explicit)
    TypedTable = Table.TransformColumnTypes(SelectedColumns, {
        {"OrderId",    Int64.Type},
        {"CustomerId", Int64.Type},
        {"OrderDate",  type date},
        {"Amount",     Currency.Type},
        {"Status",     type text}
    })
in
    TypedTable
```

**Rules:**
- Every step has a descriptive name (not Step1, Step2)
- Final step is the result returned to the model
- Column types MUST be set explicitly - never rely on auto-detection

## Query Folding

**Query folding** means Power Query translates M steps into native SQL (or source query language) that runs on the server. Non-folding steps run in Power Query's local engine - much slower.

### Check if a Step Folds

Right-click any step in Power Query Editor -> "View Native Query"
- If enabled: step folds to SQL
- If greyed out: step does NOT fold (runs locally)

### Steps That Fold (SQL Server)

```m
Table.SelectRows(...)         -- Folds to WHERE
Table.SelectColumns(...)      -- Folds to SELECT column list
Table.Sort(...)               -- Folds to ORDER BY
Table.FirstN(...)             -- Folds to TOP N
Table.Skip(...)               -- Folds to OFFSET
Table.Join(...)               -- Folds to JOIN
Table.Distinct(...)           -- Folds to DISTINCT
Table.Group(...)              -- Folds to GROUP BY
```

### Steps That Break Folding

```m
Table.AddColumn(... each ...)          -- Custom row logic = no fold
Table.TransformColumns(... (x) => ...) -- Custom transform = no fold
Table.Buffer(...)                      -- Materialises in memory
Table.ReplaceErrors(...)               -- Error handling = no fold
```

**Pattern: Filter before transform to maximise folding**

```m
// CORRECT: Filter (folds) -> then transform (may not fold, but smaller dataset)
let
    Source     = Sql.Database("server", "db"),
    Orders     = Source{[Schema="dbo", Item="Orders"]}[Data],
    Filtered   = Table.SelectRows(Orders, each [Year] = 2025),     // folds
    WithPrefix = Table.AddColumn(Filtered, "Code", each "ORD-" & Text.From([OrderId]))  // local
in
    WithPrefix

// INCORRECT: Transform first (breaks folding for all subsequent steps)
let
    Source     = Sql.Database("server", "db"),
    Orders     = Source{[Schema="dbo", Item="Orders"]}[Data],
    WithPrefix = Table.AddColumn(Orders, "Code", each "ORD-" & Text.From([OrderId])),  // local - no fold
    Filtered   = Table.SelectRows(WithPrefix, each [Year] = 2025)  // also local now
in
    Filtered
```

## Parameters (Environment Management)

```m
// Parameter: ServerName (Text, required)
// Parameter: DatabaseName (Text, required)
// Parameters are defined in Power Query Manager -> Manage Parameters

// Using parameters in queries
let
    Source = Sql.Database(ServerName, DatabaseName),
    Orders = Source{[Schema="dbo", Item="Orders"]}[Data]
in
    Orders
```

For multi-environment deployment via GitHub Actions:

```powershell
# Update parameters post-publish via Power BI REST API
$body = @{
    updateDetails = @(
        @{ name = "ServerName";   newValue = $env:SQL_SERVER_NAME },
        @{ name = "DatabaseName"; newValue = $env:SQL_DATABASE_NAME }
    )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
    -Uri "https://api.powerbi.com/v1.0/myorg/groups/$WorkspaceId/datasets/$DatasetId/parameters" `
    -Method PATCH `
    -Headers @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" } `
    -Body $body
```

## Incremental Refresh

Configure for any table with > 1M rows or daily append-only pattern.

### Define RangeStart / RangeEnd Parameters

```
Parameter name: RangeStart (DateTime, required, value: 1/1/2020)
Parameter name: RangeEnd   (DateTime, required, value: 1/1/2030)
```

### Filter Table Using Parameters (MUST fold)

```m
let
    Source          = Sql.Database(ServerName, DatabaseName),
    SalesTable      = Source{[Schema="dbo", Item="fact_sales"]}[Data],

    // CRITICAL: This filter MUST fold to SQL for incremental refresh to work
    FilteredByDate  = Table.SelectRows(SalesTable, each
        [sale_date] >= RangeStart and [sale_date] < RangeEnd
    )
in
    FilteredByDate
```

### Incremental Refresh Policy (via TMDL)

```tmdl
// In semantic model definition (set via Power BI Desktop)
// Table: fact_sales
refreshPolicy: incremental
incrementalGranularity: day
incrementalPeriodCount: 30    // Refresh last 30 days incrementally
historicalGranularity: month
historicalPeriodCount: 36     // Keep 3 years of history (monthly partitions)
rollingWindowGranularity: year
rollingWindowPeriodCount: 3
```

**Rules:**
- RangeStart and RangeEnd parameter names are EXACT (case-sensitive)
- The date filter step MUST fold - verify with "View Native Query"
- Do NOT apply incremental refresh to small lookup/dimension tables

## Custom Functions

Extract repeated logic into reusable functions:

```m
// Function definition (separate query named "fnCleanPhone")
let
    fnCleanPhone = (rawPhone as text) as text =>
        let
            // Remove all non-digit characters
            DigitsOnly = Text.Select(rawPhone, {"0".."9"}),
            // Format as (XXX) XXX-XXXX
            Formatted  = if Text.Length(DigitsOnly) = 10
                         then "(" & Text.Start(DigitsOnly, 3) & ") "
                              & Text.Middle(DigitsOnly, 3, 3) & "-"
                              & Text.End(DigitsOnly, 4)
                         else rawPhone
        in
            Formatted
in
    fnCleanPhone

// Using the function
WithCleanPhone = Table.TransformColumns(Customers, {{"phone", fnCleanPhone}})
```

## Error Handling

```m
// Safe type conversion - returns null instead of error
SafeAmount =
    Table.TransformColumns(RawData, {
        {"amount", each try Number.FromText(_) otherwise null, type nullable number}
    })

// Row-level error capture (useful for debugging bad source data)
WithErrorFlag =
    Table.AddColumn(RawData, "ParseError",
        each try Number.FromText([amount])
            otherwise "ERROR: " & [amount],
        type text
    )

// Remove error rows (after logging them)
CleanRows = Table.SelectRows(WithErrorFlag, each [ParseError] <> null and
    not Text.StartsWith(Text.From([ParseError]), "ERROR"))
```

## Type Reference

| Power Query Type | DAX Type | SQL Type |
|------------------|----------|----------|
| `Int64.Type` | Whole Number | BIGINT, INT |
| `type number` | Decimal Number | FLOAT, DECIMAL |
| `Currency.Type` | Fixed Decimal | MONEY, DECIMAL(p,4) |
| `type text` | Text | VARCHAR, NVARCHAR |
| `type date` | Date | DATE |
| `type datetime` | Date/Time | DATETIME, DATETIME2 |
| `type logical` | True/False | BIT |

## Core Rules

1. MUST set explicit column types at the final step of every query - never rely on auto-detection
2. MUST remove unused columns as early as possible in the pipeline to reduce data transfer
3. MUST verify query folding for any filter applied to large tables (> 100K rows)
4. MUST use RangeStart/RangeEnd parameters for incremental refresh on fact tables
5. MUST name every M step descriptively (not Step1, Step2)
6. MUST NOT use `Table.Buffer()` except as a documented last-resort workaround for folding breaks
7. MUST NOT load staging/helper queries to the model (disable load via right-click -> "Enable Load" off)
8. MUST NOT use dynamic M expressions that reference cell values (breaks query folding entirely)
9. SHOULD enable query diagnostics during development to identify non-folding steps
10. SHOULD define one query per source table - avoid wide UNION queries in M

## Anti-Patterns

| Do Not | Do Instead |
|--------|------------|
| Apply custom columns before filters on large tables | Filter (folds) first, then transform (smaller dataset) |
| Leave column types as auto-detected | Set types explicitly at the final step |
| Load all source columns into model | Remove unused columns in an early step |
| Use `Table.Buffer()` for performance | Investigate folding break; fix the step that causes it |
| Define incremental refresh without verifying fold | Use "View Native Query" to confirm the date filter folds |
| Use the same M query for Dev, Test, and Prod servers | Use Query Parameters (ServerName, DatabaseName) |

## Reference Index

| Document | Description |
|----------|-------------|
| [references/query-folding-guide.md](references/query-folding-guide.md) | Per-connector folding rules, common fold-breaking patterns and fixes |
| [references/incremental-refresh.md](references/incremental-refresh.md) | Full incremental refresh setup: parameters, TMDL policy, partition strategy |
| [references/m-type-reference.md](references/m-type-reference.md) | Complete M type to DAX type to SQL type mapping table |

## Asset Templates

| File | Description |
|------|-------------|
| [assets/query-templates.m](assets/query-templates.m) | Starter M queries: SQL table, REST API with pagination, SharePoint list |
| [assets/incremental-refresh-policy.tmdl](assets/incremental-refresh-policy.tmdl) | Incremental refresh TMDL snippet (drop-in for any fact table) |
````
