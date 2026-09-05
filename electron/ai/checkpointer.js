// electron/ai/checkpointer.js
// LangGraph-native SQLite checkpoint persistence.

const { SqliteSaver } = require('@langchain/langgraph-checkpoint-sqlite');
const { getDatabase } = require('../database.js');

let checkpointer = null;

function hasColumn(columns, name) {
  return columns.some(column => column.name === name);
}

function preserveLegacyCheckpointTable(db) {
  const columns = db.prepare('PRAGMA table_info(checkpoints)').all();
  if (columns.length === 0 || hasColumn(columns, 'checkpoint_ns')) return;

  // The former custom saver used the same table name as LangGraph's saver but
  // an incompatible schema. Retain it for recovery instead of deleting data.
  let suffix = '';
  let attempt = 0;
  while (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(`checkpoints_legacy_custom${suffix}`)) {
    attempt += 1;
    suffix = `_${attempt}`;
  }

  const legacyTable = `checkpoints_legacy_custom${suffix}`;
  db.exec(`ALTER TABLE checkpoints RENAME TO ${legacyTable}`);
  console.log(`Preserved legacy checkpoints in ${legacyTable}`);
}

function getCheckpointer() {
  if (checkpointer) return checkpointer;

  const db = getDatabase();
  preserveLegacyCheckpointTable(db);
  checkpointer = new SqliteSaver(db);
  return checkpointer;
}

module.exports = {
  getCheckpointer
};
