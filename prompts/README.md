# Prompt Assets

Store AI system prompts and reusable prompt templates here.

## Rules

- Keep prompts in Markdown files, not inline code strings.
- Version prompts with simple names such as `assistant-v1.md`.
- Put the purpose, expected model family, and key constraints at the top of each file.
- Keep prompt changes reviewable and pair them with evaluation evidence.

## Suggested Naming

- `assistant-v1.md`
- `retrieval-agent-v1.md`
- `summarizer-v2.md`

## Current Example

`assistant-v1.md` is currently a concrete AgentX issue-classification prompt used by the lightweight evaluation starter pack.

The files in `.github/prompts/` are repo automation prompts for AgentX itself. This directory is for product or application prompts under evaluation.