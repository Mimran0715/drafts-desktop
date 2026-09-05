const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db = null;

function getDatabase() {
  if (db) return db;

  // Get the user data directory (creates if doesn't exist)
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'app.db');

  console.log('Database path:', dbPath);

  // Create database connection
  db = new Database(dbPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Initialize tables
  initializeTables();

  return db;
}

function initializeTables() {
  // Recent projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      last_opened TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User preferences table
  db.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Conversation threads table
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_path TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Index for faster conversation queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_thread 
    ON conversations(thread_id, created_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_project 
    ON conversations(project_path, created_at DESC)
  `);

  // Authoritative chunk lineage. Chroma stores the text and vectors; SQLite
  // records which vectors are current so edits can be reconciled incrementally.
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      chunk_id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      folder_id TEXT NOT NULL,
      chunk_hash TEXT NOT NULL,
      chroma_vector_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      stale INTEGER NOT NULL DEFAULT 0 CHECK (stale IN (0, 1))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_chunks_folder_active
    ON chunks(folder_id, stale)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_chunks_document_active
    ON chunks(document_id, stale)
  `);

  console.log('Database tables initialized');
}

// ===== PROJECT FUNCTIONS =====

function addRecentProject(projectId, name, projectPath) {
  const stmt = getDatabase().prepare(`
    INSERT INTO projects (id, name, path, last_opened)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(path) DO UPDATE SET
      name = excluded.name,
      last_opened = CURRENT_TIMESTAMP
  `);

  stmt.run(projectId, name, projectPath);
}

function getRecentProjects(limit = 10) {
  const stmt = getDatabase().prepare(`
    SELECT * FROM projects
    ORDER BY last_opened DESC
    LIMIT ?
  `);

  return stmt.all(limit);
}

function updateProjectLastOpened(projectPath) {
  const stmt = getDatabase().prepare(`
    UPDATE projects 
    SET last_opened = CURRENT_TIMESTAMP
    WHERE path = ?
  `);

  stmt.run(projectPath);
}

function deleteProject(projectPath) {
  const stmt = getDatabase().prepare('DELETE FROM projects WHERE path = ?');
  stmt.run(projectPath);
}

// ===== PREFERENCES FUNCTIONS =====

function setPreference(key, value) {
  const stmt = getDatabase().prepare(`
    INSERT INTO preferences (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(key, JSON.stringify(value));
}

function getPreference(key, defaultValue = null) {
  const stmt = getDatabase().prepare('SELECT value FROM preferences WHERE key = ?');
  const row = stmt.get(key);

  if (!row) return defaultValue;

  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

function getAllPreferences() {
  const stmt = getDatabase().prepare('SELECT key, value FROM preferences');
  const rows = stmt.all();

  const prefs = {};
  rows.forEach(row => {
    try {
      prefs[row.key] = JSON.parse(row.value);
    } catch {
      prefs[row.key] = row.value;
    }
  });

  return prefs;
}

// ===== CONVERSATION FUNCTIONS =====

function saveMessage(projectPath, threadId, role, content) {
  const stmt = getDatabase().prepare(`
    INSERT INTO conversations (project_path, thread_id, role, content)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(projectPath, threadId, role, content);
}

function getConversationHistory(threadId, limit = 50) {
  const stmt = getDatabase().prepare(`
    SELECT role, content, created_at
    FROM conversations
    WHERE thread_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `);

  return stmt.all(threadId, limit);
}

function getProjectConversations(projectPath) {
  const stmt = getDatabase().prepare(`
    SELECT DISTINCT thread_id, 
           MIN(created_at) as started_at,
           MAX(created_at) as last_message_at,
           COUNT(*) as message_count
    FROM conversations
    WHERE project_path = ?
    GROUP BY thread_id
    ORDER BY last_message_at DESC
  `);

  return stmt.all(projectPath);
}

function deleteConversation(threadId) {
  const stmt = getDatabase().prepare('DELETE FROM conversations WHERE thread_id = ?');
  stmt.run(threadId);
}

function clearOldConversations(daysOld = 30) {
  const stmt = getDatabase().prepare(`
    DELETE FROM conversations 
    WHERE created_at < datetime('now', '-' || ? || ' days')
  `);

  const result = stmt.run(daysOld);
  return result.changes;
}

// ===== CHUNK LEDGER FUNCTIONS =====

function getActiveChunks(folderId) {
  return getDatabase().prepare(`
    SELECT chunk_id, document_id, folder_id, chunk_hash, chroma_vector_id, created_at
    FROM chunks
    WHERE folder_id = ? AND stale = 0
  `).all(folderId);
}

function reconcileChunks(folderId, activeChunks, staleChunkIds) {
  const database = getDatabase();
  const markStale = database.prepare(`
    UPDATE chunks SET stale = 1
    WHERE folder_id = ? AND chunk_id = ?
  `);
  const upsert = database.prepare(`
    INSERT INTO chunks (
      chunk_id, document_id, folder_id, chunk_hash, chroma_vector_id, stale
    ) VALUES (?, ?, ?, ?, ?, 0)
    ON CONFLICT(chunk_id) DO UPDATE SET
      document_id = excluded.document_id,
      folder_id = excluded.folder_id,
      chunk_hash = excluded.chunk_hash,
      chroma_vector_id = excluded.chroma_vector_id,
      stale = 0
  `);

  database.transaction(() => {
    for (const chunkId of staleChunkIds) {
      markStale.run(folderId, chunkId);
    }
    for (const chunk of activeChunks) {
      upsert.run(
        chunk.chunkId,
        chunk.documentId,
        folderId,
        chunk.chunkHash,
        chunk.chromaVectorId
      );
    }
  })();
}

// ===== EXPORT =====

module.exports = {
  getDatabase,
  // Projects
  addRecentProject,
  getRecentProjects,
  updateProjectLastOpened,
  deleteProject,
  // Preferences
  setPreference,
  getPreference,
  getAllPreferences,
  // Conversations
  saveMessage,
  getConversationHistory,
  getProjectConversations,
  deleteConversation,
  clearOldConversations,
  // Chunk ledger
  getActiveChunks,
  reconcileChunks,
};
