import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const chat = () => readFileSync(resolve('src/components/AgentChat.tsx'), 'utf8');
const modelSources = () => [
  readFileSync(resolve('src/App.tsx'), 'utf8'),
  readFileSync(resolve('electron/main.js'), 'utf8'),
];

describe('AgentChat model choices', () => {
  it('offers qwen2.5-coder:14b after both existing models', () => {
    for (const source of modelSources()) {
      expect(source).toMatch(/SUPPORTED_OLLAMA_MODELS\s*=\s*\[\s*['"]llama-writer['"]\s*,\s*['"]llama3\.1['"]\s*,\s*['"]qwen2\.5-coder:14b['"]\s*\]/);
    }
  });

  it('keeps the selector controlled and forwards model changes', () => {
    expect(chat()).toMatch(/<select[\s\S]*?value=\{selectedModel\}[\s\S]*?onChange=\{\(e\)\s*=>\s*onSelectedModelChange\(e\.target\.value\)\}/);
  });

  it('sends the selected model through the existing options object', () => {
    expect(chat()).toContain("onSend(input, { modelName: selectedModel })");
  });
});
