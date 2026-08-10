/* global require, module, process */
const crypto = require('crypto');
const { ChromaClient } = require('chromadb');

const CHROMA_HOST = process.env.CHROMA_HOST || 'localhost';
const CHROMA_PORT = Number(process.env.CHROMA_PORT || 8000);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

const HASH_EMBEDDING_DIMENSIONS = 512;
const TARGET_CHUNK_SIZE = 1000;
const MIN_CHUNK_SIZE = 350;
const MAX_CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 180;
const EMBED_CONCURRENCY = 4;
const INDEX_BATCH_SIZE = 100;
const DEFAULT_RESULTS = 6;

const indexCache = new Map();
let embeddingMode = null;
let embeddingDimensions = HASH_EMBEDDING_DIMENSIONS;

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

function embedTextWithHash(text) {
  const vector = new Array(HASH_EMBEDDING_DIMENSIONS).fill(0);
  const tokens = tokenize(text);

  // Signed feature hashing over words and adjacent word pairs preserves more
  // local meaning than the legacy unigram-only fallback.
  const features = tokens.concat(tokens.slice(0, -1).map((token, i) => `${token} ${tokens[i + 1]}`));
  for (const feature of features) {
    const digest = crypto.createHash('sha256').update(feature).digest();
    const index = digest.readUInt32BE(0) % HASH_EMBEDDING_DIMENSIONS;
    vector[index] += digest[4] & 1 ? -1 : 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? vector.map(value => value / magnitude) : vector;
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

async function resolveEmbeddingMode(forceRefresh = false) {
  if (embeddingMode && !forceRefresh) return embeddingMode;

  try {
    await embedTextWithOllama('drafts retrieval probe');
    embeddingMode = 'ollama';
  } catch (error) {
    console.warn(`Ollama embeddings unavailable (${OLLAMA_EMBED_MODEL}), using hash fallback:`, error.message);
    embeddingMode = 'hash';
    embeddingDimensions = HASH_EMBEDDING_DIMENSIONS;
  }
  return embeddingMode;
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

async function embedTexts(texts, requestedMode) {
  if (requestedMode === 'hash') return texts.map(embedTextWithHash);
  return mapConcurrent(texts, embedTextWithOllama);
}

function lineNumberAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

function splitOversizedUnit(unit) {
  if (unit.text.length <= MAX_CHUNK_SIZE) return [unit];

  const sentences = unit.text.match(/[^.!?\n]+(?:[.!?]+["')\]]*|$)/g) || [unit.text];
  const pieces = [];
  let text = '';
  let offset = unit.start;

  for (const sentence of sentences) {
    if (text && text.length + sentence.length > TARGET_CHUNK_SIZE) {
      pieces.push({ text: text.trim(), start: offset });
      offset += text.length;
      text = '';
    }

    if (sentence.length > MAX_CHUNK_SIZE) {
      for (let i = 0; i < sentence.length; i += TARGET_CHUNK_SIZE) {
        const part = sentence.slice(i, i + TARGET_CHUNK_SIZE).trim();
        if (part) pieces.push({ text: part, start: offset + i });
      }
      offset += sentence.length;
    } else {
      text += sentence;
    }
  }

  if (text.trim()) pieces.push({ text: text.trim(), start: offset });
  return pieces;
}

function structuralUnits(text) {
  const units = [];
  const blockPattern = /(?:^|\n)([^\n][\s\S]*?)(?=\n\s*\n|$)/g;
  let match;

  while ((match = blockPattern.exec(text)) !== null) {
    const raw = match[1];
    const leading = raw.length - raw.trimStart().length;
    const value = raw.trim();
    if (value) units.push(...splitOversizedUnit({ text: value, start: match.index + leading }));
    if (match[0].length === 0) blockPattern.lastIndex += 1;
  }

  return units;
}

function chunkText(input) {
  const text = String(input || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return [];

  const units = structuralUnits(text);
  const chunks = [];
  let current = [];
  let currentLength = 0;

  function flush() {
    if (!current.length) return;
    const content = current.map(unit => unit.text).join('\n\n').trim();
    chunks.push({
      content,
      startLine: lineNumberAt(text, current[0].start),
      endLine: lineNumberAt(text, current[current.length - 1].start + current[current.length - 1].text.length),
    });

    // Reuse complete trailing semantic units for overlap; never cut a word.
    const overlap = [];
    let overlapLength = 0;
    for (let i = current.length - 1; i >= 0; i -= 1) {
      if (overlapLength && overlapLength + current[i].text.length > CHUNK_OVERLAP) break;
      overlap.unshift(current[i]);
      overlapLength += current[i].text.length;
      if (overlapLength >= CHUNK_OVERLAP) break;
    }
    current = overlap.length === current.length ? [] : overlap;
    currentLength = current.reduce((sum, unit) => sum + unit.text.length + 2, 0);
  }

  for (const unit of units) {
    const projected = currentLength + unit.text.length + (current.length ? 2 : 0);
    const headingBoundary = /^#{1,6}\s|^[A-Z][^.!?]{0,80}:$/.test(unit.text.split('\n', 1)[0]);
    if (current.length && projected > MAX_CHUNK_SIZE) flush();
    else if (currentLength >= MIN_CHUNK_SIZE && headingBoundary) flush();
    else if (currentLength >= TARGET_CHUNK_SIZE && projected > TARGET_CHUNK_SIZE) flush();
    current.push(unit);
    currentLength += unit.text.length + (current.length > 1 ? 2 : 0);
  }
  flush();
  return chunks;
}

function buildChunks(documents) {
  return documents.flatMap(doc => chunkText(doc.content).map((chunk, index) => ({
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
  })));
}

function computeFingerprint(documents, mode) {
  const payload = documents.map(doc => `${doc.path}:${hashText(doc.content || '')}`).sort().join('|');
  return hashText(`rag-v2:${mode}:${payload}`);
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

async function rebuildCollection(client, collectionName, chunks, mode) {
  let actualMode = mode;
  let embeddings;
  try {
    embeddings = await embedTexts(chunks.map(chunk => chunk.content), mode);
  } catch (error) {
    console.warn('Ollama failed while indexing; rebuilding consistently with hash embeddings:', error.message);
    actualMode = 'hash';
    embeddingMode = 'hash';
    embeddingDimensions = HASH_EMBEDDING_DIMENSIONS;
    embeddings = chunks.map(chunk => embedTextWithHash(chunk.content));
  }

  try { await client.deleteCollection({ name: collectionName }); } catch { /* absent */ }
  const collection = await client.getOrCreateCollection({ name: collectionName, embeddingFunction: null });
  if (chunks.length) await addInBatches(collection, chunks, embeddings);
  return { collection, mode: actualMode };
}

async function ensureIndexedCollection(client, collectionName, projectPath, documents) {
  const preferredMode = await resolveEmbeddingMode();
  const fingerprint = computeFingerprint(documents, preferredMode);
  const cached = indexCache.get(projectPath);
  if (cached?.fingerprint === fingerprint && cached.collectionName === collectionName) {
    embeddingMode = cached.mode;
    return { collection: await client.getCollection({ name: collectionName }), mode: cached.mode };
  }

  const indexed = await rebuildCollection(client, collectionName, buildChunks(documents), preferredMode);
  indexCache.set(projectPath, { fingerprint: computeFingerprint(documents, indexed.mode), collectionName, mode: indexed.mode });
  return indexed;
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
    embeddingMode: embeddingMode || 'hash',
    results,
  };
}

async function searchWithChroma(query, projectPath, documents, options = {}) {
  const client = createClient();
  await client.heartbeat();
  const chunks = buildChunks(documents);
  if (!chunks.length) return formatResults(query, []);

  const collectionName = getCollectionName(projectPath);
  const { collection, mode } = await ensureIndexedCollection(client, collectionName, projectPath, documents);
  const queryEmbedding = mode === 'ollama'
    ? await embedTextWithOllama(query)
    : embedTextWithHash(query);
  const wanted = Math.max(1, Number(options.nResults) || DEFAULT_RESULTS);
  const result = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: Math.min(chunks.length, Math.max(wanted * 3, 12)),
    include: ['documents', 'metadatas', 'distances'],
  });
  return formatResults(query, rerankCandidates(query, result, wanted));
}

async function getChromaStatus() {
  await resolveEmbeddingMode();
  try {
    const client = createClient();
    await client.heartbeat();
    let version = null;
    try { version = await client.version(); } catch { /* optional */ }
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

module.exports = { getChromaStatus, searchWithChroma, invalidateProjectIndex };
