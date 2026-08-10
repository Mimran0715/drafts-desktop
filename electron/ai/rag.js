/* global require, module, process */
const crypto = require('crypto');
const { ChromaClient } = require('chromadb');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');

const CHROMA_HOST = process.env.CHROMA_HOST || 'localhost';
const CHROMA_PORT = Number(process.env.CHROMA_PORT || 8000);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 180;
const EMBED_CONCURRENCY = 4;
const INDEX_BATCH_SIZE = 100;
const DEFAULT_RESULTS = 6;

const indexCache = new Map();
let embeddingDimensions = null;

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
  keepSeparator: true,
  // Prefer boundaries that preserve writing structure before falling back to
  // sentence punctuation, words, and finally individual characters.
  separators: ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' ', ''],
});

function hashText(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function getCollectionName(projectPath) {
  // A different prefix prevents collisions with the legacy vector store.
  return `drafts_rag_${hashText(projectPath).slice(0, 20)}`;
}

function createClient() {
  return new ChromaClient({ host: CHROMA_HOST, port: CHROMA_PORT, ssl: false });
}

function tokenize(text) {
  return String(text).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'_-]*/gu) || [];
}

async function embedTextWithOllama(text) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, prompt: String(text) }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Ollama embeddings failed (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('Ollama returned an empty embedding');
  }

  embeddingDimensions = data.embedding.length;
  return data.embedding;
}

async function mapConcurrent(items, mapper, concurrency = EMBED_CONCURRENCY) {
  const output = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}

async function embedTexts(texts) {
  return mapConcurrent(texts, embedTextWithOllama);
}

async function chunkText(input) {
  const text = String(input || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return [];

  const splitDocuments = await textSplitter.createDocuments([text]);
  return splitDocuments.map(document => ({
    content: document.pageContent.trim(),
    startLine: document.metadata.loc?.lines?.from || 1,
    endLine: document.metadata.loc?.lines?.to || document.metadata.loc?.lines?.from || 1,
  }));
}

async function buildChunks(documents) {
  const chunksByDocument = await Promise.all(documents.map(async doc => {
    const chunks = await chunkText(doc.content);
    return chunks.map((chunk, index) => ({
      id: hashText(`${doc.path}:${chunk.startLine}:${chunk.content}`).slice(0, 40),
      content: chunk.content,
      metadata: {
        documentName: doc.name,
        documentPath: doc.path,
        chunkIndex: index,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        isLive: !!doc.isLive,
      },
    }));
  }));
  return chunksByDocument.flat();
}

function computeFingerprint(documents) {
  const payload = documents.map(doc => `${doc.path}:${hashText(doc.content || '')}`).sort().join('|');
  return hashText(`rag-v4-langchain-splitter:${OLLAMA_EMBED_MODEL}:${payload}`);
}

async function addInBatches(collection, chunks, embeddings) {
  for (let start = 0; start < chunks.length; start += INDEX_BATCH_SIZE) {
    const batch = chunks.slice(start, start + INDEX_BATCH_SIZE);
    await collection.add({
      ids: batch.map(chunk => chunk.id),
      documents: batch.map(chunk => chunk.content),
      metadatas: batch.map(chunk => chunk.metadata),
      embeddings: embeddings.slice(start, start + INDEX_BATCH_SIZE),
    });
  }
}

async function rebuildCollection(client, collectionName, chunks) {
  const embeddings = await embedTexts(chunks.map(chunk => chunk.content));

  try { await client.deleteCollection({ name: collectionName }); } catch { /* absent */ }
  const collection = await client.getOrCreateCollection({ name: collectionName, embeddingFunction: null });
  if (chunks.length) await addInBatches(collection, chunks, embeddings);
  return collection;
}

async function ensureIndexedCollection(client, collectionName, projectPath, documents, chunks) {
  const fingerprint = computeFingerprint(documents);
  const cached = indexCache.get(projectPath);
  if (cached?.fingerprint === fingerprint && cached.collectionName === collectionName) {
    return client.getCollection({ name: collectionName });
  }

  const collection = await rebuildCollection(client, collectionName, chunks);
  indexCache.set(projectPath, { fingerprint, collectionName });
  return collection;
}

function lexicalScore(query, document) {
  const queryTerms = [...new Set(tokenize(query).filter(term => term.length > 2))];
  if (!queryTerms.length) return 0;
  const terms = tokenize(document);
  const frequencies = new Map();
  for (const term of terms) frequencies.set(term, (frequencies.get(term) || 0) + 1);
  return queryTerms.reduce((score, term) => score + Math.min(frequencies.get(term) || 0, 3), 0) /
    (queryTerms.length * 3);
}

function rerankCandidates(query, result, limit) {
  const documents = result.documents?.[0] || [];
  const metadatas = result.metadatas?.[0] || [];
  const distances = result.distances?.[0] || [];
  const candidates = documents.map((document, index) => {
    const distance = typeof distances[index] === 'number' ? distances[index] : 1;
    const vectorScore = Math.max(0, 1 - distance);
    const lexical = lexicalScore(query, document);
    return {
      document: String(document || '').trim(),
      metadata: metadatas[index] || {},
      distance,
      score: vectorScore * 0.72 + lexical * 0.28,
    };
  }).sort((a, b) => b.score - a.score);

  const selected = [];
  for (const candidate of candidates) {
    const duplicate = selected.some(item =>
      item.metadata.documentPath === candidate.metadata.documentPath &&
      Math.abs((item.metadata.chunkIndex || 0) - (candidate.metadata.chunkIndex || 0)) <= 1
    );
    if (!duplicate || selected.length < Math.min(2, limit)) selected.push(candidate);
    if (selected.length >= limit) break;
  }
  return selected;
}

function formatResults(query, candidates) {
  const grouped = new Map();
  for (const candidate of candidates) {
    const metadata = candidate.metadata;
    const key = metadata.documentPath || metadata.documentName;
    if (!grouped.has(key)) grouped.set(key, {
      documentName: `${metadata.documentName || 'Project context'}${metadata.isLive ? ' (Current Draft)' : ''}`,
      documentPath: metadata.documentPath || key,
      relevanceScore: 0,
      matches: [],
    });
    const item = grouped.get(key);
    item.relevanceScore += candidate.score;
    item.matches.push({
      lineNumber: metadata.startLine || 1,
      endLine: metadata.endLine || metadata.startLine || 1,
      context: candidate.document,
      matches: Math.max(1, Math.round(lexicalScore(query, candidate.document) * 10)),
      distance: candidate.distance,
    });
  }

  const results = [...grouped.values()].sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 3);
  return {
    found: results.length > 0,
    query,
    resultCount: results.length,
    retrievalMode: 'chroma-hybrid',
    embeddingMode: 'ollama',
    results,
  };
}

