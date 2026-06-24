# ai-slop Retro-Cute UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the injected AI Chat Markdown Exporter panel to match the ai-slop "retro-cute" indigo design system, with light/dark theming and richer status states, while preserving the export-only core UX and all privacy non-negotiables.

**Architecture:** Extract all presentation (CSS string, markup, status rendering, theme resolution) into a new pure module `src/lib/panel.ts` so it is unit-testable without a browser and without triggering `content.ts`'s import-time `installExporter()`. `src/content.ts` becomes thin wiring: build markup, resolve+observe theme, handle clicks, drive a 4-state status model.

**Tech Stack:** TypeScript (strict), Vite + @crxjs, Vitest + jsdom. No new deps, no manifest changes, no network, system fonts only.

---

## File Structure

- **Create** `src/lib/panel.ts` — pure presentation: `StatusState`/`PanelTheme` types, `resolveTheme`, `panelStyles`, `renderStatus`, `panelMarkup`, `STATUS_SUBTITLE`. No DOM side effects.
- **Create** `tests/panel-ui.test.ts` — unit tests for the above (jsdom).
- **Modify** `src/content.ts` — import from `panel.ts`; rewrite `installExporter`/`runExport`/`setStatus`; add `watchTheme`; keep `downloadTextFile`.
- **Unchanged** `src/manifest.ts`, `src/lib/{extract,markdown,scroll,types}.ts`, existing tests.

Reference for exact token values: `docs/superpowers/specs/2026-06-24-ai-slop-retro-cute-ui-design.md`.

---

### Task 1: `resolveTheme` (pure theme detection)

**Files:**
- Create: `src/lib/panel.ts`
- Test: `tests/panel-ui.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveTheme } from '../src/lib/panel';

describe('resolveTheme', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
    vi.unstubAllGlobals();
  });

  it('returns dark when <html> has the dark class', () => {
    document.documentElement.classList.add('dark');
    expect(resolveTheme(document)).toBe('dark');
  });

  it('returns light when <html> has the light class', () => {
    document.documentElement.classList.add('light');
    expect(resolveTheme(document)).toBe('light');
  });

  it('honors data-theme="dark"', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(resolveTheme(document)).toBe('dark');
  });

  it('falls back to light when nothing indicates a theme', () => {
    expect(resolveTheme(document)).toBe('light');
  });

  it('follows prefers-color-scheme when present', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('dark'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    expect(resolveTheme(document)).toBe('dark');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/panel-ui.test.ts`
Expected: FAIL — cannot resolve `../src/lib/panel`.

- [ ] **Step 3: Create `src/lib/panel.ts` with the types and `resolveTheme`**

```ts
export type PanelTheme = 'light' | 'dark';

export type StatusState =
  | { kind: 'idle' }
  | { kind: 'progress'; messageCount: number; iteration: number }
  | { kind: 'success'; messageCount: number; filename: string }
  | { kind: 'error'; message: string };

export function resolveTheme(doc: Document): PanelTheme {
  const el = doc.documentElement;
  if (el) {
    if (el.classList.contains('dark')) return 'dark';
    if (el.classList.contains('light')) return 'light';
    const dataTheme = (el.getAttribute('data-theme') ?? '').toLowerCase();
    if (dataTheme.includes('dark')) return 'dark';
    if (dataTheme.includes('light')) return 'light';
    const scheme = (el.style?.colorScheme ?? '').toLowerCase();
    if (scheme.includes('dark') && !scheme.includes('light')) return 'dark';
    if (scheme.includes('light')) return 'light';
  }
  const view = doc.defaultView;
  if (view && typeof view.matchMedia === 'function') {
    try {
      if (view.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch {
      /* matchMedia unimplemented (e.g. bare jsdom) */
    }
  }
  return 'light';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/panel-ui.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/panel.ts tests/panel-ui.test.ts
git commit -m "feat: add resolveTheme for light/dark panel theming"
```

---

