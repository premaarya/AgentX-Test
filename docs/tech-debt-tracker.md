# Tech Debt Tracker

> Known gaps, deferred work, and planned improvements.
> Add items as they are discovered. Remove items when resolved.

---

## Active Debt

### High Priority

| ID | Area | Description | Impact | Added |
|----|------|-------------|--------|-------|
| TD-001 | VS Code Extension | Test coverage gaps in `agentic/`, `chat/`, and `memory/` modules | Regressions may go undetected | v8.0.0 |
| TD-002 | Bash CLI | `agentx.sh` missing parity with `agentx.ps1` (config, loop, workflow commands) | Linux/macOS users have reduced CLI functionality | v8.0.0 |
| TD-003 | Documentation | No automated link validation in CI -- broken cross-references can ship | Agents follow dead links, waste context | v8.0.0 |
| TD-004 | Documentation | No automated doc count validation in CI -- counts can drift from reality | Agents given wrong counts, confusion in routing | v8.0.0 |

### Medium Priority

| ID | Area | Description | Impact | Added |
|----|------|-------------|--------|-------|
| TD-005 | Preview Agents | 7 internal sub-agents (GitHub Ops, ADO Ops, etc.) need field-testing hardening | Edge cases may cause unexpected behavior | v8.0.0 |
| TD-006 | Memory System | Git-backed observation store untested at scale (>1000 observations) | Performance degradation possible in long-lived repos | v8.0.0 |
| TD-007 | Instruction Tokens | No automated token count enforcement for instruction files | Oversized instructions waste context budget | v8.0.0 |
| TD-008 | Template Inputs | Not all templates declare `<!-- Inputs: -->` comment blocks | Agents may fill templates incorrectly | v8.0.0 |

### Low Priority

| ID | Area | Description | Impact | Added |
|----|------|-------------|--------|-------|
| TD-009 | Domain Skills | Only 5 domain verticals (oil & gas, financial, audit, tax, legal) | Limited domain coverage for consulting agents | v8.0.0 |
| TD-010 | COMPARISON-REPORT | Point-in-time comparison document will go stale | Misleading comparisons over time | v8.0.0 |
| TD-011 | README | Missing badges (CI status, coverage, version) and screenshots | Less professional first impression | v8.0.0 |

---

## Resolved Debt

| ID | Area | Description | Resolved In | Resolution |
|----|------|-------------|-------------|------------|
| TD-R01 | AGENTS.md | Monolithic 920-line file crowding agent context | v8.0.0 | Split into slim AGENTS.md + docs/WORKFLOW.md |
| TD-R02 | Documentation | Stale agent/skill/template counts across 4 files | v8.0.0 | Audited and fixed all counts (commit 3850f1e) |
| TD-R03 | Frontmatter | validate-frontmatter.ps1 had terse error messages | v8.0.0 | Added remediation instructions to all error messages |

---

## How to Add Debt

When you discover a gap or defer work, add a row to the appropriate priority section:

```markdown
| TD-NNN | Area | Description | Impact | Added |
```

When resolving debt, move the row to the Resolved section with the version and resolution description.

---

**See Also**: [QUALITY_SCORE.md](QUALITY_SCORE.md) | [GOLDEN_PRINCIPLES.md](GOLDEN_PRINCIPLES.md) | [AGENTS.md](../AGENTS.md)
