# Redesign the exporter panel to match the ai-slop "retro-cute" design system

Date: 2026-06-24
Status: approved (design), pending implementation

## Goal

Restyle the ChatGPT Markdown Exporter's injected UI (`src/content.ts`) so it visually
matches the [`kandotrun/ai-slop`](https://github.com/kandotrun/ai-slop) design system —
the "retro-cute" language (Shadcn structure × Bootstrap 2 texture) built on the brand
indigo `#4f46e5`. This is a bold visual + information-design refresh, but it preserves the
extension's core experience and privacy guarantees.

## Non-negotiables preserved (from `AGENTS.md`)

- Right-edge launcher → one tap exports the currently opened conversation as `.md`.
- No remote analytics / telemetry / external API calls / network requests.
- Minimal permissions. `src/manifest.ts` stays unchanged: `permissions: []`, host
  permissions limited to `https://chatgpt.com/*` and `https://chat.openai.com/*`.
- No bundled fonts / `web_accessible_resources` (decided: system fonts only).
- Extraction / scroll / markdown logic untouched — this is a presentation-layer change.

## Design decisions (confirmed with maintainer)

| Topic | Decision |
| --- | --- |
| Scope | Full visual + interaction redesign of the panel (keep export-only core UX) |
| Dark mode | Light **and** dark, following ChatGPT's active theme |
| Fonts | System font stack; `"Geist"`/`"Geist Mono"` only as the first fallback name |

## Design system tokens adopted (from ai-slop `src/client/styles/tokens.css` + `DESIGN.md`)

- **Primary**: indigo `#4f46e5` (`oklch(0.512 0.214 277)`), foreground white. Dark mode
  brightens it (`~oklch(0.58 0.20 277)`) so it reads on dark surfaces.
- **Semantic**: `--success` green `oklch(0.59 0.13 163)`, `--destructive` red
  `oklch(0.577 0.245 27.325)`.
- **Radius**: `--radius 0.625rem` (10px); card uses `--radius-xl` (14px); pills `999px`.
- **Retro-cute primitives**:
  - gloss overlay: `linear-gradient(to bottom, rgba(255,255,255,.22), rgba(255,255,255,0) 45%, rgba(0,0,0,.18))`
  - bevel highlight: `inset 0 1px 0 0 rgba(255,255,255,.6)`
  - sunken well: `inset 0 2px 5px rgba(40,40,80,.07)` (deeper in dark)
  - button shadow stack: inset hairline + inset top highlight + soft drop shadow
- **Motion**: `cubic-bezier(.4,0,.2,1)`, ~120–150ms; suppressed under `prefers-reduced-motion`.
- Fill via `background-color`; gloss via `background-image` (never the `background` shorthand,
  which would drop the gradient).

## Components (all inside the existing shadow DOM, no new DOM contract)

1. **Launcher tab** — vertical indigo glossy pill on the right edge, `↓` glyph + `MD保存`
   label, bevel + gloss + soft shadow; hover nudges left, active presses in.
2. **Card** — `--radius-xl`, 1px border, layered card shadow.
   - **Header**: indigo brand mark (rounded `M↓`), title `ChatGPT → Markdown`, a
     state-dependent subtitle, and a ghost close button. Header has the
     gloss-to-indigo-tint gradient + bevel-top.
   - **Body**: primary glossy indigo button (download icon + `この会話を .md 保存`), then a
     status region rendered as a **well**, then a privacy footer line with a shield glyph.
3. **Status well** — four states:
   - *idle*: explanatory hint.
   - *progress*: indigo glossy **progress bar** + `N 件検出 / M 回スクロール`.
   - *success*: green `✓ 保存完了` badge pill + count + mono filename.
   - *error*: red alert block with the message.
4. **Icons** — inline SVG (download, spinner, shield); no external assets.

## Theme resolution

A small pure helper `resolveTheme(doc): 'light' | 'dark'` decides the panel theme:

1. If `document.documentElement` signals dark (class contains `dark`, or
   `style.colorScheme` / `data-theme` indicates dark) → `dark`.
2. Else if it signals light explicitly → `light`.
3. Else fall back to `matchMedia('(prefers-color-scheme: dark)')`.

The content script applies the result as `data-theme` on the panel root, and keeps it in
sync via a `MutationObserver` on `<html>` (class / style / data-theme attrs) plus a
`matchMedia` change listener. All CSS lives in the shadow DOM; both themes are expressed as
CSS-variable overrides under `[data-theme="dark"]`.

## Accessibility

- Focus-visible rings on tab, primary button, and close (indigo `--focus-ring`).
- Color contrast ≥ 4.5:1 for text in both themes.
- `@media (prefers-reduced-motion: reduce)` removes transitions/transforms.
- `aria-label`s preserved; status region is a polite live region (`aria-live`).

## Architecture / separation of concerns

`src/content.ts` grows a few small, single-purpose, testable units instead of one big
`panelMarkup()` string:

- `resolveTheme(doc)` — pure theme decision (unit tested).
- `panelStyles()` — returns the `<style>` CSS string (token-driven).
- `panelMarkup()` — returns the markup; composes `panelStyles()`.
- `renderStatus(state)` — builds the well's inner HTML for idle/progress/success/error
  (pure, unit tested) so `runExport` just swaps status state.
- `installExporter()` / `runExport()` — wire events + theme observer (behavior unchanged
  except richer status states).

Keeping these as named exports lets the tests assert design-token presence without a real
browser, mirroring ai-slop's `brand-font.test.ts` / `landing-gradient-shimmer.test.ts`.

## Testing (TDD)

New `tests/panel-ui.test.ts` (jsdom), written test-first:

- `resolveTheme` returns `dark` for `<html class="dark">`, `light` for explicit light,
  and follows `matchMedia` otherwise.
- `panelStyles()` contains the indigo primary (`#4f46e5` / the indigo custom property),
  the gloss gradient, the bevel-top, the well inset shadow, the progress-bar rule, a
  `[data-theme="dark"]` block, a `focus-visible` ring, and a `prefers-reduced-motion` block.
- `renderStatus('success', …)` includes the success badge + filename; `'error'` includes
  the alert; `'progress'` includes the progress bar + counts.
- A guard test asserts the markup contains **no** `http(s)://` asset URLs and no
  `fetch`/external references (privacy regression guard).
- `tests/manifest.test.ts` stays green (manifest unchanged: `permissions: []`, two hosts).

Gate: `npm run check` (typecheck + tests + build) must pass.

## Out of scope (YAGNI / non-negotiable)

- No clipboard copy action (would imply clipboard handling; keep download-only).
- No bundled fonts, no `web_accessible_resources`, no manifest/permission changes.
- No changes to extraction, scrolling, markdown building, or download mechanics.
- No new host permissions, no settings/options page.
