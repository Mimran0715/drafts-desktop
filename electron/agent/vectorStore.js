const crypto = require('crypto');
const { ChromaClient } = require('chromadb');

const CHROMA_HOST = '127.0.0.1';
const CHROMA_PORT = 8000;
const EMBEDDING_DIMENSIONS = 256;
const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;

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

function embedText(text) {
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = String(text)
    .toLowerCase()
    .match(/[a-z0-9']+/g) || [];

  for (const token of tokens) {
    const hash = crypto.createHash('sha256').update(token).digest();
    const index = hash.readUInt16BE(0) % EMBEDDING_DIMENSIONS;
    const sign = hash[2] % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return vector;

  return vector.map(value => value / magnitude);
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

  await collection.add({
    ids: chunks.map(chunk => chunk.id),
    documents: chunks.map(chunk => chunk.content),
    metadatas: chunks.map(chunk => chunk.metadata),
    embeddings: chunks.map(chunk => embedText(chunk.content)),
  });

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
    results: results.slice(0, 3),
  };
}

async function searchWithChroma(query, projectPath, documents, options = {}) {
  const client = createClient();
  await client.heartbeat();

  const collectionName = getCollectionName(projectPath);
  const chunks = buildChunks(documents);
  const collection = await rebuildCollection(client, collectionName, chunks);

  if (chunks.length === 0) {
    return {
      found: false,
      query,
      resultCount: 0,
      retrievalMode: 'chroma',
      results: [],
    };
  }

  const result = await collection.query({
    queryEmbeddings: [embedText(query)],
    nResults: options.nResults || 6,
    include: ['documents', 'metadatas', 'distances'],
  });

  return formatQueryResults(query, result);
}

async function getChromaStatus() {
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
    };
  } catch (error) {
    return {
      available: false,
      host: CHROMA_HOST,
      port: CHROMA_PORT,
      error: error.message,
    };
  }
}

module.exports = {
  getChromaStatus,
  searchWithChroma,
};
