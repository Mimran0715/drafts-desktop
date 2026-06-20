const crypto = require('crypto');
const { ChromaClient } = require('chromadb');

const CHROMA_HOST = process.env.CHROMA_HOST || 'localhost';
const CHROMA_PORT = Number(process.env.CHROMA_PORT || 8000);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const HASH_EMBEDDING_DIMENSIONS = 256;
const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;
const EMBED_CONCURRENCY = 4;

const indexCache = new Map();
let embeddingMode = null;
let embeddingDimensions = HASH_EMBEDDING_DIMENSIONS;

function hashText(text) {
  return crypto.createHash('sha1').update(text).digest('hex');
}

function getCollectionName(projectPath) {
  return `drafts_${hashText(projectPath).slice(0, 24)}`;
}

function createClient() {
  return new ChromaClient({
    host: CHROMA_HOST,
    port: CHROMA_PORT,
    ssl: false,
  });
}

function embedTextWithHash(text) {
  const vector = new Array(HASH_EMBEDDING_DIMENSIONS).fill(0);
  const tokens = String(text)
    .toLowerCase()
    .match(/[a-z0-9']+/g) || [];

  for (const token of tokens) {
    const hash = crypto.createHash('sha256').update(token).digest();
    const index = hash.readUInt16BE(0) % HASH_EMBEDDING_DIMENSIONS;
    const sign = hash[2] % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return vector;

  return vector.map(value => value / magnitude);
}

async function embedTextWithOllama(text) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_EMBED_MODEL,
      prompt: String(text),
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Ollama embeddings failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('Ollama returned an empty embedding');
  }

  embeddingDimensions = data.embedding.length;
  return data.embedding;
}

async function resolveEmbeddingMode(forceRefresh = false) {
  if (embeddingMode && !forceRefresh) {
    return embeddingMode;
  }

  try {
    await embedTextWithOllama('drafts embedding probe');
    embeddingMode = 'ollama';
  } catch (error) {
    console.warn(`Ollama embeddings unavailable (${OLLAMA_EMBED_MODEL}), using hash fallback:`, error.message);
    embeddingMode = 'hash';
    embeddingDimensions = HASH_EMBEDDING_DIMENSIONS;
  }

  return embeddingMode;
}

async function embedText(text) {
  const mode = await resolveEmbeddingMode();
  if (mode === 'ollama') {
    try {
      return await embedTextWithOllama(text);
    } catch (error) {
      console.warn('Ollama embedding failed for query chunk, falling back to hash:', error.message);
      embeddingMode = 'hash';
      embeddingDimensions = HASH_EMBEDDING_DIMENSIONS;
    }
  }

  return embedTextWithHash(text);
}

async function embedTexts(texts) {
  const mode = await resolveEmbeddingMode();
  if (mode !== 'ollama') {
    return texts.map(text => embedTextWithHash(text));
  }

  const embeddings = new Array(texts.length);
  let cursor = 0;

  async function worker() {
    while (cursor < texts.length) {
      const index = cursor;
      cursor += 1;
      embeddings[index] = await embedTextWithOllama(texts[index]);
    }
  }

  const workers = Array.from(
    { length: Math.min(EMBED_CONCURRENCY, texts.length) },
    () => worker()
  );
  await Promise.all(workers);

  return embeddings;
}

function chunkText(text) {
  const normalized = String(text).replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const chunks = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + CHUNK_SIZE);
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end === normalized.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

function buildChunks(documents) {
  const chunks = [];

  for (const doc of documents) {
    const docChunks = chunkText(doc.content);
    docChunks.forEach((content, index) => {
      const id = hashText(`${doc.path}:${index}:${content}`).slice(0, 32);
      chunks.push({
        id,
        content,
        metadata: {
          documentName: doc.name,
          documentPath: doc.path,
          chunkIndex: index,
          isLive: !!doc.isLive,
        },
      });
    });
  }

  return chunks;
}

function computeFingerprint(documents, mode) {
  const payload = documents
    .map(doc => `${doc.path}:${doc.content?.length || 0}:${hashText(doc.content || '')}`)
    .join('|');

  return hashText(`${mode}:${payload}`);
}

async function rebuildCollection(client, collectionName, chunks) {
  try {
    await client.deleteCollection({ name: collectionName });
  } catch (error) {
    // Collection may not exist yet.
  }

  const collection = await client.getOrCreateCollection({
    name: collectionName,
    embeddingFunction: null,
  });

  if (chunks.length === 0) {
    return collection;
  }

  const embeddings = await embedTexts(chunks.map(chunk => chunk.content));

  await collection.add({
    ids: chunks.map(chunk => chunk.id),
    documents: chunks.map(chunk => chunk.content),
    metadatas: chunks.map(chunk => chunk.metadata),
    embeddings,
  });

  return collection;
}

async function ensureIndexedCollection(client, collectionName, projectPath, documents) {
  const mode = await resolveEmbeddingMode();
  const fingerprint = computeFingerprint(documents, mode);
  const cached = indexCache.get(projectPath);

  if (cached?.fingerprint === fingerprint && cached?.collectionName === collectionName) {
    return client.getCollection({ name: collectionName });
  }

  const chunks = buildChunks(documents);
  const collection = await rebuildCollection(client, collectionName, chunks);
  indexCache.set(projectPath, { fingerprint, collectionName });
  return collection;
}

function formatQueryResults(query, result) {
  const documents = result.documents?.[0] || [];
  const metadatas = result.metadatas?.[0] || [];
  const distances = result.distances?.[0] || [];
  const grouped = new Map();

  documents.forEach((document, index) => {
    const metadata = metadatas[index] || {};
    const key = metadata.documentPath || metadata.documentName || `result-${index}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        documentName: metadata.documentName || 'Project context',
        documentPath: metadata.documentPath || key,
        relevanceScore: 0,
        matches: [],
      });
    }

    const item = grouped.get(key);
    const distance = typeof distances[index] === 'number' ? distances[index] : 1;
    item.relevanceScore += Math.max(0, 1 - distance);
    item.matches.push({
      lineNumber: metadata.chunkIndex || 0,
      context: String(document || '').trim(),
      matches: 1,
      distance,
    });
  });

  const results = Array.from(grouped.values())
    .map(resultItem => ({
      ...resultItem,
      matches: resultItem.matches.slice(0, 3),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  return {
    found: results.length > 0,
    query,
    resultCount: results.length,
    retrievalMode: 'chroma',
    embeddingMode: embeddingMode || 'hash',
    results: results.slice(0, 3),
  };
}

async function searchWithChroma(query, projectPath, documents, options = {}) {
  const client = createClient();
  await client.heartbeat();

  const collectionName = getCollectionName(projectPath);
  const collection = await ensureIndexedCollection(client, collectionName, projectPath, documents);
  const chunks = buildChunks(documents);

  if (chunks.length === 0) {
    return {
      found: false,
      query,
      resultCount: 0,
      retrievalMode: 'chroma',
      embeddingMode: embeddingMode || 'hash',
      results: [],
    };
  }

  const queryEmbedding = await embedText(query);
  const result = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: options.nResults || 6,
    include: ['documents', 'metadatas', 'distances'],
  });

  return formatQueryResults(query, result);
}

async function getChromaStatus() {
  await resolveEmbeddingMode();

  try {
    const client = createClient();
    await client.heartbeat();
    let version = null;

    try {
      version = await client.version();
    } catch (error) {
      // Heartbeat succeeded; version is nice-to-have only.
    }

    return {
      available: true,
      host: CHROMA_HOST,
      port: CHROMA_PORT,
      version,
      embeddingModel: OLLAMA_EMBED_MODEL,
      embeddingMode: embeddingMode || 'hash',
      embeddingDimensions,
      semanticSearch: embeddingMode === 'ollama',
    };
  } catch (error) {
    return {
      available: false,
      host: CHROMA_HOST,
      port: CHROMA_PORT,
      error: error.message,
      embeddingModel: OLLAMA_EMBED_MODEL,
      embeddingMode: embeddingMode || 'hash',
      embeddingDimensions,
      semanticSearch: false,
    };
  }
}

function invalidateProjectIndex(projectPath) {
  indexCache.delete(projectPath);
}

module.exports = {
  getChromaStatus,
  searchWithChroma,
  invalidateProjectIndex,
};
