````skill
---
name: "github-compliance"
description: 'Query and assess GitHub Enterprise repository compliance against engineering standards. Covers branch protection rules, CODEOWNERS enforcement, required reviewers, status checks, Dependabot alerts, CodeQL scanning, repository visibility standards, issue/PR templates, and default branch naming. Produces compliance scores by repo, team, and organisation, with trend tracking. Use when building compliance dashboards, MCP tools that surface governance data, or automated enforcement workflows.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2026-03-03"
 updated: "2026-03-03"
compatibility:
 languages: ["typescript", "python", "graphql"]
 frameworks: ["github-rest-api", "github-graphql", "octokit"]
 platforms: ["windows", "linux", "macos"]
prerequisites:
 - "GitHub Enterprise Cloud or Server with API access"
 - "Personal Access Token (PAT) or GitHub App with scopes: read:org, repo, security_events, administration"
 - "Octokit.js (@octokit/rest) or @octokit/graphql for TypeScript clients"
 - "Node.js 18+ for TypeScript; Python 3.10+ with PyGithub for Python clients"
allowed-tools: "read_file create_file replace_string_in_file run_in_terminal semantic_search web_search"
---

# GitHub Enterprise Compliance

> Query and evaluate GitHub Enterprise repositories against a defined set of engineering standards guardrails, producing per-repo scores, team aggregates, and trend data for a real-time compliance dashboard.

## When to Use

- Building a compliance dashboard MCP tool that surfaces live GitHub data
- Auditing all repositories in a GitHub Enterprise org against guardrails
- Generating weekly compliance reports by team or business unit
- Detecting newly non-compliant repos after policy changes
- Measuring maturity trend over time as teams remediate findings

## Engineering Standards Guardrails

The following rules define the full compliance rule set for the Engineering Standards & Compliance Dashboard:

| Rule ID | Rule Name | Check Method | Standard |
|---------|-----------|--------------|----------|
| `BP-01` | Branch protection on default branch | REST branch protection API | Required: enabled |
| `BP-02` | Required reviewers configured | Branch protection: `required_pull_request_reviews` | Min 1 reviewer |
| `BP-03` | Required status checks enforced | Branch protection: `required_status_checks.strict` | At least 1 check |
| `BP-04` | Default branch naming standard | Repo: `default_branch` | `main` or `master` |
| `CO-01` | CODEOWNERS file present | Contents API: `CODEOWNERS`, `.github/CODEOWNERS`, `docs/CODEOWNERS` | File exists |
| `TM-01` | Issue templates present | Contents API: `.github/ISSUE_TEMPLATE/` | Min 1 template |
| `TM-02` | Pull request template present | Contents API: `.github/pull_request_template.md` | File exists |
| `SY-01` | Dependabot alerts enabled | Security API: `GET /repos/{owner}/{repo}/vulnerability-alerts` | Enabled (204) |
| `SY-02` | CodeQL analysis enabled | Code scanning API: `GET /repos/{owner}/{repo}/code-scanning/analyses` | At least 1 run |
| `VB-01` | Repository visibility | Repo: `visibility` | `private` (standard) |

## Decision Tree

```
Building a compliance check?
+- Single repo check (point-in-time)?
|  -> Use REST API: branch protection + contents + security endpoints
+- Org-wide scan (all repos)?
|  -> Use GraphQL for efficient batching (1 query = 100 repos)
+- Aggregating by team?
|  -> Get team repos via REST: GET /orgs/{org}/teams/{team_slug}/repos
+- Trend over time?
|  -> Store snapshots to DB or JSON files, compute delta per rule
+- Automated remediation (not just reporting)?
   -> Use REST PATCH endpoints to enable branch protection / Dependabot
```

## Data Fetching: REST API Patterns

### Repository List (paginated)

