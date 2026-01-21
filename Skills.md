---
description: 'Production-ready guidelines for AI agents to build secure, scalable, maintainable systems. Covers 18 skills: coding principles, testing, security, architecture, configuration, and AI agent development.'
---

# Production Code Skills & Technical Guidelines

> **Purpose**: Production-ready guidelines for agents to build secure, scalable, maintainable systems.  
> **Usage**: Index for detailed skill documents. Read relevant skills before implementation.  
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) skills specification from [agentskills.io](https://agentskills.io/specification).

---

## 🎯 Quick Reference by Task Type

> **Purpose**: Find relevant skills fast based on what you're building.  
> **Usage**: Match your task below, load only the recommended skills to stay within token budget.

### API Implementation

**When**: Creating REST endpoints, controllers, HTTP APIs

**Load These Skills** (Total: ~18K tokens):
- [#09 API Design](skills/09-api-design.md) - REST patterns, versioning, rate limiting (5K)
- [#04 Security](skills/04-security.md) - Input validation, authentication, authorization (6K)
- [#02 Testing](skills/02-testing.md) - Controller tests, integration tests (4K)
- [#11 Documentation](skills/11-documentation.md) - XML docs, OpenAPI/Swagger (3K)

**Context Routing**: Controller implementation → Load Skills #09, #04, #02, #11

---

### Database Changes

**When**: Adding tables, migrations, queries, indexing

**Load These Skills** (Total: ~15K tokens):
- [#06 Database](skills/06-database.md) - Migrations, indexing, transactions (5K)
- [#04 Security](skills/04-security.md) - SQL injection prevention, parameterization (6K)
- [#02 Testing](skills/02-testing.md) - Repository tests, integration tests (4K)

**Context Routing**: Database/Repository files → Load Skills #06, #04, #02

---

### Security Feature

**When**: Authentication, authorization, encryption, secrets management

**Load These Skills** (Total: ~20K tokens):
- [#04 Security](skills/04-security.md) - OWASP Top 10, input validation, auth patterns (6K)
- [#10 Configuration](skills/10-configuration.md) - Secrets management, environment variables (5K)
- [#02 Testing](skills/02-testing.md) - Security tests, penetration test patterns (4K)
- [#13 Type Safety](skills/13-type-safety.md) - Nullable reference types, analyzers (3K)
- [#15 Logging](skills/15-logging-monitoring.md) - Security event logging, audit trails (2K)

**Context Routing**: Security-related files → Load Skills #04, #10, #02, #13, #15

---

### Bug Fix

**When**: Fixing errors, exceptions, crashes, incorrect behavior

**Load These Skills** (Total: ~10K tokens):
- [#03 Error Handling](skills/03-error-handling.md) - Exception patterns, retry logic (4K)
- [#02 Testing](skills/02-testing.md) - Regression tests, debugging patterns (4K)
- [#15 Logging](skills/15-logging-monitoring.md) - Log analysis, correlation IDs (2K)

**Context Routing**: Bug fix → Load Skills #03, #02, #15

---

### Performance Optimization

**When**: Improving speed, reducing latency, optimizing queries

**Load These Skills** (Total: ~15K tokens):
- [#05 Performance](skills/05-performance.md) - Async/await, caching, profiling (5K)
- [#06 Database](skills/06-database.md) - Query optimization, indexing (5K)
- [#02 Testing](skills/02-testing.md) - Performance tests, benchmarks (3K)
- [#15 Logging](skills/15-logging-monitoring.md) - Performance metrics, APM (2K)

**Context Routing**: Performance work → Load Skills #05, #06, #02, #15

---

### Documentation

**When**: Writing README, API docs, code comments, guides

**Load These Skills** (Total: ~5K tokens):
- [#11 Documentation](skills/11-documentation.md) - XML docs, README patterns, inline comments (5K)

**Context Routing**: Documentation only → Load Skill #11

---

### Code Review

**When**: Reviewing pull requests, auditing code quality

**Load These Skills** (Total: ~18K tokens):
- [#18 Code Review & Audit](skills/18-code-review-and-audit.md) - Review checklist, quality gates (5K)
- [#04 Security](skills/04-security.md) - Security audit checklist (6K)
- [#02 Testing](skills/02-testing.md) - Test quality review (4K)
- [#01 Core Principles](skills/01-core-principles.md) - SOLID, design patterns review (3K)

**Context Routing**: Code review → Load Skills #18, #04, #02, #01

---

### AI Agent Development

**When**: Building AI agents, LLM integration, orchestration

**Load These Skills** (Total: ~12K tokens):
- [#17 AI Agent Development](skills/17-ai-agent-development.md) - Foundry, Agent Framework, tracing (8K)
- [#04 Security](skills/04-security.md) - Prompt injection prevention, secrets (4K)

**Context Routing**: AI agent work → Load Skills #17, #04

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| **Language** | C# / .NET | 8.0+ |
| **Language** | Python | 3.11+ |
| **Backend** | ASP.NET Core | 8.0+ |
| **Database** | PostgreSQL + Npgsql | 16+ |
| **Frontend** | React | 18+ |
| **AI** | Microsoft Agent Framework | Latest |
| **AI** | Microsoft Foundry | Latest |

---

## Skills Index

### Foundation

| # | Skill | Core Focus |
|---|-------|------------|
| 01 | [Core Principles](skills/01-core-principles.md) | SOLID, DRY, KISS, Design Patterns |
| 02 | [Testing](skills/02-testing.md) | Unit (70%), Integration (20%), E2E (10%), 80%+ coverage |
| 03 | [Error Handling](skills/03-error-handling.md) | Exceptions, Retry Logic, Circuit Breakers |
| 04 | [Security](skills/04-security.md) | Input Validation, SQL Prevention, Auth/Authz, Secrets |

### Architecture

| # | Skill | Core Focus |
|---|-------|------------|
| 05 | [Performance](skills/05-performance.md) | Async, Caching, Profiling, DB Optimization |
| 06 | [Database](skills/06-database.md) | Migrations, Indexing, Transactions, Pooling |
| 07 | [Scalability](skills/07-scalability.md) | Load Balancing, Message Queues, Stateless Design |
| 08 | [Code Organization](skills/08-code-organization.md) | Project Structure, Separation of Concerns |
| 09 | [API Design](skills/09-api-design.md) | REST, Versioning, Rate Limiting |

### Development

| # | Skill | Core Focus |
|---|-------|------------|
| 10 | [Configuration](skills/10-configuration.md) | Environment Variables, Feature Flags, Secrets Management |
| 11 | [Documentation](skills/11-documentation.md) | XML Docs, README, API Docs, Inline Comments |
| 12 | [Version Control](skills/12-version-control.md) | Git Workflow, Commit Messages, Branching Strategy |
| 13 | [Type Safety](skills/13-type-safety.md) | Nullable Types, Analyzers, Static Analysis |
| 14 | [Dependencies](skills/14-dependency-management.md) | Lock Files, Security Audits, Version Management |
| 15 | [Logging & Monitoring](skills/15-logging-monitoring.md) | Structured Logging, Metrics, Distributed Tracing |

### Operations

| # | Skill | Core Focus |
|---|-------|------------|
| 16 | [Remote Git Ops](skills/16-remote-git-operations.md) | PRs, CI/CD, GitHub Actions, Azure Pipelines |
| 18 | [Code Review & Audit](skills/18-code-review-and-audit.md) | Automated Checks, Review Checklists, Security Audits, Compliance |

### AI Systems

| # | Skill | Core Focus |
|---|-------|------------|
| 17 | [AI Agent Development](skills/17-ai-agent-development.md) | Microsoft Foundry, Agent Framework, Orchestration, Tracing, Evaluation |

---

## Critical Production Rules

### Security (Always Enforce)
- ✅ Validate/sanitize ALL inputs → [#04](skills/04-security.md)
- ✅ Parameterize SQL queries (NEVER concatenate) → [#04](skills/04-security.md)
- ✅ Store secrets in env vars/Key Vault (NEVER hardcode) → [#10](skills/10-configuration.md)
- ✅ Implement authentication & authorization → [#04](skills/04-security.md)
- ✅ Use HTTPS everywhere in production

### Quality (Non-Negotiable)
- ✅ 80%+ code coverage with tests → [#02](skills/02-testing.md)
- ✅ Test pyramid: 70% unit, 20% integration, 10% e2e → [#02](skills/02-testing.md)
- ✅ XML docs for all public APIs → [#11](skills/11-documentation.md)
- ✅ No compiler warnings or linter errors
- ✅ Code reviews before merge

### Operations (Production-Ready)
- ✅ Structured logging with correlation IDs → [#15](skills/15-logging-monitoring.md)
- ✅ Health checks (liveness + readiness) → [↓](#health-checks)
- ✅ Graceful shutdown handling → [↓](#graceful-shutdown)
- ✅ CI/CD pipeline with automated tests → [#16](skills/16-remote-git-operations.md)
- ✅ Rollback strategy documented

### AI Agents (When Building AI Systems)
- ✅ Use Microsoft Foundry for production → [#17](skills/17-ai-agent-development.md)
- ✅ Enable OpenTelemetry tracing → [#17](skills/17-ai-agent-development.md)
- ✅ Evaluate with test datasets before deployment → [#17](skills/17-ai-agent-development.md)
- ✅ Monitor token usage and costs

---

## Health Checks

```csharp
// ASP.NET Core - Minimal Implementation
builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString, name: "database")
    .AddRedis(redisConnection, name: "cache");

app.MapHealthChecks("/health/live", new() { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new() { Predicate = c => c.Tags.Contains("ready") });
```

---

## Graceful Shutdown

```csharp
// ASP.NET Core - 30 second drain window
builder.Host.ConfigureHostOptions(opts => opts.ShutdownTimeout = TimeSpan.FromSeconds(30));
```

---

## Deployment Strategies

| Strategy | When to Use |
|----------|-------------|
| **Rolling** | Zero-downtime updates, gradual rollout |
| **Blue-Green** | Instant rollback needed, identical environments |
| **Canary** | Risk mitigation, gradual traffic shift (5% → 100%) |

---

## Pre-Deployment Checklist

**Code Quality**
- [ ] All tests passing (unit, integration, e2e)
- [ ] Code coverage ≥ 80%
- [ ] No compiler warnings or linter errors
- [ ] Security scan passed
- [ ] Dependencies updated and audited

**Configuration**
- [ ] Environment variables configured
- [ ] Secrets in Key Vault (not in code)
- [ ] Database migrations tested
- [ ] Feature flags configured

**Observability**
- [ ] Structured logging implemented
- [ ] Health checks working
- [ ] Metrics collection configured
- [ ] Alerts defined

**Deployment**
- [ ] CI/CD pipeline passing
- [ ] Rollback strategy documented
- [ ] Staging environment validated
- [ ] Monitoring dashboard ready

---

## Resources

**Docs**: [.NET](https://learn.microsoft.com/dotnet) • [ASP.NET Core](https://learn.microsoft.com/aspnet/core) • [PostgreSQL](https://www.postgresql.org/docs/)  
**Security**: [OWASP Top 10](https://owasp.org/www-project-top-ten/) • [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org)  
**Testing**: [xUnit](https://xunit.net) • [NUnit](https://nunit.org) • [Moq](https://github.com/moq)  
**AI**: [Agent Framework](https://github.com/microsoft/agent-framework) • [Microsoft Foundry](https://ai.azure.com)

---

**See Also**: [AGENTS.md](AGENTS.md) • [github/awesome-copilot](https://github.com/github/awesome-copilot)

**Skills Specification**: [agentskills.io/specification](https://agentskills.io/specification)

**Last Updated**: January 18, 2026

