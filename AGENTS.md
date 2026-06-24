# Agent instructions

This repository is a privacy-sensitive Chrome extension for exporting the current AI Chat conversation (ChatGPT, Claude, or Gemini) to Markdown.

## Non-negotiables

- Do not add remote analytics, telemetry, external API calls, or backend dependencies.
- Keep Chrome permissions minimal. The manifest should not request broad browsing history, tabs, downloads, storage, or clipboard permissions unless the maintainer explicitly approves the exact reason.
- Target only supported chat hosts: `https://chatgpt.com/*`, `https://chat.openai.com/*`, `https://claude.ai/*`, and `https://gemini.google.com/*` unless the maintainer asks for another host.
- Preserve the core UX: right-edge tab on supported chat pages, one button to export the currently opened conversation as `.md`.
- Public-facing docs should describe the extension as generally usable, not as a personal-only tool.

## Development workflow

- Use strict TDD for behavior changes:
  1. Add/update a focused failing test.
  2. Run the focused test or `npm test` and confirm the expected failure.
  3. Implement the smallest passing change.
  4. Run `npm run check`.
- For supported chat DOM changes, add a fixture-like snippet to `tests/extract.test.ts` before changing selectors.
- Do not commit `node_modules/`, `dist/`, coverage output, packaged zips, or secrets.

## Verification commands

```bash
npm run typecheck
npm test
npm run build
npm run check
```
