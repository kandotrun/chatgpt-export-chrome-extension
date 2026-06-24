import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { extractConversation } from '../src/lib/extract';

function dom(html: string): Document {
  return new JSDOM(html, { url: 'https://chatgpt.com/c/abc123' }).window.document;
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
});
