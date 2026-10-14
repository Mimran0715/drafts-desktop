import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/components/AgentChat.tsx'), 'utf8');

describe('RAG keyboard shortcut', () => {
  it('registers and cleans up a window keydown listener', () => {
    expect(source).toMatch(/window\.addEventListener\(['"]keydown['"]/);
    expect(source).toMatch(/window\.removeEventListener\(['"]keydown['"]/);
  });

  it('requires Ctrl or Meta plus Shift plus R and prevents default', () => {
    expect(source).toMatch(/(?:ctrlKey[\s\S]*metaKey|metaKey[\s\S]*ctrlKey)[\s\S]*shiftKey[\s\S]*key[\s\S]*['"]r['"]/i);
    expect(source).toMatch(/preventDefault\(\)/);
  });

  it('toggles RAG and advertises the shortcut on the checkbox', () => {
    expect(source).toMatch(/(?:set[A-Za-z]*Rag|on[A-Za-z]*Rag[A-Za-z]*Change)\([^\n]*!/i);
    expect(source).toMatch(/title=["'][^"']*(?:Ctrl|Cmd|⌘)\+Shift\+R[^"']*["']/i);
  });
});
