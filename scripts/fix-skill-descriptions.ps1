#!/usr/bin/env pwsh
# Fix all skill descriptions: switch to single quotes + add WHEN triggers
# Run from repo root

$skillsRoot = Join-Path $PSScriptRoot ".." ".github" "skills"

# Map: skill path relative to skills root → new description (single-quoted, WHAT + WHEN + KEYWORDS)
$descriptions = @{
    "ai-systems\ai-agent-development" = "Build production-ready AI agents with Microsoft Foundry and Agent Framework. Use when creating AI agents, selecting LLM models, implementing agent orchestration, adding tracing/observability, or evaluating agent quality. Covers agent architecture, model selection, multi-agent workflows, and production deployment."
    "ai-systems\prompt-engineering" = "Write effective prompts for AI coding agents. Use when crafting system prompts, implementing chain-of-thought reasoning, building few-shot examples, adding guardrails, configuring tool use, or designing agentic prompt patterns. Covers CoT, few-shot, guardrails, and function calling."
    "ai-systems\skill-creator" = "Create, validate, and maintain AgentX skills following the agentskills.io specification. Use when scaffolding a new skill, auditing skill compliance, restructuring for progressive disclosure, or adding scripts/references/assets to an existing skill."
    "architecture\api-design" = "Design robust REST APIs with proper versioning, pagination, error handling, rate limiting, and documentation. Use when creating new API endpoints, designing resource naming conventions, implementing pagination or filtering, adding rate limiting, or documenting APIs with OpenAPI/Swagger."
    "architecture\code-organization" = "Structure projects for maintainability and scalability with clean architecture and separation of concerns. Use when setting up a new project structure, refactoring monolithic codebases, implementing dependency injection, or organizing modules for team collaboration."
    "architecture\core-principles" = "Apply fundamental coding principles including SOLID, DRY, KISS, and common design patterns. Use when refactoring code for maintainability, reviewing design pattern usage, teaching SOLID principles, or evaluating code quality against engineering standards."
    "architecture\database" = "Design database operations including migrations, indexing strategies, transactions, connection pooling, and ORM best practices. Use when creating database schemas, writing migrations, optimizing slow queries, configuring connection pools, or choosing between ORM frameworks."
    "architecture\performance" = "Optimize application performance through async patterns, caching strategies, profiling, and resource management. Use when diagnosing slow endpoints, implementing caching layers, profiling CPU/memory bottlenecks, optimizing database queries, or setting up performance monitoring."
    "architecture\scalability" = "Design scalable systems with horizontal scaling, load balancing, caching, message queues, and stateless services. Use when planning system capacity, implementing load balancers, adding message queues for async processing, or designing stateless microservices architecture."
    "architecture\security" = "Implement production security practices covering OWASP Top 10, input validation, injection prevention, and secrets management. Use when hardening applications against vulnerabilities, implementing authentication/authorization, managing secrets, configuring HTTPS/TLS, or conducting security audits."
    "cloud\azure" = "Build scalable, secure, and reliable applications on Microsoft Azure cloud services. Use when deploying to Azure, configuring Azure compute/storage/database services, setting up Azure networking, implementing Azure security, or managing Azure costs and monitoring."
    "cloud\containerization" = "Apply container and orchestration best practices with Docker, Docker Compose, and Kubernetes. Use when writing Dockerfiles, creating docker-compose configurations, deploying to Kubernetes, optimizing container images, or troubleshooting container networking."
    "cloud\fabric-analytics" = "Build data engineering and analytics solutions on Microsoft Fabric — Lakehouse, Warehouse, Spark notebooks, data pipelines, and semantic models. Use when creating Fabric Lakehouses, writing PySpark notebooks, building data pipelines, designing semantic models, or querying OneLake storage."
    "cloud\fabric-data-agent" = "Build, configure, and validate conversational data agents on Microsoft Fabric Lakehouses using the Data Agent SDK. Use when creating Fabric data agents, configuring few-shot examples, managing Livy sessions, or validating agent responses against Lakehouse data."
    "cloud\fabric-forecasting" = "Build time-series forecasting pipelines on Microsoft Fabric — data preparation, profiling, clustering, feature engineering, and model training. Use when implementing demand forecasting, training LightGBM/Prophet models, engineering time-series features, or deploying prediction pipelines on Fabric."
    "design\ux-ui-design" = "Design user experiences with wireframing, prototyping, user flows, accessibility, and production-ready HTML prototypes. Use when creating wireframes, building interactive prototypes, designing user flows, implementing accessibility standards, or producing HTML/CSS design deliverables."
    "development\blazor" = "Build Blazor applications with Razor components, lifecycle management, and C# web patterns. Use when creating Blazor Server or WebAssembly apps, building Razor components, implementing state management, adding JavaScript interop, or optimizing Blazor performance."
    "development\code-review-and-audit" = "Conduct systematic code reviews and audits including automated checks, security audits, compliance verification, and review checklists. Use when reviewing pull requests, performing security audits, verifying coding standards compliance, or setting up automated code review workflows."
    "development\configuration" = "Implement configuration management patterns including environment variables, secrets, feature flags, and validation strategies. Use when setting up app configuration, managing environment-specific settings, implementing feature flags, storing secrets securely, or validating configuration at startup."
    "development\csharp" = "Write production-ready C# and .NET code following modern best practices. Use when building .NET applications, writing async/await code, using Entity Framework Core, implementing dependency injection, configuring nullable reference types, or optimizing C# performance."
    "development\data-analysis" = "Analyze structured data across CSV, JSON, SQL, and DataFrame workflows with exploration, transformation, and visualization. Use when exploring datasets with pandas/polars, running SQL queries on files with DuckDB, transforming data pipelines, or generating data visualizations."
    "development\dependency-management" = "Manage dependencies with version pinning, lock files, vulnerability scanning, and update strategies. Use when adding new packages, pinning dependency versions, scanning for vulnerabilities, updating outdated dependencies, or managing monorepo dependency graphs."
    "development\documentation" = "Write effective documentation including inline docs, README structure, API documentation, and code comments. Use when writing README files, documenting APIs, creating architecture decision records, adding inline code documentation, or setting up documentation tooling."
    "development\error-handling" = "Implement robust error handling with exceptions, retry logic, circuit breakers, and graceful degradation. Use when designing error handling strategies, implementing retry policies, adding circuit breakers, configuring timeouts, or building health check endpoints."
    "development\frontend-ui" = "Build frontend UIs with HTML5, CSS3, and Tailwind CSS following accessibility and performance best practices. Use when creating responsive layouts, styling with Tailwind CSS, implementing accessible forms, optimizing frontend performance, or building common UI patterns."
    "development\go" = "Write reliable, efficient Go code following idiomatic patterns and best practices. Use when building Go applications, implementing error handling with error wrapping, writing concurrent code with goroutines, designing Go interfaces, or structuring Go project layouts."
    "development\logging-monitoring" = "Implement observability patterns including structured logging, log levels, correlation IDs, metrics, and distributed tracing. Use when adding structured logging, implementing correlation IDs for request tracing, configuring metrics collection, setting up distributed tracing, or designing alerting rules."
    "development\mcp-server-development" = "Build Model Context Protocol (MCP) servers that expose tools, resources, and prompts to AI agents. Use when creating MCP servers in TypeScript or Python, defining MCP tools, implementing resource providers, or integrating MCP servers with AI agent workflows."
    "development\postgresql" = "Develop PostgreSQL databases with JSONB, arrays, full-text search, and performance optimization. Use when writing PostgreSQL queries, using JSONB operations, implementing full-text search, optimizing query performance with indexes, or configuring row-level security."
    "development\python" = "Write production-ready Python code following modern best practices. Use when building Python applications, adding type hints, writing async code, implementing error handling, testing with pytest, or structuring Python project layouts."
    "development\react" = "Build React applications with modern hooks, TypeScript, and performance best practices. Use when creating React components, implementing custom hooks, optimizing React rendering performance, managing application state, or testing React components."
    "development\rust" = "Build safe, concurrent, and performant systems with Rust. Use when writing Rust applications, implementing ownership and borrowing patterns, building concurrent code with threads/async, designing trait-based abstractions, or optimizing Rust performance."
    "development\sql-server" = "Develop SQL Server databases with T-SQL, stored procedures, indexing, and performance optimization. Use when writing T-SQL queries, creating stored procedures/functions, designing index strategies, optimizing query execution plans, or troubleshooting SQL Server performance."
    "development\testing" = "Apply testing strategies including test pyramid, unit/integration/e2e testing, and coverage requirements. Use when writing unit tests, designing integration test suites, implementing end-to-end tests, measuring test coverage, or setting up continuous testing pipelines."
    "development\type-safety" = "Apply type safety patterns including nullable types, validation, static analysis, and strong typing. Use when adding type annotations, implementing nullable reference types, validating inputs with value objects, configuring static analysis tools, or designing type-safe APIs."
    "development\version-control" = "Apply effective Git workflows including commit conventions, branching strategies, and pull request best practices. Use when writing commit messages, choosing branching strategies, configuring git hooks, resolving merge conflicts, or implementing semantic versioning."
    "operations\github-actions-workflows" = "Create GitHub Actions workflows, reusable workflows, custom actions, and workflow automation. Use when setting up CI/CD with GitHub Actions, creating reusable workflow templates, configuring workflow triggers, implementing matrix builds, or securing GitHub Actions secrets."
    "operations\release-management" = "Implement release management with versioning strategies, deployment strategies, rollback procedures, and release automation. Use when planning release pipelines, choosing deployment strategies (blue-green, canary, rolling), automating releases, or designing rollback procedures."
    "operations\remote-git-operations" = "Manage remote Git operations including GitHub, Azure DevOps, pull requests, CI/CD integration, and branch protection. Use when configuring remote repositories, setting up authentication, managing pull request workflows, integrating with CI/CD pipelines, or troubleshooting Git remote issues."
    "operations\yaml-pipelines" = "Build YAML-based CI/CD pipelines across Azure Pipelines and GitLab CI with progressive disclosure. Use when creating Azure DevOps YAML pipelines, configuring GitLab CI/CD, designing multi-stage pipelines, implementing pipeline templates, or managing pipeline secrets and variables."
}

