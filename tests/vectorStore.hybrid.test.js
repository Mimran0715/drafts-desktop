const { describe, expect, it, vi } = require('vitest');

vi.mock('chromadb', () => ({ ChromaClient: class {} }));
vi.mock('@langchain/core/documents', () => ({ Document: class {} }));
vi.mock('@langchain/community/retrievers/bm25', () => ({ BM25Retriever: {} }));
vi.mock('@langchain/classic/retrievers/ensemble', () => ({ EnsembleRetriever: class {} }));
vi.mock('../electron/database', () => ({ getActiveChunks: vi.fn(), reconcileChunks: vi.fn() }));

describe('reciprocal rank fusion', () => {
  it('scores, merges and de-duplicates ranked chunks', () => {
    const { fuseRankings } = require('../electron/ai/vectorStore');
    const a = [{ id: 'a' }, { id: 'b' }];
    const b = [{ id: 'b' }, { id: 'c' }];
    expect(fuseRankings(a, b).map(x => x.id)).toEqual(['b', 'a', 'c']);
    expect(fuseRankings(a, b)).toHaveLength(3);
  });

  it('honors a custom k and breaks equal scores by first appearance', () => {
    const { fuseRankings } = require('../electron/ai/vectorStore');
    expect(fuseRankings([{ id: 'x' }], [{ id: 'y' }], 1).map(x => x.id)).toEqual(['x', 'y']);
  });

  it('exposes the new hybrid retrieval status without removing existing statuses', () => {
    const ui = require('node:fs').readFileSync('src/components/AgentChat.tsx', 'utf8');
    expect(ui).toContain('Hybrid (semantic + keyword)');
    for (const status of ['Semantic', 'Keyword', 'Unavailable']) expect(ui).toContain(status);
  });
});
