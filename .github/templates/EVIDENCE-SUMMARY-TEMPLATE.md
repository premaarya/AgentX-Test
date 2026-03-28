<!-- Inputs: {issue_number}, {slice_name}, {author}, {date} -->

# Evidence Summary: ${slice_name}

**Issue**: #${issue_number}
**Checkpoint**: Work | Review
**Status**: Draft | Current | Superseded
**Author**: ${author}
**Date**: ${date}

---

## Implementation Evidence

- Changed files: {paths or summaries}
- Generated artifacts: {paths or summaries}
- Scope confirmation: {what changed vs what stayed untouched}

## Verification Evidence

- Tests run: {unit, integration, e2e, or other validation}
- Static checks: {lint, build, typecheck, or equivalent}
- Result summary: {pass, fail, partial, blocker}

## Runtime Evidence

- Real-surface observation: {UI path, API response, log trace, command output, or walkthrough}
- Durable proof: {stored output, linked artifact, or summarized observation}
- Remaining runtime gap: {empty if complete}

## Evaluator Findings

- Active findings: {link or summary}
- Requested next action: {what must change before the slice can advance}

## Review References

- Work contract: {path}
- Review artifact: {path}
- Durable findings: {path}

## Notes

- {Anything important for resumption, rollback, or follow-up review}