```typescript
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function listOrgRepos(org: string, includeArchived = false) {
  const repos: Octokit["repos"]["listForOrg"]["response"]["data"] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.repos.listForOrg,
    { org, type: "all", per_page: 100 }
  )) {
    for (const repo of response.data) {
      if (!includeArchived && repo.archived) continue;
      repos.push(repo);
    }
  }

  return repos;
}
```

### Branch Protection Check (BP-01, BP-02, BP-03)

```typescript
async function checkBranchProtection(owner: string, repo: string, branch: string) {
  try {
    const { data } = await octokit.rest.repos.getBranchProtection({
      owner, repo, branch,
    });
    return {
      enabled:            true,
      requiredReviewers:  data.required_pull_request_reviews?.required_approving_review_count ?? 0,
      requiredStatusChecks: data.required_status_checks?.checks?.length ?? 0,
      strictStatusChecks: data.required_status_checks?.strict ?? false,
      enforceAdmins:      data.enforce_admins?.enabled ?? false,
    };
  } catch (err: any) {
    if (err.status === 404) return { enabled: false };
    throw err;
  }
}
```

### CODEOWNERS Check (CO-01)

```typescript
async function checkCodeowners(owner: string, repo: string): Promise<boolean> {
  const candidates = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"];
  for (const path of candidates) {
    try {
      await octokit.rest.repos.getContent({ owner, repo, path });
      return true;
    } catch (err: any) {
      if (err.status !== 404) throw err;
    }
  }
  return false;
}
```

### Templates Check (TM-01, TM-02)

```typescript
async function checkTemplates(owner: string, repo: string) {
  let issueTemplates = false;
  let prTemplate = false;

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner, repo, path: ".github/ISSUE_TEMPLATE",
    });
    issueTemplates = Array.isArray(data) && data.length > 0;
  } catch { /* 404 = no templates */ }

  try {
    await octokit.rest.repos.getContent({
      owner, repo, path: ".github/pull_request_template.md",
    });
    prTemplate = true;
  } catch { /* 404 = no template */ }

  return { issueTemplates, prTemplate };
}
```

### Dependabot Check (SY-01)

```typescript
async function checkDependabot(owner: string, repo: string): Promise<boolean> {
  try {
    // Returns 204 if enabled, 404 if not
    await octokit.rest.repos.checkVulnerabilityAlerts({ owner, repo });
    return true;
  } catch (err: any) {
    if (err.status === 404) return false;
    throw err;
  }
}
```

### CodeQL Check (SY-02)

```typescript
async function checkCodeQL(owner: string, repo: string): Promise<boolean> {
  try {
    const { data } = await octokit.rest.codeScanning.listAlertsForRepo({
      owner, repo, per_page: 1,
    });
    return true; // if endpoint succeeds, code scanning is enabled
  } catch (err: any) {
    // 404 = code scanning not enabled; 403 = feature not available on this plan
    if (err.status === 404 || err.status === 403) return false;
    throw err;
  }
}
```

## Data Fetching: GraphQL Batch Pattern

Use GraphQL to scan multiple repos in a single API call (avoids N+1 REST calls):

```typescript
import { graphql } from "@octokit/graphql";

const gql = graphql.defaults({ headers: { authorization: `token ${process.env.GITHUB_TOKEN}` } });

async function batchCheckRepos(org: string, after?: string) {
  const query = `
    query OrgRepoCompliance($org: String!, $after: String) {
      organization(login: $org) {
        repositories(first: 100, after: $after, isArchived: false) {
          pageInfo { hasNextPage endCursor }
          nodes {
            name
            defaultBranchRef { name }
            visibility
            isPrivate
            codeowners: object(expression: "HEAD:.github/CODEOWNERS") { id }
            branchProtectionRules(first: 5) {
              nodes {
                pattern
                requiresApprovingReviews
                requiredApprovingReviewCount
                requiresStatusChecks
                requiredStatusChecks { context }
                isAdminEnforced
              }
            }
            vulnerabilityAlerts { totalCount }
          }
        }
      }
    }
  `;

  return gql<any>(query, { org, after });
}
```

