const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

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

  console.log('Database tables initialized');
}

// ===== PROJECT FUNCTIONS =====

function addRecentProject(projectId, name, projectPath) {
  const stmt = db.prepare(`
    INSERT INTO projects (id, name, path, last_opened)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(path) DO UPDATE SET
      name = excluded.name,
      last_opened = CURRENT_TIMESTAMP
  `);

  stmt.run(projectId, name, projectPath);
}

function getRecentProjects(limit = 10) {
  const stmt = db.prepare(`
    SELECT * FROM projects
    ORDER BY last_opened DESC
    LIMIT ?
  `);

  return stmt.all(limit);
}

function updateProjectLastOpened(projectPath) {
  const stmt = db.prepare(`
    UPDATE projects 
    SET last_opened = CURRENT_TIMESTAMP
    WHERE path = ?
  `);

  stmt.run(projectPath);
}

function deleteProject(projectPath) {
  const stmt = db.prepare('DELETE FROM projects WHERE path = ?');
  stmt.run(projectPath);
}

// ===== PREFERENCES FUNCTIONS =====

function setPreference(key, value) {
  const stmt = db.prepare(`
    INSERT INTO preferences (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(key, JSON.stringify(value));
}

function getPreference(key, defaultValue = null) {
  const stmt = db.prepare('SELECT value FROM preferences WHERE key = ?');
  const row = stmt.get(key);

  if (!row) return defaultValue;

  try {
    return JSON.parse(row.value);
  } catch (e) {
    return row.value;
  }
}

function getAllPreferences() {
  const stmt = db.prepare('SELECT key, value FROM preferences');
  const rows = stmt.all();

  const prefs = {};
  rows.forEach(row => {
    try {
      prefs[row.key] = JSON.parse(row.value);
    } catch (e) {
      prefs[row.key] = row.value;
    }
  });

  return prefs;
}

// ===== CONVERSATION FUNCTIONS =====

function saveMessage(projectPath, threadId, role, content) {
  const stmt = db.prepare(`
    INSERT INTO conversations (project_path, thread_id, role, content)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(projectPath, threadId, role, content);
}

function getConversationHistory(threadId, limit = 50) {
  const stmt = db.prepare(`
    SELECT role, content, created_at
    FROM conversations
    WHERE thread_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `);

  return stmt.all(threadId, limit);
}

function getProjectConversations(projectPath) {
  const stmt = db.prepare(`
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
  const stmt = db.prepare('DELETE FROM conversations WHERE thread_id = ?');
  stmt.run(threadId);
}

function clearOldConversations(daysOld = 30) {
  const stmt = db.prepare(`
    DELETE FROM conversations 
    WHERE created_at < datetime('now', '-' || ? || ' days')
  `);

  const result = stmt.run(daysOld);
  return result.changes;
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
};