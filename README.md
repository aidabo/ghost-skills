# ghost-skills

Shared Codex skills for projects in the legacy workspace.

## Repository layout

Each installable skill lives in `skills/<skill-name>/` and has a `SKILL.md` entrypoint. Optional skill-specific files stay inside that package: `agents/openai.yaml` for UI metadata, and `scripts/`, `references/`, or `assets/` only when needed.

## Skills

- [`markdown-pdf-mermaid`](skills/markdown-pdf-mermaid/): Convert Markdown to PDFs while preserving Mermaid diagrams, including sequence diagrams.
- [`product-intro-video`](skills/product-intro-video/): Make a narrated screen-introduction video (紹介動画) from app screenshots with Remotion, optional Wan3 lip-sync presenter, loudness normalisation and a frame check.

To add a skill, create a new package under `skills/`, validate its `SKILL.md`, and add it to this index.
