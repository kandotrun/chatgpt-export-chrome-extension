import { extractConversation } from './lib/extract';
import { buildMarkdown, sanitizeFilename } from './lib/markdown';
import { hydrateConversationHistory } from './lib/scroll';

const HOST_ID = 'kan-chatgpt-markdown-exporter';

installExporter();

function installExporter(): void {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = panelMarkup();
  document.documentElement.append(host);

  const tab = shadow.querySelector<HTMLButtonElement>('[data-export-tab]');
  const panel = shadow.querySelector<HTMLElement>('[data-export-panel]');
  const close = shadow.querySelector<HTMLButtonElement>('[data-export-close]');
  const exportButton = shadow.querySelector<HTMLButtonElement>('[data-export-button]');
  const status = shadow.querySelector<HTMLElement>('[data-export-status]');

  if (!tab || !panel || !close || !exportButton || !status) return;

  tab.addEventListener('click', () => panel.toggleAttribute('data-open'));
  close.addEventListener('click', () => panel.removeAttribute('data-open'));
  exportButton.addEventListener('click', () => void runExport(exportButton, status));
}

async function runExport(button: HTMLButtonElement, status: HTMLElement): Promise<void> {
  button.disabled = true;
  setStatus(status, '古い会話を読み込み中…');

  try {
    await hydrateConversationHistory(document, (progress) => {
      setStatus(
        status,
        `読み込み中… ${progress.messageCount}件検出 / ${progress.iteration}回スクロール`,
      );
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

    downloadTextFile(sanitizeFilename(conversation.title), markdown);
    setStatus(status, `${conversation.messages.length}件をMarkdownで保存しました。`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'エクスポートに失敗しました。';
    setStatus(status, message, true);
  } finally {
    button.disabled = false;
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

function setStatus(status: HTMLElement, text: string, isError = false): void {
  status.textContent = text;
  status.toggleAttribute('data-error', isError);
}

function panelMarkup(): string {
  return `
    <style>
      :host { all: initial; color-scheme: light dark; }
      .tab {
        position: fixed;
        right: 0;
        top: 42%;
        z-index: 2147483647;
        writing-mode: vertical-rl;
        border: 0;
        border-radius: 12px 0 0 12px;
        padding: 14px 9px;
        background: #111827;
        color: #fff;
        font: 600 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 8px 26px rgb(0 0 0 / 24%);
        cursor: pointer;
        letter-spacing: .04em;
      }
      .panel {
        position: fixed;
        right: 14px;
        top: 86px;
        z-index: 2147483647;
        display: none;
        width: min(340px, calc(100vw - 28px));
        border: 1px solid rgb(148 163 184 / 32%);
        border-radius: 18px;
        background: color-mix(in srgb, Canvas 94%, transparent);
        color: CanvasText;
        box-shadow: 0 18px 70px rgb(15 23 42 / 28%);
        backdrop-filter: blur(14px);
        font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        overflow: hidden;
      }
      .panel[data-open] { display: block; }
      .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid rgb(148 163 184 / 22%); }
      .title { font-weight: 700; font-size: 14px; }
      .close { border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 20px; line-height: 1; opacity: .7; }
      .body { padding: 16px; }
      .primary {
        width: 100%;
        border: 0;
        border-radius: 12px;
        padding: 11px 14px;
        background: #10a37f;
        color: white;
        font-weight: 700;
        cursor: pointer;
      }
      .primary:disabled { cursor: wait; opacity: .66; }
      .status { min-height: 3em; margin: 12px 0 0; color: rgb(100 116 139); white-space: pre-wrap; }
      .status[data-error] { color: #dc2626; }
      .note { margin: 12px 0 0; font-size: 12px; color: rgb(100 116 139); }
    </style>
    <button class="tab" type="button" data-export-tab>MD Export</button>
    <aside class="panel" data-export-panel aria-label="ChatGPT Markdown Exporter">
      <div class="head">
        <div class="title">ChatGPT → Markdown</div>
        <button class="close" type="button" data-export-close aria-label="閉じる">×</button>
      </div>
      <div class="body">
        <button class="primary" type="button" data-export-button>この会話を .md 保存</button>
        <div class="status" data-export-status>ボタンを押すと上まで自動スクロールして、読み込まれた全ターンをMarkdown化します。</div>
        <p class="note">外部送信なし。ページ内DOMから抽出してローカルに保存します。</p>
      </div>
    </aside>
  `;
}
