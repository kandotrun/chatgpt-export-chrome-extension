export type ChatRole = 'user' | 'assistant' | 'system' | 'tool' | 'unknown';

export interface ChatMessage {
  role: ChatRole;
  text: string;
  index: number;
}

export interface ConversationExport {
  title: string;
  sourceUrl: string;
  exportedAt: Date;
  messages: ChatMessage[];
}

export interface ExtractedConversation {
  title: string;
  messages: ChatMessage[];
}
