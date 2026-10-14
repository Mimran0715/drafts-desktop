const { describe, expect, it } = require('vitest');
const { readFileSync } = require('node:fs');

const read = file => readFileSync(file, 'utf8');

describe('chat cancellation', () => {
  it('exposes cancelChat and registers the chat:cancel IPC channel', () => {
    expect(read('electron/preload.js')).toMatch(/cancelChat\s*:[^\n]*invoke\(['"]chat:cancel['"]/);
    expect(read('electron/main.js')).toMatch(/ipcMain\.handle\(['"]chat:cancel['"]/);
  });

  it('uses a fresh AbortController per stream and aborts the requested thread', () => {
    const source = read('electron/main.js');
    expect(source).toMatch(/new AbortController\(\)/);
    expect(source).toMatch(/\.abort\(\)/);
    expect(source).toMatch(/(?:Map|running|controllers|inFlight)/i);
  });

  it('threads an abort signal into graph execution', () => {
    expect(read('electron/ai/graph.js') + read('electron/ai/nodes.js')).toMatch(/signal|AbortSignal/);
  });

  it('persists cancelled partial output and restores the composer', () => {
    expect(read('electron/main.js')).toMatch(/cancelled\s*:\s*true/);
    const ui = read('src/components/AgentChat.tsx') + read('src/App.tsx');
    expect(ui).toMatch(/Stop/);
    expect(ui).toMatch(/cancelChat/);
  });
});
