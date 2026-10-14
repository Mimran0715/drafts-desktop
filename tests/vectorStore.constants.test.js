const { describe, expect, it, vi } = require('vitest');

vi.mock('chromadb', () => ({ ChromaClient: class {} }));
vi.mock('@langchain/core/documents', () => ({ Document: class {} }));
vi.mock('@langchain/community/retrievers/bm25', () => ({ BM25Retriever: {} }));
vi.mock('@langchain/classic/retrievers/ensemble', () => ({ EnsembleRetriever: class {} }));
vi.mock('../electron/database', () => ({ getActiveChunks: vi.fn(), reconcileChunks: vi.fn() }));

describe('vector store chunk constants', () => {
  it('exports the documented defaults', () => {
    const store = require('../electron/ai/vectorStore');
    expect(store.CHUNK_SIZE).toBe(900);
    expect(store.CHUNK_OVERLAP).toBe(150);
  });

  it('uses the exported size and overlap when splitting', () => {
    const store = require('../electron/ai/vectorStore');
    const chunks = store.recursiveSplit('x'.repeat(store.CHUNK_SIZE + 25));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.length <= store.CHUNK_SIZE)).toBe(true);
  });
});
