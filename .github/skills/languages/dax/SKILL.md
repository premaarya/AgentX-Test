````skill
---
name: "dax"
description: 'Write production-quality DAX (Data Analysis Expressions) for Power BI semantic models. Covers measure authoring, CALCULATE context transitions, filter manipulation, time intelligence, iterator functions, variables, and performance optimization. Use when creating DAX measures, calculated columns, calculated tables, or RLS filter expressions in Power BI or Analysis Services.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2026-03-03"
 updated: "2026-03-03"
compatibility:
 languages: ["dax"]
 frameworks: ["power-bi", "analysis-services", "microsoft-fabric"]
 platforms: ["windows"]
prerequisites:
 - "Power BI Desktop or Tabular Editor for measure development"
 - "DAX Studio for query profiling and performance analysis"
 - "Semantic model with defined relationships (star or snowflake schema recommended)"
allowed-tools: "read_file run_in_terminal semantic_search"
---

# DAX (Data Analysis Expressions)

> Write correct, performant, and maintainable DAX measures for Power BI semantic models.

## When to Use

- Creating KPI measures (Revenue, Margin, YTD, MoM variance)
- Building time intelligence (YTD, LY, Rolling N periods)
- Writing RLS filter expressions
- Optimizing slow-running visuals via DAX performance profiling
- Defining calculated tables for bridge tables or date tables
- Using iterator functions (SUMX, AVERAGEX, RANKX)

## Decision Tree

```
What type of DAX are you writing?
+- Aggregation over a table (sum, count, average)?
|  +- Simple column sum -> SUM / COUNT / AVERAGE
|  - Row-by-row custom calculation -> SUMX / AVERAGEX / COUNTX
+- Time-based calculation?
|  +- Year-to-date -> TOTALYTD or CALCULATE + DATESYTD
|  +- Same period last year -> SAMEPERIODLASTYEAR
|  - Rolling N periods -> DATESINPERIOD
+- Filter manipulation?
|  +- Override existing filter -> CALCULATE + explicit filter
|  +- Remove all filters -> CALCULATE + ALL / REMOVEFILTERS
|  - Keep some filters -> CALCULATE + KEEPFILTERS
+- Ranking / top-N -> RANKX / TOPN
+- Conditional output -> IF / SWITCH
- Lookup single value -> LOOKUPVALUE / RELATED / SELECTEDVALUE
```

## Measure Naming Conventions

```
[Measure Name] - PascalCase, no underscores
[_Hidden Measure] - Prefix with _ for base/helper measures (hidden in report)
[#KPI Name] - Prefix with # for key metrics folder grouping
[% Percent Measure] - Prefix with % for ratio/percentage measures
```

Example display folders:
```
KPI/
  Revenue
  Gross Margin %
  Units Sold
Time Intelligence/
  Revenue YTD
  Revenue vs LY
  Revenue 3M Rolling
Helpers/   (hidden)
  _Revenue Base
  _Filter Safe Revenue
```

## Core Patterns

### Basic Aggregation

```dax
-- Simple sum (respects all report filters)
Revenue =
    SUM(fact_sales[amount])

-- Count of distinct customers
Customer Count =
    DISTINCTCOUNT(fact_sales[customer_id])

-- Conditional sum (only completed orders)
Revenue Completed =
    CALCULATE(
        SUM(fact_sales[amount]),
        fact_orders[status] = "Completed"
    )
```

### CALCULATE - The Most Important Function

CALCULATE evaluates an expression in a modified filter context.

```dax
-- Override filter: show total company revenue regardless of region slicer
Revenue All Regions =
    CALCULATE(
        SUM(fact_sales[amount]),
        REMOVEFILTERS(dim_geography[region])
    )

-- Add filter: revenue only for Product Category = "Hardware"
Hardware Revenue =
    CALCULATE(
        SUM(fact_sales[amount]),
        dim_product[category] = "Hardware"
    )

-- Multiple filters (AND logic)
US Hardware Revenue =
    CALCULATE(
        SUM(fact_sales[amount]),
        dim_product[category] = "Hardware",
        dim_geography[country] = "United States"
    )
```

### Variables (Always Use for Readability and Performance)