### Task 2: `renderStatus` (4-state status HTML)

**Files:**
- Modify: `src/lib/panel.ts`
- Test: `tests/panel-ui.test.ts`

- [ ] **Step 1: Add the failing tests**

```ts
import { renderStatus } from '../src/lib/panel';

describe('renderStatus', () => {
  it('idle shows the hint inside a well', () => {
    const html = renderStatus({ kind: 'idle' });
    expect(html).toContain('class="well"');
    expect(html).toContain('Markdown');
  });

  it('progress shows the bar and counts', () => {
    const html = renderStatus({ kind: 'progress', messageCount: 48, iteration: 6 });
    expect(html).toContain('class="progress"');
    expect(html).toContain('48 件検出 / 6 回スクロール');
  });

  it('success shows the badge, count and filename', () => {
    const html = renderStatus({ kind: 'success', messageCount: 52, filename: 'chat.md' });
    expect(html).toContain('保存完了');
    expect(html).toContain('52');
    expect(html).toContain('chat.md');
  });

  it('error shows an alert with the message', () => {
    const html = renderStatus({ kind: 'error', message: '検出できませんでした' });
    expect(html).toContain('class="alert"');
    expect(html).toContain('検出できませんでした');
  });

  it('escapes HTML in dynamic values', () => {
    const html = renderStatus({ kind: 'error', message: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/panel-ui.test.ts`
Expected: FAIL — `renderStatus` not exported.

- [ ] **Step 3: Implement `escapeHtml` + `renderStatus` in `src/lib/panel.ts`**

```ts
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const STATUS_SUBTITLE: Record<StatusState['kind'], string> = {
  idle: 'この会話をローカルに保存',
  progress: '古い会話を読み込み中…',
  success: '保存しました',
  error: '失敗しました',
};

export function renderStatus(state: StatusState): string {
  switch (state.kind) {
    case 'idle':
      return `<div class="well"><div class="well__row"><span class="dot dot--muted"></span><span>ボタンを押すと上端まで自動スクロールし、読み込まれた全ターンを Markdown 化します。</span></div></div>`;
    case 'progress':
      return `<div class="well"><div class="progress"><i></i></div><div class="well__row"><span class="dot dot--accent"></span><span>${state.messageCount} 件検出 / ${state.iteration} 回スクロール</span></div></div>`;
    case 'success':
      return `<div class="well"><div class="well__row"><span class="badge badge--success">✓ 保存完了</span><span>${state.messageCount} 件を Markdown 化</span></div><div class="filename">${escapeHtml(state.filename)}</div></div>`;
    case 'error':
      return `<div class="alert" role="alert"><span class="badge badge--danger">!</span><span>${escapeHtml(state.message)}</span></div>`;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/panel-ui.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/panel.ts tests/panel-ui.test.ts
git commit -m "feat: add renderStatus for idle/progress/success/error states"
```

---

### Task 3: `panelStyles` (retro-cute CSS with light/dark)

**Files:**
- Modify: `src/lib/panel.ts`
- Test: `tests/panel-ui.test.ts`

- [ ] **Step 1: Add the failing tests**

```ts
import { panelStyles } from '../src/lib/panel';

describe('panelStyles', () => {
  const css = panelStyles();
  it('uses the ai-slop indigo primary', () => {
    expect(css).toContain('#4f46e5');
  });
  it('includes the gloss gradient and bevel-top highlight', () => {
    expect(css).toMatch(/linear-gradient\(\s*to bottom/);
    expect(css).toContain('inset 0 1px 0 0 rgba(255,255,255,0.6)');
  });
  it('defines the sunken well inset shadow', () => {
    expect(css).toContain('inset 0 2px 5px rgba(40,40,80,0.07)');
  });
  it('includes a progress bar rule', () => {
    expect(css).toContain('.progress');
  });
  it('provides a dark theme override', () => {
    expect(css).toContain('[data-theme="dark"]');
  });
  it('always shows a focus ring', () => {
    expect(css).toContain(':focus-visible');
  });
  it('respects reduced motion', () => {
    expect(css).toContain('prefers-reduced-motion');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/panel-ui.test.ts`
