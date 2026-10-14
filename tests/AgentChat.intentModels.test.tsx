import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const chat = readFileSync('src/components/AgentChat.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

describe('intent model controls', () => {
  it('renders an Advanced section with a selector for every override', () => {
    expect(chat).toMatch(/Advanced/i);
    for (const intent of ['generate', 'analyze', 'question']) {
      expect(chat, intent).toMatch(new RegExp(`(?:name|data-testid|aria-label|id)=[{\"']*[^\\n]*${intent}`, 'i'));
    }
  });

  it('supports leaving each override unset', () => {
    expect(chat).toMatch(/(?:value=["']{2}|Use default|Global model|Default)/i);
  });

  it('owns, passes, and persists intentModels in App', () => {
    expect(app).toMatch(/useState[\s\S]{0,100}intentModels|intentModels[\s\S]{0,100}useState/i);
    expect(app).toMatch(/<AgentChat[\s\S]*intentModels=/);
    expect(app).toMatch(/(?:setPreference|savePreferences)[\s\S]{0,200}intentModels/);
  });
});
