const crypto = require('crypto');
const path = require('path');
const { ChromaClient } = require('chromadb');
const { getActiveChunks, reconcileChunks } = require('../database');

const CHROMA_HOST = process.env.CHROMA_HOST || 'localhost';
const CHROMA_PORT = Number(process.env.CHROMA_PORT || 8000);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const HASH_EMBEDDING_DIMENSIONS = 256;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 120;
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

function splitAtBoundary(text, maximumLength) {
  if (text.length <= maximumLength) return text.length;
  const minimumLength = Math.floor(maximumLength * 0.55);
  const candidates = ['\n\n', '\n', '. ', '! ', '? ', ' '];

  for (const separator of candidates) {
    const index = text.lastIndexOf(separator, maximumLength);
    if (index >= minimumLength) return index + separator.length;
  }
  return maximumLength;
}

function recursiveSplit(text) {
  const normalized = String(text).replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const chunks = [];
  let remaining = normalized;
  while (remaining.length > CHUNK_SIZE) {
    const end = splitAtBoundary(remaining, CHUNK_SIZE);
    const content = remaining.slice(0, end).trim();
    if (content) chunks.push(content);

    const overlapStart = Math.max(0, end - CHUNK_OVERLAP);
    remaining = remaining.slice(overlapStart).trimStart();
  }
  if (remaining.trim()) chunks.push(remaining.trim());
  return chunks;
}

function splitMarkdown(text) {
  const normalized = String(text).replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const sections = [];
  let heading = '';
  let lines = [];
  const flush = () => {
    const content = lines.join('\n').trim();
    if (content) sections.push({ heading, content });
    lines = [];
  };

  for (const line of normalized.split('\n')) {
    const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (match) {
      flush();
      heading = match[2].trim();
      lines.push(line);
    } else {
      lines.push(line);
    }
  }
  flush();

  return sections.flatMap(section =>
    recursiveSplit(section.content).map(content => ({
      content,
      sectionHeading: section.heading,
    }))
  );
}

function getDocumentChunks(doc) {
  if (path.extname(doc.path || doc.name || '').toLowerCase() === '.md') {
    return splitMarkdown(doc.content);
  }
  return recursiveSplit(doc.content).map(content => ({ content, sectionHeading: '' }));
}

function buildChunks(documents, projectPath) {
  const chunks = [];
  const folderId = hashText(projectPath);
  const documentsById = new Map();

  // searchContext appends the live editor document after disk documents. Keep
  // the last version for a path so unsaved editor content is authoritative.
  for (const doc of documents) {
    const documentId = hashText(doc.path || doc.name);
    documentsById.set(documentId, { ...doc, documentId });
  }

  for (const doc of documentsById.values()) {
    const { documentId } = doc;
    const duplicateCounts = new Map();
    const docChunks = getDocumentChunks(doc);
    docChunks.forEach(({ content, sectionHeading }, index) => {
      const chunkHash = hashText(content);
      const occurrence = duplicateCounts.get(chunkHash) || 0;
      duplicateCounts.set(chunkHash, occurrence + 1);
      const id = hashText(`${documentId}:${chunkHash}:${occurrence}`);
      chunks.push({
        id,
        content,
        documentId,
        folderId,
        chunkHash,
        metadata: {
          folder_id: folderId,
          document_id: documentId,
          section_heading: sectionHeading || '',
          chunk_index: index,
          last_modified: new Date(doc.modified || Date.now()).toISOString(),
          document_name: doc.name,
          document_path: doc.path,
          is_live: !!doc.isLive,
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

async function reconcileCollection(client, collectionName, projectPath, chunks) {
  let collection = await client.getOrCreateCollection({
    name: collectionName,
    embeddingFunction: null,
  });

  const folderId = hashText(projectPath);
  const ledgerRows = getActiveChunks(folderId);

  // Collections created by the old full-rebuild indexer have no ledger rows.
  // Clear that one-time legacy state so fixed-window vectors cannot leak into
  // structure-aware results as untracked orphans.
  if (ledgerRows.length === 0 && await collection.count() > 0) {
    await client.deleteCollection({ name: collectionName });
    collection = await client.getOrCreateCollection({
      name: collectionName,
      embeddingFunction: null,
    });
  }

  const existingIds = new Set(ledgerRows.map(row => row.chunk_id));
  const desiredIds = new Set(chunks.map(chunk => chunk.id));
  const newChunks = chunks.filter(chunk => !existingIds.has(chunk.id));
  const unchangedChunks = chunks.filter(chunk => existingIds.has(chunk.id));
  const staleIds = ledgerRows
    .map(row => row.chunk_id)
    .filter(id => !desiredIds.has(id));

  if (newChunks.length > 0) {
    const embeddings = await embedTexts(newChunks.map(chunk => chunk.content));
    await collection.upsert({
      ids: newChunks.map(chunk => chunk.id),
      documents: newChunks.map(chunk => chunk.content),
      metadatas: newChunks.map(chunk => chunk.metadata),
      embeddings,
    });
  }
  if (unchangedChunks.length > 0) {
    await collection.update({
      ids: unchangedChunks.map(chunk => chunk.id),
      metadatas: unchangedChunks.map(chunk => chunk.metadata),
    });
  }
  if (staleIds.length > 0) {
    await collection.delete({ ids: staleIds });
  }

  reconcileChunks(
    folderId,
    chunks.map(chunk => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      chunkHash: chunk.chunkHash,
      chromaVectorId: chunk.id,
    })),
    staleIds
  );

  return collection;
}

async function ensureIndexedCollection(client, collectionName, projectPath, documents) {
  const mode = await resolveEmbeddingMode();
  const fingerprint = computeFingerprint(documents, mode);
  const cached = indexCache.get(projectPath);

  if (cached?.fingerprint === fingerprint && cached?.collectionName === collectionName) {
    return client.getCollection({ name: collectionName });
  }

  const chunks = buildChunks(documents, projectPath);
  const collection = await reconcileCollection(client, collectionName, projectPath, chunks);
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
    const key = metadata.document_path || metadata.document_name || `result-${index}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        documentName: metadata.document_name || 'Project context',
        documentPath: metadata.document_path || key,
        relevanceScore: 0,
        matches: [],
      });
    }

    const item = grouped.get(key);
    const distance = typeof distances[index] === 'number' ? distances[index] : 1;
    item.relevanceScore += Math.max(0, 1 - distance);
    item.matches.push({
      lineNumber: metadata.chunk_index || 0,
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
  const chunks = buildChunks(documents, projectPath);

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
    } catch {
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
  buildChunks,
  recursiveSplit,
  splitMarkdown,
  getChromaStatus,
  searchWithChroma,
  invalidateProjectIndex,
};
