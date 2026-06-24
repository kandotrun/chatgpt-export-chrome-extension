import type { ManifestV3Export } from '@crxjs/vite-plugin';

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: 'ChatGPT Markdown Exporter',
  version: '0.1.0',
  description: 'Export the current ChatGPT conversation to a local Markdown file.',
  permissions: [],
  host_permissions: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
  content_scripts: [
    {
      matches: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
      js: ['src/content.ts'],
      run_at: 'document_idle',
    },
  ],
};

export default manifest;