```dax
-- NEVER calculate the same expression twice - use VAR
Gross Margin % =
    VAR revenue = SUM(fact_sales[amount])
    VAR cogs    = SUM(fact_sales[cost])
    VAR margin  = revenue - cogs
    RETURN
        DIVIDE(margin, revenue, 0)

-- Variables also prevent double-evaluation of iterators
Top Customer Share =
    VAR total_revenue    = SUM(fact_sales[amount])
    VAR top_cust_revenue =
        CALCULATE(
            SUM(fact_sales[amount]),
            TOPN(10, dim_customer, [Revenue])
        )
    RETURN
        DIVIDE(top_cust_revenue, total_revenue, 0)
```

### DIVIDE vs Division Operator

```dax
-- CORRECT: DIVIDE handles divide-by-zero safely
Margin % = DIVIDE([Gross Margin], [Revenue], 0)

-- INCORRECT: Division operator throws error when denominator = 0
Margin % = [Gross Margin] / [Revenue]  -- May cause visual errors
```

### Iterator Functions (X Functions)

Use X functions when you need row-by-row calculation that cannot be expressed as a simple column aggregate.

```dax
-- Revenue weighted average price (unit price * quantity per row)
Weighted Avg Price =
    DIVIDE(
        SUMX(
            fact_sales,
            fact_sales[unit_price] * fact_sales[quantity]
        ),
        SUM(fact_sales[quantity]),
        0
    )

-- Rank customers by revenue (dense rank)
Customer Revenue Rank =
    RANKX(
        ALL(dim_customer),
        [Revenue],
        ,
        DESC,
        Dense
    )
```

## Time Intelligence

**Prerequisite**: A properly marked Date table is required.

### Date Table Requirements

```dax
-- Calculated table: continuous date range, no gaps
Date =
    ADDCOLUMNS(
        CALENDAR(DATE(2020, 1, 1), DATE(2030, 12, 31)),
        "Year",           YEAR([Date]),
        "Quarter",        "Q" & QUARTER([Date]),
        "Month Number",   MONTH([Date]),
        "Month Name",     FORMAT([Date], "MMMM"),
        "Week Number",    WEEKNUM([Date]),
        "Day Name",       FORMAT([Date], "dddd"),
        "Is Weekday",     WEEKDAY([Date], 2) <= 5,
        "Fiscal Year",    IF(MONTH([Date]) >= 7, YEAR([Date]) + 1, YEAR([Date]))
    )
-- Mark as Date Table in Power BI Desktop: Table Tools -> Mark as date table
```

### Common Time Intelligence Patterns

```dax
-- Year-to-date
Revenue YTD =
    TOTALYTD([Revenue], dim_date[Date])

-- Same period last year
Revenue LY =
    CALCULATE([Revenue], SAMEPERIODLASTYEAR(dim_date[Date]))

-- Year-over-year variance %
Revenue YoY % =
    VAR current = [Revenue]
    VAR ly      = [Revenue LY]
    RETURN
        DIVIDE(current - ly, ABS(ly), BLANK())

-- Rolling 3 months
Revenue 3M Rolling =
    CALCULATE(
        [Revenue],
        DATESINPERIOD(dim_date[Date], LASTDATE(dim_date[Date]), -3, MONTH)
    )

-- Month-to-date
Revenue MTD =
    TOTALMTD([Revenue], dim_date[Date])

-- Quarter-to-date
Revenue QTD =
    TOTALQTD([Revenue], dim_date[Date])

-- Period-over-period for custom fiscal year
Revenue Fiscal YTD =
    CALCULATE(
        [Revenue],
        DATESYTD(dim_date[Date], "6/30")  -- Fiscal year ends June 30
    )
```

## Conditional Logic

```dax
-- Simple IF
Revenue Status =
    IF([Revenue] >= [Budget Revenue], "On Track", "Behind")

-- SWITCH for multiple conditions (preferred over nested IFs)
Performance Band =
    SWITCH(
        TRUE(),
        [Revenue YoY %] >= 0.1,  "Excellent",
        [Revenue YoY %] >= 0.0,  "Good",
        [Revenue YoY %] >= -0.05, "Watch",
        "Critical"
    )

-- BLANK handling
Safe Revenue =
    IF(ISBLANK([Revenue]), 0, [Revenue])
```

## Filter Context Awareness