## Compliance Scoring Model

Calculate rule-based compliance score per repository:

```typescript
interface ComplianceRule {
  id:       string;
  name:     string;
  pass:     boolean;
  severity: "critical" | "high" | "medium" | "low";
}

interface RepoComplianceResult {
  owner:          string;
  repo:           string;
  score:          number;        // 0-100
  compliant:      boolean;       // all critical + high rules pass
  rules:          ComplianceRule[];
  checkedAt:      string;        // ISO 8601
}

function calculateScore(rules: ComplianceRule[]): number {
  const weights = { critical: 30, high: 20, medium: 10, low: 5 };
  const totalWeight = rules.reduce((s, r) => s + weights[r.severity], 0);
  const passWeight  = rules.filter(r => r.pass).reduce((s, r) => s + weights[r.severity], 0);
  return totalWeight === 0 ? 100 : Math.round((passWeight / totalWeight) * 100);
}

function isCompliant(rules: ComplianceRule[]): boolean {
  // Compliant only if all critical and high severity rules pass
  return rules
    .filter(r => r.severity === "critical" || r.severity === "high")
    .every(r => r.pass);
}
```

### Rule Severity Classification

| Rule ID | Severity | Rationale |
|---------|----------|-----------|
| `BP-01` | critical | No branch protection = direct push to default branch |
| `BP-02` | critical | No required reviewers = unreviewed code merges |
| `SY-01` | critical | No Dependabot = known vulnerabilities undetected |
| `SY-02` | high | No CodeQL = code security issues undetected |
| `BP-03` | high | No required status checks = broken CI merged |
| `CO-01` | high | No CODEOWNERS = no ownership accountability |
| `VB-01` | high | Public/internal repo = unintended exposure |
| `BP-04` | medium | Non-standard branch name = tooling friction |
| `TM-01` | low | No issue templates = inconsistent reporting |
| `TM-02` | low | No PR template = inconsistent review context |

## Aggregation Patterns

### Team-Level Aggregation

```typescript
async function getTeamComplianceSummary(org: string, team: string) {
  // 1. Get all repos for team
  const teamRepos = [];
  for await (const page of octokit.paginate.iterator(
    octokit.rest.teams.listReposInOrg,
    { org, team_slug: team, per_page: 100 }
  )) {
    teamRepos.push(...page.data);
  }

  // 2. Check each repo
  const results = await Promise.allSettled(
    teamRepos.map(r => checkRepoCompliance(r.owner.login, r.name))
  );

  const passed = results.filter(
    r => r.status === "fulfilled" && r.value.compliant
  ).length;

  return {
    team,
    totalRepos:        teamRepos.length,
    compliantRepos:    passed,
    nonCompliantRepos: teamRepos.length - passed,
    compliancePercent: Math.round((passed / teamRepos.length) * 100),
    nonCompliantList:  results
      .filter(r => r.status === "fulfilled" && !r.value.compliant)
      .map((r: any) => ({ repo: r.value.repo, score: r.value.score, failedRules: r.value.rules.filter((x: any) => !x.pass) })),
  };
}
```

### Trend Tracking (Time Series)

```typescript
interface ComplianceTrendPoint {
  date:              string;  // ISO date
  org:               string;
  totalRepos:        number;
  compliantRepos:    number;
  compliancePercent: number;
  byRule:            Record<string, number>;  // rule_id -> pass rate %
}

// Store daily snapshots; query delta for trend visualisation
async function buildComplianceTrend(
  org: string,
  snapshots: ComplianceTrendPoint[]
): Promise<{ improving: boolean; delta7d: number; history: ComplianceTrendPoint[] }> {
  const sorted = snapshots.sort((a, b) => a.date.localeCompare(b.date));
  const latest  = sorted[sorted.length - 1];
  const week    = sorted[sorted.length - 8];
  return {
    improving: latest.compliancePercent > week.compliancePercent,
    delta7d:   latest.compliancePercent - (week?.compliancePercent ?? 0),
    history:   sorted.slice(-90),
  };
}
```

