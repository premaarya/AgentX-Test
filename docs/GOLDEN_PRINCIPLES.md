# Golden Principles - Mechanical Rules

> Rules that are enforced mechanically by linters, validators, and agents.
> Every rule here MUST be automatically checkable -- no subjective judgments.

---

## Frontmatter Consistency

Every customization file MUST have valid YAML frontmatter between `---` delimiters.

| File Type | Required Fields | Validated By |
|-----------|----------------|--------------|
| `.agent.md` | `description`, `model` | `validate-frontmatter.ps1` |
| `.instructions.md` | `description`, `applyTo` | `validate-frontmatter.ps1` |
| `SKILL.md` | `name` (kebab-case), `description` (50+ chars) | `validate-frontmatter.ps1` |

**Rule**: No file passes review without valid frontmatter.

---

## Skill Structure Compliance

Every skill MUST follow the directory structure:

```
.github/skills/{category}/{skill-name}/
  SKILL.md              # Required. <5K tokens.
  scripts/*.ps1         # Optional. Automation scripts.
  references/*.md       # Optional. Extended docs.
  assets/               # Optional. Templates, configs.
```

**Rule**: `skill-name` MUST be kebab-case. SKILL.md MUST be under 5,000 tokens.

---

## Instruction File Token Limits

Instruction files are auto-loaded into every matching conversation. Large files waste context budget.

| File | Max Size | Enforcement |
|------|----------|-------------|
| `.instructions.md` | ~3,000 tokens | Manual review (no automated check yet) |
| `copilot-instructions.md` | ~2,000 tokens | Manual review |

**Rule**: If an instruction file exceeds its limit, extract the excess into a skill or a referenced doc.

---

## Template Input Requirements

Every template MUST declare its input variables in a comment block at the top:

```markdown
<!-- Inputs: {issue_number}, {title}, {date}, {author} -->
```

**Rule**: Templates without declared inputs cannot be used by agents reliably.

---

## Doc Count Accuracy

Documented counts of agents, skills, instructions, templates, and prompts MUST match actual file counts.

| Count | Source of Truth | Documented In |
|-------|----------------|---------------|
| Agents | `ls .github/agents/**/*.agent.md` | AGENTS.md, README.md, Skills.md |
| Skills | `ls .github/skills/**/SKILL.md` | Skills.md, AGENTS.md |
| Instructions | `ls .github/instructions/*.instructions.md` | AGENTS.md |
| Templates | `ls .github/templates/*-TEMPLATE.md` | AGENTS.md |
| Prompts | `ls .github/prompts/*.prompt.md` | AGENTS.md |

**Rule**: Use the `doc-gardener.prompt.md` prompt periodically to verify counts.

---

## Cross-Reference Validity

Every internal `[link](path)` in Markdown files MUST point to an existing file.

**Rule**: Broken links are CI failures. Run link validation before commits.

---

## Commit Message Format

Every commit MUST follow:

```
type: description (#issue-number)
```

- `type` is one of: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`
- `#issue-number` is optional in Local Mode (unless `enforceIssues` is `true`)
- Description is imperative mood, lowercase start, no period

**Rule**: CI or pre-commit hook rejects non-conforming messages in GitHub Mode.

---

## Security Non-Negotiables

These rules are absolute -- no exceptions, no bypass:

1. **No hardcoded secrets** -- secrets in env vars or Key Vault only
2. **Parameterized SQL** -- NEVER concatenate user input into SQL strings
3. **Input validation** -- all external inputs validated at system boundaries
4. **Dependency scanning** -- `npm audit` / `dotnet list package --vulnerable` before merge
5. **Blocked commands** -- `rm -rf /`, `git reset --hard`, `git push --force`, `DROP DATABASE/TABLE`, `TRUNCATE`

**Rule**: Any violation blocks merge. No exceptions.

---

## ASCII-Only Rule

All source files MUST use ASCII characters only (U+0000-U+007F).

- No emoji, Unicode symbols, box-drawing characters, or smart quotes
- Use `[PASS]`/`[FAIL]` not checkmarks/crosses
- Use `->` not arrows, `-` not em-dashes

**Rule**: CI can enforce via `grep -P '[\x80-\xFF]'` on all tracked files.

---

## Test Coverage Gate

- **80% minimum** code coverage for all production code
- **Test pyramid**: 70% unit, 20% integration, 10% e2e
- **No compiler warnings or linter errors** in CI

**Rule**: PR blocked if coverage drops below 80%.

---

## Error Handling Standards

- Catch **specific** exceptions (never bare `catch` or `except:`)
- Log with context (agent name, issue number, operation)
- Retry with exponential backoff for transient failures
- Fail fast on invalid input at system boundaries

**Rule**: Bare catch blocks are flagged by static analysis.

---

**See Also**: [AGENTS.md](../AGENTS.md) | [QUALITY_SCORE.md](QUALITY_SCORE.md) | [tech-debt-tracker.md](tech-debt-tracker.md)
