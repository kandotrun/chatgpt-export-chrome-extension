import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { selectBestScroller } from '../src/lib/scroll';

function setMetrics(element: Element, metrics: { scrollHeight: number; clientHeight: number }): void {
  Object.defineProperties(element, {
    scrollHeight: { configurable: true, value: metrics.scrollHeight },
    clientHeight: { configurable: true, value: metrics.clientHeight },
  });
}

describe('selectBestScroller', () => {
  it('prefers the scrollable container that owns ChatGPT turn nodes', () => {
    const dom = new JSDOM(`
      <main>
        <section id="unrelated"><p>long settings panel</p></section>
        <section id="conversation">
          <div data-message-author-role="user">hello</div>
          <div data-message-author-role="assistant">hi</div>
        </section>
      </main>
    `);
    const document = dom.window.document;
    const unrelated = document.querySelector('#unrelated')!;
    const conversation = document.querySelector('#conversation')!;

    setMetrics(unrelated, { scrollHeight: 4_000, clientHeight: 500 });
    setMetrics(conversation, { scrollHeight: 2_000, clientHeight: 500 });

    expect(selectBestScroller(document)).toBe(conversation);
  });

  it('prefers scrollable containers that own Claude or Gemini turn nodes', () => {
    const dom = new JSDOM(
      `
      <main>
        <section id="unrelated"><p>long settings panel</p></section>
        <section id="conversation">
          <div data-testid="user-message">hello Claude</div>
          <div class="font-claude-message">hi from Claude</div>
          <user-query>hello Gemini</user-query>
          <model-response><message-content>hi from Gemini</message-content></model-response>
        </section>
      </main>
    `,
      { url: 'https://claude.ai/chat/test' },
    );
    const document = dom.window.document;
    const unrelated = document.querySelector('#unrelated')!;
    const conversation = document.querySelector('#conversation')!;

    setMetrics(unrelated, { scrollHeight: 4_000, clientHeight: 500 });
    setMetrics(conversation, { scrollHeight: 2_000, clientHeight: 500 });

    expect(selectBestScroller(document)).toBe(conversation);
  });

});
