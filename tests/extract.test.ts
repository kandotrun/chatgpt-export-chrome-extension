import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { extractConversation } from '../src/lib/extract';
import { sanitizeFilename } from '../src/lib/markdown';

function dom(html: string, url = 'https://chatgpt.com/c/abc123'): Document {
  return new JSDOM(html, { url }).window.document;
}

describe('extractConversation', () => {
  it('extracts user and assistant turns from current ChatGPT article markup', () => {
    const document = dom(`
      <main>
        <h1>日常の問題と計画</h1>
        <article data-testid="conversation-turn-0" data-message-author-role="user">
          <div class="whitespace-pre-wrap">おはようございます。</div>
        </article>
        <article data-testid="conversation-turn-1" data-message-author-role="assistant">
          <div class="markdown prose"><p>おはようございます、Kanさん。</p><ul><li>住居</li><li>GCP</li></ul></div>
        </article>
      </main>
    `);

    const result = extractConversation(document);

    expect(result.title).toBe('日常の問題と計画');
    expect(result.messages).toEqual([
      { role: 'user', text: 'おはようございます。', index: 0 },
      { role: 'assistant', text: 'おはようございます、Kanさん。\n\n- 住居\n- GCP', index: 1 },
    ]);
  });

  it('falls back to legacy author-role containers and preserves code blocks', () => {
    const document = dom(`
      <main>
        <div data-message-author-role="user"><div>コードをMarkdownでください</div></div>
        <div data-message-author-role="assistant">
          <div class="markdown"><pre><code class="language-ts">const a = 1;\nconsole.log(a);</code></pre></div>
        </div>
      </main>
    `);

    const result = extractConversation(document);

    expect(result.messages).toEqual([
      { role: 'user', text: 'コードをMarkdownでください', index: 0 },
      { role: 'assistant', text: '```ts\nconst a = 1;\nconsole.log(a);\n```', index: 1 },
    ]);
  });

  it('extracts Claude user and assistant turns from Claude page markup', () => {
    const document = dom(
      `
      <main>
        <h1>メディアサイトの類似サービス</h1>
        <div data-testid="user-message"><p>noteやzenのようなメディアサイトって他に何がある？</p></div>
        <div class="font-claude-message"><p>いくつかご紹介します。</p><ul><li>Qiita</li><li>Medium</li></ul></div>
      </main>
    `,
      'https://claude.ai/chat/cdcd8aa2-c848-494f-bf5e-191f1412ded9',
    );

    const result = extractConversation(document);

    expect(result.assistantName).toBe('Claude');
    expect(result.title).toBe('メディアサイトの類似サービス');
    expect(result.messages).toEqual([
      { role: 'user', text: 'noteやzenのようなメディアサイトって他に何がある？', index: 0 },
      { role: 'assistant', text: 'いくつかご紹介します。\n\n- Qiita\n- Medium', index: 1 },
    ]);
  });

  it('extracts Claude assistant responses rendered with the current response class', () => {
    const document = dom(
      `
      <main>
        <h1>採用見送りのお詫びと説明</h1>
        <div data-testid="user-message"><p>カジュアル面談をした方に採用予定がなくなったことを伝えます。</p></div>
        <div class="font-claude-response"><p>こんな形で送ると自然です。</p><p>今回は本当にごめんなさい。</p></div>
        <div data-testid="user-message"><p>もう少しカジュアルにしてほしいです</p></div>
        <div class="font-claude-response"><p>もちろんです。少し柔らかくすると以下です。</p></div>
      </main>
    `,
      'https://claude.ai/chat/ec233ef6-b772-4e18-a3d9-981c75d28ff7',
    );

    const result = extractConversation(document);

    expect(result.messages).toEqual([
      { role: 'user', text: 'カジュアル面談をした方に採用予定がなくなったことを伝えます。', index: 0 },
      { role: 'assistant', text: 'こんな形で送ると自然です。\n\n今回は本当にごめんなさい。', index: 1 },
      { role: 'user', text: 'もう少しカジュアルにしてほしいです', index: 2 },
      { role: 'assistant', text: 'もちろんです。少し柔らかくすると以下です。', index: 3 },
    ]);
  });

  it('extracts Gemini user and model turns from Gemini page markup', () => {
    const document = dom(
      `
      <main>
        <h1>Gemini 調査</h1>
        <user-query><div class="query-text">GeminiでもMarkdown exportできますか？</div></user-query>
        <model-response><message-content><p>できます。</p><ol><li>会話を開く</li><li>保存する</li></ol></message-content></model-response>
      </main>
    `,
      'https://gemini.google.com/app/abc123',
    );

    const result = extractConversation(document);

    expect(result.assistantName).toBe('Gemini');
    expect(result.title).toBe('Gemini 調査');
    expect(result.messages).toEqual([
      { role: 'user', text: 'GeminiでもMarkdown exportできますか？', index: 0 },
      { role: 'assistant', text: 'できます。\n\n1. 会話を開く\n2. 保存する', index: 1 },
    ]);
  });

  it('uses the active Gemini history title instead of the generic browser title', () => {
    const document = dom(
      `
      <title>Gemini との会話</title>
      <nav aria-label="Recent conversations">
        <a href="/app/old"><span class="conversation-title">古い会話</span></a>
        <a href="/u/1/app/1df1571bfc796b81" aria-current="page">
          <span class="conversation-title">性感染症の検査と治療について</span>
          <button aria-label="その他のオプション">⋮</button>
        </a>
      </nav>
      <main>
        <user-query><div class="query-text">話者識別して文字起こしして</div></user-query>
        <model-response><message-content><p>承知しました。</p></message-content></model-response>
      </main>
    `,
      'https://gemini.google.com/u/1/app/1df1571bfc796b81?pageId=none',
    );

    const result = extractConversation(document);

    expect(result.title).toBe('性感染症の検査と治療について');
    expect(sanitizeFilename(result.title)).toBe('性感染症の検査と治療について.md');
  });
});