async function searchWithChroma(query, projectPath, documents, options = {}) {
  const client = createClient();
  await client.heartbeat();
  const chunks = await buildChunks(documents);
  if (!chunks.length) return formatResults(query, []);

  const collectionName = getCollectionName(projectPath);
  const collection = await ensureIndexedCollection(
    client,
    collectionName,
    projectPath,
    documents,
    chunks
  );
  const queryEmbedding = await embedTextWithOllama(query);
  const wanted = Math.max(1, Number(options.nResults) || DEFAULT_RESULTS);
  const result = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: Math.min(chunks.length, Math.max(wanted * 3, 12)),
    include: ['documents', 'metadatas', 'distances'],
  });
  return formatResults(query, rerankCandidates(query, result, wanted));
}

async function getChromaStatus() {
  try {
    const client = createClient();
    await client.heartbeat();
    let version = null;
    try { version = await client.version(); } catch { /* optional */ }

    try {
      await embedTextWithOllama('drafts retrieval probe');
    } catch (error) {
      return {
        available: true,
        host: CHROMA_HOST,
        port: CHROMA_PORT,
        version,
        embeddingModel: OLLAMA_EMBED_MODEL,
        embeddingMode: 'unavailable',
        embeddingDimensions: null,
        embeddingError: error.message,
        semanticSearch: false,
      };
    }

    return {
      available: true,
      host: CHROMA_HOST,
      port: CHROMA_PORT,
      version,
      embeddingModel: OLLAMA_EMBED_MODEL,
      embeddingMode: 'ollama',
      embeddingDimensions,
      semanticSearch: true,
    };
  } catch (error) {
    return {
      available: false,
      host: CHROMA_HOST,
      port: CHROMA_PORT,
      error: error.message,
      embeddingModel: OLLAMA_EMBED_MODEL,
      embeddingMode: 'unavailable',
      embeddingDimensions,
      semanticSearch: false,
    };
  }
}

function invalidateProjectIndex(projectPath) {
  indexCache.delete(projectPath);
}

module.exports = { getChromaStatus, searchWithChroma, invalidateProjectIndex };
