# ghost-skills

Shared Codex skills for projects in the legacy workspace.

## Repository layout

Each installable skill lives in `skills/<skill-name>/` and has a `SKILL.md` entrypoint. Optional skill-specific files stay inside that package: `agents/openai.yaml` for UI metadata, and `scripts/`, `references/`, or `assets/` only when needed.

## Skills

- [`markdown-pdf-mermaid`](skills/markdown-pdf-mermaid/): Convert Markdown to PDFs while preserving Mermaid diagrams, including sequence diagrams.

To add a skill, create a new package under `skills/`, validate its `SKILL.md`, and add it to this index.
