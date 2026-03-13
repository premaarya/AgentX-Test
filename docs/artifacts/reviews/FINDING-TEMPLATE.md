<!-- Inputs: {finding_id}, {title}, {source_review}, {source_issue}, {date}, {author} -->

---
id: ${finding_id}
title: ${title}
source_review: ${source_review}
source_issue: ${source_issue}
severity: medium
status: Backlog
priority: p2
owner: unassigned
promotion: recommended
suggested_type: story
labels: type:story,needs:changes
dependencies:
evidence:
backlog_issue:
created: ${date}
updated: ${date}
---

# Review Finding: ${title}

## Summary

{Describe the finding and why it matters.}

## Impact

- {Explain the user, system, or workflow impact.}

## Recommended Action

- {Describe the concrete follow-up needed.}

## Promotion Notes

- {Explain whether this should stay review-only, be recommended, or be required for promotion.}