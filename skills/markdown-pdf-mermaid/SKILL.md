---
name: markdown-pdf-mermaid
description: Convert Markdown documents to review-ready PDFs while preserving Mermaid diagrams, including sequence diagrams. Use when Markdown is being exported, printed, or batch-converted to PDF.
---

# Markdown to PDF with Mermaid

Produce PDFs that preserve the source document's meaning and rendered content. A successful conversion includes rendered Mermaid diagrams, not their raw fenced source.

## Use the bundled exporter

1. Inspect repository instructions, source Markdown, existing conversion workflow, and current changes. Preserve unrelated edits and use an existing converter if it renders all required content correctly.
2. Locate this skill's package directory from the loaded `SKILL.md`. Use its `scripts/export-pdf.cjs` helper for normal conversions instead of reimplementing the pipeline.
3. If the package dependencies are missing, install them in the skill package with `npm install --prefix <skill-directory>`. This keeps the converter dependencies out of the target project. The package pins Node dependencies in `package.json` and `package-lock.json`.
4. Convert one Markdown file with `node <skill-directory>/scripts/export-pdf.cjs <file.md> [output.pdf] [--force]`. For a directory, pass the directory and optionally an output directory: `node <skill-directory>/scripts/export-pdf.cjs <markdown-directory> [pdf-directory] [--force]`. A file defaults to a sibling PDF; a directory defaults to `<input>/pdf/` and preserves its subdirectories. Use `--force` after clone/checkout or before distribution because Git does not preserve modification times.
5. The helper renders Mermaid blocks to SVG before browser printing. It also normalizes common status emoji labels for portable display, retains external and in-document links, and removes machine-local file links while keeping their text.
6. Preserve Markdown source files. The helper writes only PDF output and skips current PDFs unless `--force` is supplied. Set `CHROME_BIN` or `MERMAID_CLI` only when the bundled browser/CLI is not discoverable; set `PUPPETEER_NO_SANDBOX=1` only in restricted container environments.

## Validation

- Run `npm test --prefix <skill-directory>` for the bundled rule and path tests.
- Confirm the expected PDF files exist and are non-empty. The helper checks PDF signatures and rejects local `file://` annotations.
- Inspect representative pages, including every Mermaid diagram type and `sequenceDiagram`; verify that diagrams are visible and legible. A valid PDF header alone does not prove visual correctness.
- Report the output location, conversion method, validation evidence, and any pages that could not be verified. Do not claim completion while Mermaid source is printed as code or diagrams are missing.

## Constraints

- Preserve source content and relative image assets through conversion.
- Check tracked or modified PDFs before overwriting; use `--force` only when regeneration is intended.
- Do not add dependencies to the target project for this skill. Do not publish a PR unless requested.