## MCP Tool Output Schema

Structure tool outputs consistently for dashboard consumption:

```typescript
// Consistent output shape for all compliance tools
interface ComplianceDashboardPayload {
  generatedAt:    string;          // ISO 8601
  org:            string;
  summary: {
    totalRepos:        number;
    compliantRepos:    number;
    compliancePercent: number;
    criticalFailures:  number;     // repos failing critical rules
  };
  byTeam:         TeamSummary[];      // sorted by compliancePercent ASC
  nonCompliant:   NonCompliantRepo[]; // sorted by score ASC
  byRule:         RuleSummary[];      // sorted by failureCount DESC
}
```

## PAT / GitHub App Scopes

| Scope | Required For |
|-------|-------------|
| `read:org` | List org repos, teams, members |
| `repo` | Branch protection, contents, code scanning |
| `security_events` | Vulnerability alerts, code scanning results |
| `administration` | Read admin-only branch protection settings |

For GitHub App (preferred over PAT in production):

```
Repository permissions:
  Administration: Read
  Contents: Read
  Metadata: Read
  Security events: Read
  Pull requests: Read (for PR template checks)
Organisation permissions:
  Members: Read
  Teams: Read
```

## Core Rules

1. MUST paginate all list API calls - never assume < 30 repos per org
2. MUST handle HTTP 404 gracefully for each check (repo may exist but feature disabled)
3. MUST use GitHub App credentials (not PAT) for production multi-org deployments
4. MUST NOT cache compliance results for more than 15 minutes in dashboard contexts (near real-time requirement)
5. MUST classify all rules by severity and apply the scoring model consistently
6. MUST store trend snapshots with ISO 8601 timestamps for reproducible history
7. MUST handle GitHub API rate limits: check `x-ratelimit-remaining` header; implement exponential backoff
8. SHOULD use GraphQL batching for org-wide scans (> 20 repos) to reduce API calls
9. SHOULD document required PAT scopes or GitHub App permissions in `docs/mcp-app/AUTH.md`
10. SHOULD expose a `dry_run` parameter on any remediation tool to preview changes before applying

## Anti-Patterns

| Do Not | Do Instead |
|--------|------------|
| Fetch repos one-by-one with REST | Use GraphQL batch query or paginated `listForOrg` |
| Use PAT for production multi-org | Register a GitHub App with least-privilege permissions |
| Ignore HTTP 404 on checks | Return `false` (feature not enabled) - log 404s separately |
| Return raw JSON from GitHub API | Map to typed `ComplianceRule[]` before MCP response |
| Assume `main` is the only valid default branch | Allow `master` as alternate in BP-04 check |
| Hard-code rule severity | Use configurable severity table (supports org overrides) |
| Skip rate limit handling | Check headers; back off when `x-ratelimit-remaining < 10` |

## Reference Index

| Document | Description |
|----------|-------------|
| [references/graphql-queries.graphql](references/graphql-queries.graphql) | Full GraphQL query library: org repos, branch protection, security settings batch scan |
| [references/rest-api-reference.md](references/rest-api-reference.md) | REST endpoint reference with required scopes and response shapes for all 10 compliance checks |
| [references/rate-limit-handling.md](references/rate-limit-handling.md) | GitHub API rate limit patterns: primary limit, secondary limit, retry-after, exponential backoff |

## Asset Templates

| File | Description |
|------|-------------|
| [assets/compliance-checker.ts](assets/compliance-checker.ts) | Full TypeScript compliance checker class implementing all 10 rules with scoring |
| [assets/compliance-report.md](assets/compliance-report.md) | Markdown report template: org summary, non-compliant repos table, rule breakdown |
| [assets/github-app-manifest.json](assets/github-app-manifest.json) | GitHub App manifest with minimum required permissions for compliance scanning |
````
