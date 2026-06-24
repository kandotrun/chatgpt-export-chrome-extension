import type { ManifestV3Export } from '@crxjs/vite-plugin';

const CHAT_HOSTS = [
  'https://chatgpt.com/*',
  'https://chat.openai.com/*',
  'https://claude.ai/*',
  'https://gemini.google.com/*',
];

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: 'AI Chat Markdown Exporter',
  version: '0.1.0',
  description: 'Export the current AI Chat conversation (ChatGPT, Claude, or Gemini) to a local Markdown file.',
  permissions: [],
  host_permissions: CHAT_HOSTS,
  content_scripts: [
    {
      matches: CHAT_HOSTS,
      js: ['src/content.ts'],
      run_at: 'document_idle',
    },
  ],
};

export default manifest;
