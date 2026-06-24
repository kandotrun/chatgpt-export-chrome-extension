import { describe, expect, it } from 'vitest';
import manifest from '../src/manifest';

type TestManifest = {
  permissions?: string[];
  host_permissions?: string[];
  content_scripts?: Array<{ matches?: string[] }>;
};

const extensionManifest = manifest as TestManifest;

describe('extension manifest', () => {
  it('keeps permissions minimal for privacy-sensitive ChatGPT export', () => {
    expect(extensionManifest.permissions ?? []).toEqual([]);
    expect(extensionManifest.host_permissions).toEqual([
      'https://chatgpt.com/*',
      'https://chat.openai.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
    ]);
    expect(extensionManifest.content_scripts?.[0]?.matches).toEqual([
      'https://chatgpt.com/*',
      'https://chat.openai.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
    ]);
  });
});
