import type { ChatMessage, ChatRole, ExtractedConversation } from './types';

const CHATGPT_TURN_SELECTOR = '[data-message-author-role]';
const CLAUDE_USER_SELECTOR = '[data-testid="user-message"], [data-testid="human-message"]';
const CLAUDE_ASSISTANT_SELECTOR = '[data-testid="assistant-message"], .font-claude-message, .font-claude-response';
const GEMINI_USER_SELECTOR = 'user-query, [data-testid="user-query"], .query-text';
const GEMINI_ASSISTANT_SELECTOR =
  'model-response, message-content, [data-testid="model-response"], .model-response-text, .response-content';

export const CONVERSATION_TURN_SELECTOR = [
  CHATGPT_TURN_SELECTOR,
  CLAUDE_USER_SELECTOR,
  CLAUDE_ASSISTANT_SELECTOR,
  GEMINI_USER_SELECTOR,
  GEMINI_ASSISTANT_SELECTOR,
].join(', ');

interface TurnCandidate {
  element: HTMLElement;
  role: ChatRole;
}

export function extractConversation(document: Document): ExtractedConversation {
  const assistantName = detectAssistantName(document);
  const title = extractTitle(document, assistantName);
  const turnElements = collectTurnCandidates(document);
  const messages = turnElements
    .map(({ element, role }, index): ChatMessage => ({
      role,
      text: extractTurnText(element, role),
      index,
    }))
    .filter((message) => message.text.length > 0);

  return { title, messages, assistantName };
}

function detectAssistantName(document: Document): string {
  const hostname = document.location.hostname;
  if (hostname === 'claude.ai' || hostname.endsWith('.claude.ai')) return 'Claude';
  if (hostname === 'gemini.google.com' || hostname.endsWith('.gemini.google.com')) return 'Gemini';
  return 'ChatGPT';
}

function extractTitle(document: Document, assistantName: string): string {
  const siteTitle = extractSiteSpecificTitle(document, assistantName);
  if (siteTitle) return siteTitle;

  const heading = document.querySelector('main h1, h1');
  const text = normalizeTitleCandidate(heading?.textContent ?? '', assistantName);
  if (text) return text;

  const documentTitle = normalizeTitleCandidate(
    document.title.replace(/\s*[|\-–—]\s*(ChatGPT|Claude|Gemini)\s*$/i, ''),
    assistantName,
  );
  return documentTitle || `${assistantName} Conversation`;
}

function extractSiteSpecificTitle(document: Document, assistantName: string): string {
  if (assistantName !== 'Gemini') return '';
  return extractGeminiConversationTitle(document);
}

function extractGeminiConversationTitle(document: Document): string {
  const conversationId = document.location.pathname.match(/\/app\/([^/?#]+)/)?.[1];
  if (!conversationId) return '';

  const matchingLinks = [...document.querySelectorAll<HTMLElement>('a[href], [role="link"][href]')].filter((element) => {
    const href = element.getAttribute('href');
    if (!href) return false;

    try {
      const url = new URL(href, document.location.href);
      return url.hostname === document.location.hostname && url.pathname.match(/\/app\/([^/?#]+)/)?.[1] === conversationId;
    } catch {
      return false;
    }
  });

  const activeLinks = matchingLinks.filter(
    (element) => element.getAttribute('aria-current') === 'page' || element.getAttribute('aria-selected') === 'true',
  );

  for (const element of [...activeLinks, ...matchingLinks]) {
    const title = extractTitleFromElement(element, 'Gemini');
    if (title) return title;
  }

  return '';
}

function extractTitleFromElement(element: HTMLElement, assistantName: string): string {
  const titleSelector = [
    '[data-testid*="title" i]',
    '[data-test-id*="title" i]',
    '[class*="conversation-title" i]',
    '[class*="chat-title" i]',
    '[class*="title" i]',
  ].join(', ');

  const titledElement = element.querySelector<HTMLElement>(titleSelector);
  const descendantTitle = normalizeTitleCandidate(titledElement?.textContent ?? '', assistantName);
  if (descendantTitle) return descendantTitle;

  const attributeTitle = normalizeTitleCandidate(element.getAttribute('title') ?? element.getAttribute('aria-label') ?? '', assistantName);
  if (attributeTitle) return attributeTitle;

  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('button, svg, mat-icon, [aria-hidden="true"]').forEach((node) => node.remove());
  return normalizeTitleCandidate(clone.textContent ?? '', assistantName);
}

function normalizeTitleCandidate(text: string, assistantName: string): string {
  const title = collapseWhitespace(text);
  if (!title || title.length > 120) return '';

  const genericTitles = [
    assistantName,
    `${assistantName} Conversation`,
    `${assistantName} との会話`,
    'AI Chat Conversation',
    'New chat',
    '新しいチャット',
  ];

  return genericTitles.some((generic) => title.toLowerCase() === generic.toLowerCase()) ? '' : title;
}

function collectTurnCandidates(document: Document): TurnCandidate[] {
  const candidates = [...document.querySelectorAll<HTMLElement>(CONVERSATION_TURN_SELECTOR)]
    .filter(isTopLevelTurn)
    .map((element) => ({ element, role: roleForElement(element) }))
    .filter((candidate) => candidate.role !== 'unknown')
    .sort((a, b) => (a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1));

  return candidates;
}

function isTopLevelTurn(element: HTMLElement): boolean {
  const nestedParent = element.parentElement?.closest(CONVERSATION_TURN_SELECTOR);
  return nestedParent === null;
}

function roleForElement(element: HTMLElement): ChatRole {
  const role = normalizeRole(element.getAttribute('data-message-author-role'));
  if (role !== 'unknown') return role;
  if (element.matches(CLAUDE_USER_SELECTOR) || element.matches(GEMINI_USER_SELECTOR)) return 'user';
  if (element.matches(CLAUDE_ASSISTANT_SELECTOR) || element.matches(GEMINI_ASSISTANT_SELECTOR)) {
    return 'assistant';
  }
  return 'unknown';
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
    const assistantContentSelector =
      '.markdown, [data-message-content], .prose, message-content, .font-claude-message, .font-claude-response, .model-response-text, .response-content';
    return selectSelfOrDescendant(element, assistantContentSelector);
  }

  const userContentSelector =
    '[data-message-content], .whitespace-pre-wrap, .break-words, .query-text, [data-testid="user-message"], [data-testid="human-message"], user-query';
  return selectSelfOrDescendant(element, userContentSelector);
}

function selectSelfOrDescendant(element: HTMLElement, selector: string): HTMLElement {
  return element.querySelector<HTMLElement>(selector) ?? (element.matches(selector) ? element : element);
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
