import type { ChatMessage, ConversationExport } from './types';

const ROLE_LABELS: Record<ChatMessage['role'], string> = {
  user: 'You',
  assistant: 'ChatGPT',
  system: 'System',
  tool: 'Tool',
  unknown: 'Unknown',
};

export function buildMarkdown(exportData: ConversationExport): string {
  const title = exportData.title.trim() || 'ChatGPT Conversation';
  const header = [
    `# ${title}`,
    '',
    `Source: ${exportData.sourceUrl}`,
    `Exported: ${exportData.exportedAt.toISOString()}`,
    '',
    '---',
    '',
  ].join('\n');

  const body = exportData.messages
    .map((message) => {
      const label = ROLE_LABELS[message.role] ?? ROLE_LABELS.unknown;
      return `## ${label}\n\n${stabilizeFencedCodeBlocks(message.text).trim()}`;
    })
    .join('\n\n---\n\n');

  return `${header}${body}\n`;
}

export function sanitizeFilename(title: string): string {
  const stem = (title || 'chatgpt-conversation')
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
    .slice(0, 120) || 'chatgpt-conversation';

  return stem.toLowerCase().endsWith('.md') ? stem : `${stem}.md`;
}

function stabilizeFencedCodeBlocks(text: string): string {
  const maxFenceLength = [...text.matchAll(/^(`{3,})/gm)].reduce(
    (max, match) => Math.max(max, match[1].length),
    0,
  );

  if (maxFenceLength < 3) return normalizeLineEndings(text);

  const replacementFence = '`'.repeat(maxFenceLength + 1);
  return normalizeLineEndings(text).replace(/^`{3,}([^`\n]*)$/gm, `${replacementFence}$1`);
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}
