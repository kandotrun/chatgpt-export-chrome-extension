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
  assistantName?: string;
}

export interface ExtractedConversation {
  title: string;
  messages: ChatMessage[];
  assistantName?: string;
}