```dax
-- Detect if a slicer is active
Is Filtered by Region =
    ISFILTERED(dim_geography[region])

-- Count active filters on a column
Active Region Count =
    COUNTROWS(VALUES(dim_geography[region]))

-- Get single selected value (returns BLANK if multiple or none)
Selected Region =
    SELECTEDVALUE(dim_geography[region], "All Regions")

-- Check if a specific value is selected
Is North Selected =
    SELECTEDVALUE(dim_geography[region]) = "North"
```

## Performance Rules

| Pattern | Recommendation |
|---------|----------------|
| Storage Engine vs Formula Engine | Prefer SE operations (pure column operations) over FE (complex iterators) |
| SUMX on large tables | Materialize filtered table first with CALCULATETABLE/FILTER |
| Nested iterators | Avoid SUMX(table, SUMX(related_table, ...)) - creates Cartesian products |
| ALLSELECTED | Use sparingly - causes context transition issues and slow FE queries |
| Large VAR tables | Materialize in a calculated table or partition if reused across many measures |
| DISTINCTCOUNT | Expensive on high-cardinality columns - use VertiPaq compression |

```dax
-- SLOW: iterates all rows, then filters
Slow Measure =
    SUMX(fact_sales, IF(fact_sales[region] = "North", fact_sales[amount], 0))

-- FAST: filter first, then aggregate (SE can handle this)
Fast Measure =
    CALCULATE(SUM(fact_sales[amount]), fact_sales[region] = "North")
```

## DAX Formatting Standard

Always format DAX using the [DAX Formatter](https://www.daxformatter.com/) rules:
- One function argument per line when > 2 arguments
- Indent nested functions with 4 spaces
- RETURN on its own line for VAR blocks
- Line length: max 80 characters

```dax
-- Formatted correctly
Gross Margin % =
    VAR revenue =
        SUM(fact_sales[amount])
    VAR cogs =
        SUM(fact_sales[cost])
    RETURN
        DIVIDE(
            revenue - cogs,
            revenue,
            0
        )
```

## Core Rules

1. MUST use VAR/RETURN pattern for any measure with more than one intermediate calculation
2. MUST use DIVIDE() instead of `/` operator to prevent division-by-zero errors
3. MUST mark a Date table before using any time intelligence function
4. MUST define measures in the semantic model - never as visual-level calculated fields
5. MUST test measures at multiple filter granularities (total, year, month, day)
6. MUST format DAX using DAX Formatter rules (one argument per line for 3+ arguments)
7. MUST NOT use FILTER(ALL(table), ...) - use CALCULATE with direct column filter instead
8. SHOULD use display folders to organise measures (KPI, Time Intelligence, Helpers)
9. SHOULD prefix helper measures with `_` and hide them from report view
10. SHOULD use SELECTEDVALUE with a fallback label for single-value slicer measures

## Anti-Patterns

| Do Not | Do Instead |
|--------|------------|
| `[Revenue] / [Units]` | `DIVIDE([Revenue], [Units], 0)` |
| Duplicate expression in numerator and denominator | Extract to VAR before DIVIDE |
| Nested iterators SUMX(tbl, SUMX(...)) | Pre-filter with CALCULATETABLE, then SUMX |
| `FILTER(ALL(dim_product), ...)` as CALCULATE argument | `dim_product[category] = "X"` directly |
| Measures scattered with no display folder | Group by KPI, Time Intelligence, Helpers folders |
| Calculate same sub-expression twice | Always assign to VAR |
| Use ALLSELECTED inside nested iterators | Use ALLEXCEPT or REMOVEFILTERS instead |

## Reference Index

| Document | Description |
|----------|-------------|
| [references/time-intelligence-patterns.md](references/time-intelligence-patterns.md) | Full library: YTD, MTD, QTD, SPLY, rolling N periods, fiscal year, WoW |
| [references/performance-guide.md](references/performance-guide.md) | Storage Engine vs Formula Engine decisions, VertiPaq optimisation, DAX Studio profiling |
| [references/calculate-deep-dive.md](references/calculate-deep-dive.md) | Context transition, KEEPFILTERS, CROSSFILTER, expand/collapse patterns |

## Asset Templates

| File | Description |
|------|-------------|
| [assets/measure-templates.dax](assets/measure-templates.dax) | Starter measures: Revenue, Margin %, YoY %, YTD, Rolling 3M |
| [assets/date-table.dax](assets/date-table.dax) | Calculated Date table with fiscal year, week, and holiday flags |
````