Expected: FAIL — `panelStyles` not exported.

- [ ] **Step 3: Implement `panelStyles()`**

Add to `src/lib/panel.ts` (verbatim CSS — keep the exact substrings the tests assert):

```ts
export function panelStyles(): string {
  return `
    :host { all: initial; }
    .root {
      --indigo:#4f46e5; --indigo-strong:#4338ca; --primary-fg:#ffffff;
      --success:#1f9d6b; --danger:#e5484d;
      --bg:#ffffff; --fg:#0a0a0a; --muted:#f5f5f5; --muted-fg:#6b7280;
      --border:#e6e6ec; --card:#ffffff; --well-bg:#f7f7fb;
      --well-shadow: inset 0 2px 5px rgba(40,40,80,0.07);
      --card-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 14px -6px rgba(40,40,80,0.18), 0 18px 50px -20px rgba(40,40,80,0.30);
      --head-grad: linear-gradient(to bottom, #ffffff, color-mix(in oklab, var(--indigo) 5%, #fff));
      --track:#ececf3;
      --focus-ring: 0 0 0 3px color-mix(in oklab, var(--indigo) 40%, transparent);
      --bevel-top: inset 0 1px 0 0 rgba(255,255,255,0.6);
      --gloss: linear-gradient(to bottom, rgba(255,255,255,0.22), rgba(255,255,255,0) 45%, rgba(0,0,0,0.18));
      --btn-shadow: inset 0 0 0 1px rgba(0,0,0,0.22), inset 0 1px 0 0 rgba(255,255,255,0.45), 0 1px 2px rgba(0,0,0,0.18), 0 2px 6px -1px rgba(0,0,0,0.12);
      --font-sans: "Geist", "Noto Sans JP", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-family: var(--font-sans);
      color: var(--fg);
    }
    .root[data-theme="dark"] {
      --indigo:#6a63f0; --indigo-strong:#564fe0;
      --bg:#1d1d22; --fg:#ededed; --muted:#26262e; --muted-fg:#a6a6b3;
      --border:rgba(255,255,255,0.12); --card:#232329; --well-bg:#1a1a1f;
      --well-shadow: inset 0 2px 6px rgba(0,0,0,0.5);
      --card-shadow: 0 1px 3px rgba(0,0,0,0.4), 0 10px 30px -10px rgba(0,0,0,0.6), 0 24px 60px -24px rgba(0,0,0,0.7);
      --head-grad: linear-gradient(to bottom, #2a2a32, color-mix(in oklab, var(--indigo) 16%, #232329));
      --track:#15151a;
      --focus-ring: 0 0 0 3px color-mix(in oklab, var(--indigo) 55%, transparent);
    }
    .root, .root * { box-sizing: border-box; }

    .tab {
      position: fixed; right: 0; top: 42%; z-index: 2147483647;
      display: inline-flex; flex-direction: column; align-items: center; gap: 6px;
      writing-mode: vertical-rl; border: 0; cursor: pointer;
      border-radius: 14px 0 0 14px; padding: 16px 9px;
      color: var(--primary-fg); font: 600 12px/1.2 var(--font-sans); letter-spacing: .08em;
      background-color: var(--indigo); background-image: var(--gloss); background-repeat: no-repeat;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.22), inset 0 1px 0 0 rgba(255,255,255,0.45), -2px 4px 12px rgba(40,40,80,0.30);
      transition: transform .12s ease, filter .12s ease, box-shadow .12s ease;
    }
    .tab:hover { filter: brightness(1.06); transform: translateX(-2px); }
    .tab:active { transform: translateX(0); filter: brightness(0.96); }
    .tab:focus-visible { outline: none; box-shadow: var(--btn-shadow), var(--focus-ring); }
    .tab .glyph { writing-mode: horizontal-tb; font-size: 15px; font-weight: 700; }

    .card {
      position: fixed; right: 14px; top: 86px; z-index: 2147483647;
      display: none; width: min(320px, calc(100vw - 28px));
      border: 1px solid var(--border); border-radius: 14px;
      background: var(--card); box-shadow: var(--card-shadow);
      overflow: hidden; font-size: 14px;
    }
    .card[data-open] { display: block; }
    .card__head { display: flex; align-items: center; gap: 10px; padding: 13px 14px; background-image: var(--head-grad); box-shadow: var(--bevel-top); border-bottom: 1px solid var(--border); }
    .brand { flex: none; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 13px; background-color: var(--indigo); background-image: var(--gloss); background-repeat: no-repeat; box-shadow: var(--btn-shadow); }
    .head__text { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
    .title { font-weight: 700; font-size: 13.5px; letter-spacing: -0.01em; }
    .subtitle { font-size: 11px; color: var(--muted-fg); }
    .close { margin-left: auto; flex: none; width: 26px; height: 26px; border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--muted-fg); cursor: pointer; font-size: 17px; line-height: 1; display: grid; place-items: center; transition: background .12s ease, color .12s ease, border-color .12s ease; }
    .close:hover { background: var(--muted); color: var(--fg); border-color: var(--border); }
    .close:focus-visible { outline: none; box-shadow: var(--focus-ring); }

    .card__body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }

    .primary { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 0; cursor: pointer; border-radius: 10px; padding: 11px 14px; color: var(--primary-fg); font: 700 13.5px/1 var(--font-sans); background-color: var(--indigo); background-image: var(--gloss); background-repeat: no-repeat; box-shadow: var(--btn-shadow); transition: transform .1s ease, filter .12s ease, box-shadow .12s ease; }
    .primary:hover { filter: brightness(1.05); box-shadow: var(--btn-shadow), 0 6px 16px -6px color-mix(in oklab, var(--indigo) 55%, transparent); }
    .primary:active { transform: translateY(1px); box-shadow: inset 0 2px 6px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(0,0,0,0.22); }
    .primary:focus-visible { outline: none; box-shadow: var(--btn-shadow), var(--focus-ring); }
    .primary:disabled { cursor: progress; filter: saturate(.7); opacity: .9; }
    .primary svg { width: 16px; height: 16px; }
    .primary .ic-dl { display: inline-flex; }
    .primary .ic-sp { display: none; }
    .primary[data-busy] .ic-dl { display: none; }
    .primary[data-busy] .ic-sp { display: inline-flex; }
    .spin { animation: kan-spin .8s linear infinite; }
    @keyframes kan-spin { to { transform: rotate(360deg); } }

    .well { border: 1px solid var(--border); border-radius: 10px; background: var(--well-bg); box-shadow: var(--well-shadow); padding: 11px 12px; font-size: 12.5px; color: var(--muted-fg); line-height: 1.5; display: flex; flex-direction: column; gap: 9px; }
    .well__row { display: flex; align-items: center; gap: 8px; }
    .dot { width: 7px; height: 7px; border-radius: 999px; flex: none; }
    .dot--muted { background: var(--muted-fg); }
    .dot--accent { background: var(--indigo); }

    .progress { height: 7px; border-radius: 999px; background: var(--track); box-shadow: inset 0 1px 2px rgba(0,0,0,0.18); overflow: hidden; }
    .progress > i { display: block; height: 100%; width: 40%; border-radius: 999px; background-color: var(--indigo); background-image: var(--gloss); background-repeat: no-repeat; box-shadow: var(--bevel-top); animation: kan-indeterminate 1.2s ease-in-out infinite; }
    @keyframes kan-indeterminate { 0% { margin-left: -42%; } 100% { margin-left: 102%; } }

    .badge { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 3px 9px; font-size: 11px; font-weight: 700; color: #fff; background-image: linear-gradient(to bottom, rgba(255,255,255,0.35), rgba(0,0,0,0.10)); box-shadow: var(--bevel-top), inset 0 0 0 1px rgba(0,0,0,0.12); }
    .badge--success { background-color: var(--success); }
    .badge--danger { background-color: var(--danger); }
    .filename { font-family: var(--font-mono); font-size: 12px; color: var(--fg); word-break: break-all; }

    .alert { border-radius: 10px; border: 1px solid color-mix(in oklab, var(--danger) 45%, var(--border)); background: color-mix(in oklab, var(--danger) 12%, var(--card)); color: color-mix(in oklab, var(--danger) 70%, var(--fg)); box-shadow: var(--bevel-top); padding: 10px 12px; font-size: 12.5px; line-height: 1.45; display: flex; gap: 8px; align-items: flex-start; }

    .foot { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--muted-fg); margin: 0; }
    .foot svg { width: 13px; height: 13px; flex: none; }

    @media (prefers-reduced-motion: reduce) {
      .root *, .root *::before, .root *::after { transition: none !important; animation: none !important; }
    }
  `;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/panel-ui.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/panel.ts tests/panel-ui.test.ts
git commit -m "feat: add panelStyles with retro-cute indigo tokens + dark theme"
```

