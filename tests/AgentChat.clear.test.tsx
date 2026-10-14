import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file: string) => readFileSync(resolve(file), 'utf8');

describe('clear chat', () => {
  it('declares the clear callback as optional', () => {
    expect(read('src/components/AgentChat.tsx')).toMatch(/onClearConversation\?\s*:\s*\(\)\s*=>\s*void/);
  });

  it('renders a disabled-when-empty button that invokes the callback', () => {
    const source = read('src/components/AgentChat.tsx');
    expect(source).toMatch(/data-testid=["']clear-chat["']/);
    expect(source).toMatch(/disabled=\{messages\.length\s*===\s*0/);
    expect(source).toMatch(/onClick=\{[^}]*onClearConversation/);
  });

  it('wires App to empty the visible message list', () => {
    const source = read('src/App.tsx');
    expect(source).toMatch(/<AgentChat[\s\S]*?onClearConversation=\{[^}]*setMessages\(\[\]\)/);
  });
});
