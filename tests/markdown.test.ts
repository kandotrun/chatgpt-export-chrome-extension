import { describe, expect, it } from 'vitest';
import { buildMarkdown, sanitizeFilename } from '../src/lib/markdown';
import type { ChatMessage } from '../src/lib/types';

describe('buildMarkdown', () => {
  it('exports title, source URL, timestamp, and role-labelled messages', () => {
    const messages: ChatMessage[] = [
      { role: 'user', text: 'Claudeに共有する用にまとめて', index: 0 },
      { role: 'assistant', text: '了解です。\n- 要点1\n- 要点2', index: 1 },
    ];

    const markdown = buildMarkdown({
      title: '日常の問題と計画',
      sourceUrl: 'https://chatgpt.com/c/abc123',
      exportedAt: new Date('2026-06-24T03:04:05.000Z'),
      messages,
    });

    expect(markdown).toContain('# 日常の問題と計画');
    expect(markdown).toContain('Source: https://chatgpt.com/c/abc123');
    expect(markdown).toContain('Exported: 2026-06-24T03:04:05.000Z');
    expect(markdown).toContain('## You\n\nClaudeに共有する用にまとめて');
    expect(markdown).toContain('## ChatGPT\n\n了解です。\n- 要点1\n- 要点2');
  });


  it('uses the source assistant name for non-ChatGPT exports', () => {
    const markdown = buildMarkdown({
      title: 'Claude export',
      sourceUrl: 'https://claude.ai/chat/abc',
      exportedAt: new Date('2026-06-24T03:04:05.000Z'),
      assistantName: 'Claude',
      messages: [{ role: 'assistant', text: 'Claude response', index: 0 }],
    });

    expect(markdown).toContain('## Claude\n\nClaude response');
    expect(markdown).not.toContain('## ChatGPT\n\nClaude response');
  });

  it('keeps fenced code blocks stable by extending conflicting fences', () => {
    const markdown = buildMarkdown({
      title: 'コード共有',
      sourceUrl: 'https://chatgpt.com/c/code',
      exportedAt: new Date('2026-06-24T03:04:05.000Z'),
      messages: [
        {
          role: 'assistant',
          text: '```ts\nconsole.log(`hi`);\n```',
          index: 0,
        },
      ],
    });

    expect(markdown).toContain('````ts\nconsole.log(`hi`);\n````');
  });
});

describe('sanitizeFilename', () => {
  it('creates a safe markdown filename from Japanese titles and forbidden characters', () => {
    expect(sanitizeFilename('日常の問題と計画: ChatGPT/Export?')).toBe(
      '日常の問題と計画-ChatGPT-Export.md',
    );
  });
});
