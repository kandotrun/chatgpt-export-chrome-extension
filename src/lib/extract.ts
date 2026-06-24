import type { ChatMessage, ChatRole, ExtractedConversation } from './types';

const TURN_SELECTOR = '[data-message-author-role]';

export function extractConversation(document: Document): ExtractedConversation {
  const title = extractTitle(document);
  const turnElements = uniqueTopLevelTurns([...document.querySelectorAll<HTMLElement>(TURN_SELECTOR)]);
  const messages = turnElements
    .map((element, index): ChatMessage => {
      const role = normalizeRole(element.getAttribute('data-message-author-role'));
      return {
        role,
        text: extractTurnText(element, role),
        index,
      };
    })
    .filter((message) => message.text.length > 0);

  return { title, messages };
}

function extractTitle(document: Document): string {
  const heading = document.querySelector('main h1, h1');
  const text = heading?.textContent?.trim();
  if (text) return collapseWhitespace(text);

  const documentTitle = document.title.replace(/\s*[|\-–—]\s*ChatGPT\s*$/i, '').trim();
  return documentTitle || 'ChatGPT Conversation';
}

function uniqueTopLevelTurns(elements: HTMLElement[]): HTMLElement[] {
  return elements.filter((element) => {
    const nestedParent = element.parentElement?.closest(TURN_SELECTOR);
    return nestedParent === null;
  });
}

function normalizeRole(role: string | null): ChatRole {
  if (role === 'user' || role === 'assistant' || role === 'system' || role === 'tool') return role;
  return 'unknown';
}

function extractTurnText(element: HTMLElement, role: ChatRole): string {
  const contentRoot = selectContentRoot(element, role);
  if (role === 'assistant') {
    return normalizeMarkdown(renderChildren(contentRoot).trim());
  }
  return normalizePlainText(contentRoot.textContent ?? '');
}

function selectContentRoot(element: HTMLElement, role: ChatRole): HTMLElement {
  if (role === 'assistant') {
    return (
      element.querySelector<HTMLElement>('.markdown, [data-message-content], .prose') ?? element
    );
  }

  return (
    element.querySelector<HTMLElement>('[data-message-content], .whitespace-pre-wrap, .break-words') ??
    element
  );
}

function renderChildren(element: Element): string {
  return [...element.childNodes].map((node) => renderNode(node, { listDepth: 0 })).join('').trim();
}

interface RenderContext {
  listDepth: number;
}

function renderNode(node: Node, context: RenderContext): string {
  if (node.nodeType === node.TEXT_NODE) return normalizeTextNode(node.textContent ?? '');
  if (node.nodeType !== node.ELEMENT_NODE) return '';

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  switch (tag) {
    case 'br':
      return '\n';
    case 'p':
      return `${renderInlineChildren(element, context).trim()}\n\n`;
    case 'div':
    case 'section':
    case 'article':
      return `${renderChildren(element)}\n`;
    case 'strong':
    case 'b':
      return `**${renderInlineChildren(element, context).trim()}**`;
    case 'em':
    case 'i':
      return `_${renderInlineChildren(element, context).trim()}_`;
    case 'code':
      if (element.parentElement?.tagName.toLowerCase() === 'pre') return element.textContent ?? '';
      return `\`${(element.textContent ?? '').replace(/`/g, '\\`')}\``;
    case 'pre':
      return renderCodeBlock(element);
    case 'ul':
      return `${renderList(element, context, false)}\n`;
    case 'ol':
      return `${renderList(element, context, true)}\n`;
    case 'li':
      return renderListItem(element, context, '-');
    case 'a':
      return renderLink(element, context);
    case 'blockquote':
      return `${renderChildren(element)
        .split('\n')
        .map((line) => (line.trim() ? `> ${line}` : '>'))
        .join('\n')}\n\n`;
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = Number(tag.slice(1));
      return `${'#'.repeat(level)} ${renderInlineChildren(element, context).trim()}\n\n`;
    }
    case 'table':
      return renderTable(element);
    default:
      return renderInlineChildren(element, context);
  }
}

function renderInlineChildren(element: Element, context: RenderContext): string {
  return [...element.childNodes].map((node) => renderNode(node, context)).join('');
}

function renderCodeBlock(pre: HTMLElement): string {
  const code = pre.querySelector('code') ?? pre;
  const className = code.getAttribute('class') ?? '';
  const language = className.match(/language-([\w+-]+)/)?.[1] ?? '';
  const text = (code.textContent ?? '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
  return `\`\`\`${language}\n${text}\`\`\`\n\n`;
}

function renderList(list: HTMLElement, context: RenderContext, ordered: boolean): string {
  return [...list.children]
    .filter((child) => child.tagName.toLowerCase() === 'li')
    .map((item, index) => renderListItem(item as HTMLElement, { listDepth: context.listDepth + 1 }, ordered ? `${index + 1}.` : '-'))
    .join('');
}

function renderListItem(item: HTMLElement, context: RenderContext, marker: string): string {
  const indent = '  '.repeat(Math.max(context.listDepth - 1, 0));
  const parts = [...item.childNodes]
    .map((node) => renderNode(node, context))
    .join('')
    .trim()
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n/g, `\n${indent}  `);
  return `${indent}${marker} ${parts}\n`;
}

function renderLink(anchor: HTMLElement, context: RenderContext): string {
  const text = renderInlineChildren(anchor, context).trim() || anchor.textContent?.trim() || '';
  const href = anchor.getAttribute('href');
  if (!href || href === text) return text;
  return `[${text}](${href})`;
}

function renderTable(table: HTMLElement): string {
  const rows = [...table.querySelectorAll('tr')].map((row) =>
    [...row.children].map((cell) => normalizePlainText(cell.textContent ?? '')),
  );
  if (rows.length === 0) return '';
  const [header, ...body] = rows;
  const separator = header.map(() => '---');
  return [header, separator, ...body].map((row) => `| ${row.join(' | ')} |`).join('\n') + '\n\n';
}

function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizePlainText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeTextNode(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
