---
name: markdown-pdf-mermaid
description: Convert Markdown documents to review-ready PDFs while preserving Mermaid diagrams, including sequence diagrams. Use when Markdown is being exported, printed, or batch-converted to PDF.
---

# Markdown to PDF with Mermaid

Produce PDFs that preserve the source document's meaning and rendered content. A successful conversion includes rendered Mermaid diagrams, not their raw fenced source.

## Workflow

1. Inspect the repository instructions, source Markdown, existing conversion workflow, and current working-tree changes. Preserve unrelated user edits and use the repository's existing converter when it renders all required content correctly.
2. Inventory Mermaid fenced blocks and other content that can disappear during conversion: relative images, tables, code blocks, links, and non-English text. Include every Mermaid diagram type found, especially `sequenceDiagram`.
3. Choose a renderer available in the environment. VS Code 1.121+ includes Mermaid rendering in its Markdown preview (`Mermaid Markdown Features`); opening a raw Markdown file or converting it with a renderer that lacks Mermaid support does not use that feature. VS Code's preview is a rendering surface, not by itself a batch PDF-export workflow. For repeatable batch conversion, use an available Markdown-to-HTML and browser-print pipeline that runs Mermaid and waits for diagrams to finish rendering before printing. Prefer installed tools and project conventions; do not add project dependencies without authorization.
4. Keep source files unchanged unless the user asks for source edits. Write PDFs alongside their Markdown sources or to the requested destination, following repository conventions.
5. Validate the output PDFs: confirm the expected files exist and are non-empty, inspect extracted text for key content, and render pages containing Mermaid blocks to images to verify the diagrams are visible and legible. Check sequence diagrams for participant labels, messages, and arrows. A PDF header or file size alone does not prove diagram rendering.
6. Report the conversion method, output location, validation evidence, and any diagrams or pages that could not be verified. Do not claim completion while Mermaid source is still printed as code or diagrams are missing.

## Constraints

- Preserve Markdown content and relative asset paths through conversion.
- Do not overwrite pre-existing user edits or PDFs without checking whether they are tracked or modified.
- Avoid network-dependent tooling when equivalent installed tooling is available. If an additional dependency is essential, explain the need and follow the repository's dependency policy.
- Do not create or publish a PR unless the user requested it; when requested, include only intended changes and report the PR URL or the concrete blocker.
