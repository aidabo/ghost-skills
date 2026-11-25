# ghost-skills

Shared Codex skills for projects in the legacy workspace.

## Repository layout

Each installable skill lives in `skills/<skill-name>/` and has a `SKILL.md` entrypoint. Optional skill-specific files stay inside that package: `agents/openai.yaml` for UI metadata, `scripts/` for executable helpers, `references/` for focused guidance, or `assets/` for generated-output resources. Helper dependencies belong in that skill package’s own `package.json` and lockfile, not in consuming projects.

## Skills

- [`markdown-pdf-mermaid`](skills/markdown-pdf-mermaid/): Convert Markdown to PDFs with the bundled exporter, preserving Mermaid diagrams, including sequence diagrams.

To add a skill, create a new package under `skills/`, validate its `SKILL.md`, and add it to this index.