$updated = 0
$errors = 0

foreach ($entry in $descriptions.GetEnumerator()) {
    $skillPath = Join-Path $skillsRoot $entry.Key "SKILL.md"
    if (-not (Test-Path $skillPath)) {
        Write-Host "SKIP: $($entry.Key) - file not found" -ForegroundColor Yellow
        $errors++
        continue
    }

    $content = Get-Content $skillPath -Raw
    $newDesc = $entry.Value

    # Replace description line - handle single-quoted, double-quoted, and unquoted
    # Match: description: "..." or description: '...' or description: ...
    if ($content -match '(?m)^description:\s*[''"].*$') {
        # Single or double quoted - replace the whole line
        $content = $content -replace '(?m)^description:\s*[''"].*[''"]?\s*$', "description: '$newDesc'"
    } elseif ($content -match '(?m)^description:\s*\S') {
        # Unquoted
        $content = $content -replace '(?m)^description:\s*\S.*$', "description: '$newDesc'"
    } else {
        Write-Host "SKIP: $($entry.Key) - no description line found" -ForegroundColor Yellow
        $errors++
        continue
    }

    Set-Content -Path $skillPath -Value $content -NoNewline -Encoding utf8NoBOM
    $updated++
    Write-Host "OK: $($entry.Key)" -ForegroundColor Green
}

Write-Host "`nUpdated: $updated, Errors: $errors" -ForegroundColor Cyan
