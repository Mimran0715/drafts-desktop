const { describe, expect, it } = require('vitest');
const { readFileSync } = require('node:fs');

const read = file => readFileSync(file, 'utf8');

describe('per-intent model overrides', () => {
  it('chooses an override for generate, analyze, and question with global fallback', () => {
    const source = read('electron/ai/nodes.js');
    for (const intent of ['generate', 'analyze', 'question']) expect(source).toContain(intent);
    expect(source).toMatch(/intentModels/);
    expect(source).toMatch(/intentModels[^\n;]*\[[^\]]*intent[^\]]*\][^\n;]*(?:\?\?|\|\|)[^\n;]*modelName/);
  });

  it('passes the resolved model into tool/model execution', () => {
    const nodes = read('electron/ai/nodes.js');
    const tools = read('electron/ai/tools.js');
    expect(nodes + tools).toMatch(/modelName/);
    expect(nodes + tools).toMatch(/(?:generateText|analyzeDraft|askQuestion)\([\s\S]{0,300}model/);
  });

  it('persists intentModels through database, main, and preload', () => {
    for (const file of ['electron/database.js', 'electron/main.js', 'electron/preload.js']) {
      expect(read(file), file).toMatch(/intentModels/);
    }
  });
});