---

### Task 4: `panelMarkup` (structure + privacy guard)

**Files:**
- Modify: `src/lib/panel.ts`
- Test: `tests/panel-ui.test.ts`

- [ ] **Step 1: Add the failing tests**

```ts
import { panelMarkup } from '../src/lib/panel';

describe('panelMarkup', () => {
  it('contains the launcher tab and export button', () => {
    const html = panelMarkup('light');
    expect(html).toContain('data-export-tab');
    expect(html).toContain('data-export-button');
    expect(html).toContain('この会話を .md 保存');
  });
  it('applies the requested theme to the root', () => {
    expect(panelMarkup('dark')).toContain('data-theme="dark"');
  });
  it('keeps the privacy footer copy', () => {
    expect(panelMarkup('light')).toContain('外部送信なし');
  });
  it('references no remote/network resources (privacy guard)', () => {
    const html = panelMarkup('light');
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/url\(/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/panel-ui.test.ts`
Expected: FAIL — `panelMarkup` not exported.

- [ ] **Step 3: Implement icons + `panelMarkup()`**

```ts
const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/></svg>`;
const ICON_SPINNER = `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.5"/></svg>`;
const ICON_SHIELD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 5 6v6c0 4 3 6.5 7 9 4-2.5 7-5 7-9V6l-7-3Z"/></svg>`;

export function panelMarkup(theme: PanelTheme = 'light'): string {
  return `
    <style>${panelStyles()}</style>
    <div class="root" data-export-root data-theme="${theme}">
      <button class="tab" type="button" data-export-tab aria-label="AI Chat Markdown Exporter を開く">
        <span class="glyph">↓</span>MD保存
      </button>
      <aside class="card" data-export-panel role="dialog" aria-label="AI Chat Markdown Exporter">
        <div class="card__head">
          <div class="brand" aria-hidden="true">M↓</div>
          <div class="head__text">
            <span class="title">AI Chat → Markdown</span>
            <span class="subtitle" data-export-subtitle>${STATUS_SUBTITLE.idle}</span>
          </div>
          <button class="close" type="button" data-export-close aria-label="閉じる">×</button>
        </div>
        <div class="card__body">
          <button class="primary" type="button" data-export-button>
            <span class="ic ic-dl">${ICON_DOWNLOAD}</span>
            <span class="ic ic-sp">${ICON_SPINNER}</span>
            <span data-export-label>この会話を .md 保存</span>
          </button>
          <div data-export-status aria-live="polite">${renderStatus({ kind: 'idle' })}</div>
          <p class="foot">${ICON_SHIELD}<span>外部送信なし・ページ内DOMから抽出してローカル保存</span></p>
        </div>
      </aside>
    </div>
  `;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/panel-ui.test.ts`
Expected: PASS (all panel-ui tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/panel.ts tests/panel-ui.test.ts
git commit -m "feat: add panelMarkup with brand header, well status, privacy footer"
```

---

### Task 5: Rewire `src/content.ts`

**Files:**
- Modify: `src/content.ts` (full rewrite of the wiring; keep `downloadTextFile`)

- [ ] **Step 1: Replace the contents of `src/content.ts`**

```ts
import { extractConversation } from './lib/extract';
import { buildMarkdown, sanitizeFilename } from './lib/markdown';
import {
  panelMarkup,
  renderStatus,
  resolveTheme,
  STATUS_SUBTITLE,
  type PanelTheme,
  type StatusState,
} from './lib/panel';
import { hydrateConversationHistory } from './lib/scroll';

const HOST_ID = 'kan-chatgpt-markdown-exporter';

installExporter();

interface ExportUi {
  button: HTMLButtonElement;
  label: HTMLElement;
  subtitle: HTMLElement;
  status: HTMLElement;
}

function installExporter(): void {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = panelMarkup(resolveTheme(document));
  document.documentElement.append(host);

  const root = shadow.querySelector<HTMLElement>('[data-export-root]');
  const tab = shadow.querySelector<HTMLButtonElement>('[data-export-tab]');
  const panel = shadow.querySelector<HTMLElement>('[data-export-panel]');
  const close = shadow.querySelector<HTMLButtonElement>('[data-export-close]');
  const button = shadow.querySelector<HTMLButtonElement>('[data-export-button]');
  const label = shadow.querySelector<HTMLElement>('[data-export-label]');
  const subtitle = shadow.querySelector<HTMLElement>('[data-export-subtitle]');
  const status = shadow.querySelector<HTMLElement>('[data-export-status]');

  if (!root || !tab || !panel || !close || !button || !label || !subtitle || !status) return;

  watchTheme(document, (theme) => root.setAttribute('data-theme', theme));

  const ui: ExportUi = { button, label, subtitle, status };
  tab.addEventListener('click', () => panel.toggleAttribute('data-open'));
  close.addEventListener('click', () => panel.removeAttribute('data-open'));
  button.addEventListener('click', () => void runExport(ui));
}

function setStatus(ui: ExportUi, state: StatusState): void {
  ui.subtitle.textContent = STATUS_SUBTITLE[state.kind];
  ui.status.innerHTML = renderStatus(state);
  const busy = state.kind === 'progress';
  ui.button.toggleAttribute('data-busy', busy);
  ui.button.disabled = busy;
  ui.label.textContent = busy ? '読み込み中…' : 'この会話を .md 保存';
}

async function runExport(ui: ExportUi): Promise<void> {
  setStatus(ui, { kind: 'progress', messageCount: 0, iteration: 0 });

  try {
    await hydrateConversationHistory(document, (progress) => {
      setStatus(ui, {
        kind: 'progress',
        messageCount: progress.messageCount,
        iteration: progress.iteration,
      });
    });

    const conversation = extractConversation(document);
    if (conversation.messages.length === 0) {
      throw new Error('ChatGPTの会話メッセージを検出できませんでした。');
    }

    const markdown = buildMarkdown({
      title: conversation.title,
      sourceUrl: location.href,
      exportedAt: new Date(),
      messages: conversation.messages,
    });

    const filename = sanitizeFilename(conversation.title);
    downloadTextFile(filename, markdown);
    setStatus(ui, {
      kind: 'success',
      messageCount: conversation.messages.length,
      filename,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'エクスポートに失敗しました。';
    setStatus(ui, { kind: 'error', message });
  }
}

function watchTheme(doc: Document, apply: (theme: PanelTheme) => void): void {
  apply(resolveTheme(doc));
  const update = (): void => apply(resolveTheme(doc));

  if (doc.documentElement) {
    new MutationObserver(update).observe(doc.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    });
  }

  const view = doc.defaultView;
  if (view && typeof view.matchMedia === 'function') {
    try {
      view.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
    } catch {
      /* matchMedia change events unsupported */
    }
  }
}

function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/content.ts
git commit -m "refactor: drive content script from panel module with 4-state status + theme sync"
```

---

### Task 6: Full gate + visual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run: `npm run check`
Expected: typecheck PASS, all tests PASS (existing + new `panel-ui`), `vite build` writes `dist/manifest.json`.

- [ ] **Step 2: Visual verification of the REAL output**

Render `panelMarkup()` from the actual module into an HTML harness and screenshot light+dark in headless Chrome (Node 22 strips TS types):

```bash
cat > /tmp/exporter-mockup/render.mts <<'TS'
import { panelMarkup, renderStatus } from '/Users/kan/UGREEN-NAS/DEVELOP/kandotrun/ai-chat-export-chrome-extension/src/lib/panel.ts';
import { writeFileSync } from 'node:fs';
const states = [
  renderStatus({ kind: 'idle' }),
  renderStatus({ kind: 'progress', messageCount: 48, iteration: 6 }),
  renderStatus({ kind: 'success', messageCount: 52, filename: 'ChatGPT-_-Markdown.md' }),
  renderStatus({ kind: 'error', message: 'ChatGPTの会話メッセージを検出できませんでした。' }),
];
const panel = (t: 'light' | 'dark') => `<div style="position:relative;width:360px;height:420px">${panelMarkup(t).replace('position: fixed; right: 0; top: 42%;', 'position:absolute; right:0; top:20px;').replace('position: fixed; right: 14px; top: 86px;', 'position:absolute; right:60px; top:20px;').replace('display: none;', 'display:block;')}</div>`;
writeFileSync('/tmp/exporter-mockup/real.html', `<!doctype html><meta charset=utf-8><body style="margin:0;display:flex;gap:24px;background:#0f0f14;padding:24px"><div style="background:#f3f3f7;padding:20px;border-radius:16px">${panel('light')}</div><div style="background:#161619;padding:20px;border-radius:16px">${panel('dark')}</div><pre style="color:#888;font:11px monospace">states rendered: ${states.length}</pre></body>`);
console.log('wrote real.html');
TS
node /tmp/exporter-mockup/render.mts
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=2 --window-size=900,520 --screenshot=/tmp/exporter-mockup/real.png "file:///tmp/exporter-mockup/real.html"
```

Open `/tmp/exporter-mockup/real.png` and confirm: indigo glossy tab + button, bevel header, well status, light/dark both correct. (This step is verification only — if type-stripping is unavailable, rely on `npm run check` + the unit tests instead.)

- [ ] **Step 3: Update Serena memory**

Update `code_structure` memory to note `src/lib/panel.ts` (presentation layer) and the 4-state status model.

---

## Self-Review

- **Spec coverage:** indigo primary (Task 3) ✓; gloss/bevel/well primitives (Task 3) ✓; launcher tab + brand header + privacy footer (Task 4) ✓; 4 status states incl. progress bar + success badge + filename + error alert (Task 2/4) ✓; light/dark + theme follow (Task 1 + Task 5 `watchTheme`) ✓; a11y focus ring + reduced-motion + aria-live (Task 3/4) ✓; system fonts only, no fonts/url() (Task 3/4 + privacy guard) ✓; manifest unchanged (no task touches it) ✓; extraction/scroll/markdown untouched (Task 5 reuses them) ✓.
- **Placeholder scan:** none — every step has full code/commands.
- **Type consistency:** `StatusState`/`PanelTheme`/`STATUS_SUBTITLE`/`renderStatus`/`panelStyles`/`panelMarkup`/`resolveTheme` names identical across panel.ts, content.ts, and tests. `ExportUi` shape `{button,label,subtitle,status}` consistent in `installExporter`/`setStatus`/`runExport`.
