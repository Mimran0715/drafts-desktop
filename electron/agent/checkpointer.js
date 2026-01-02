// electron/agent/checkpointer.js
// SQLite-based checkpointer for conversation state management

const { getDatabase } = require('../database.js');

let db = null;
let isSetup = false;

/**
 * Initialize checkpointer tables in SQLite
 */
function setupCheckpointer() {
  if (isSetup) return;
  
  db = getDatabase();
  
  // Create checkpoints table for conversation state
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkpoints (
      thread_id TEXT NOT NULL,
      checkpoint_id TEXT NOT NULL,
      parent_checkpoint_id TEXT,
      state_data TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (thread_id, checkpoint_id)
    )
  `);
  
  // Index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_created 
    ON checkpoints(thread_id, created_at DESC)
  `);
  
  console.log('✅ Checkpointer tables ready');
  isSetup = true;
}

/**
 * Save a checkpoint for a conversation thread
 * @param {string} threadId - Thread identifier
 * @param {Object} state - Agent state to save
 * @returns {string} checkpoint ID
 */
function saveCheckpoint(threadId, state) {
  setupCheckpointer();
  
  const checkpointId = `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Get the last checkpoint to link as parent
  const lastCheckpoint = db.prepare(`
    SELECT checkpoint_id FROM checkpoints 
    WHERE thread_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(threadId);
  
  const parentCheckpointId = lastCheckpoint ? lastCheckpoint.checkpoint_id : null;
  
  // Serialize state (remove non-serializable content)
  const serializableState = {
    ...state,
    messages: state.messages?.map(msg => ({
      role: msg.constructor.name.replace('Message', '').toLowerCase(),
      content: msg.content
    })) || []
  };
  
  db.prepare(`
    INSERT INTO checkpoints (thread_id, checkpoint_id, parent_checkpoint_id, state_data)
    VALUES (?, ?, ?, ?)
  `).run(threadId, checkpointId, parentCheckpointId, JSON.stringify(serializableState));
  
  return checkpointId;
}

/**
 * Get the latest checkpoint for a thread
 * @param {string} threadId - Thread identifier
 * @returns {Object|null} Checkpoint state or null if not found
 */
function getLatestCheckpoint(threadId) {
  setupCheckpointer();
  
  const checkpoint = db.prepare(`
    SELECT state_data, checkpoint_id, created_at 
    FROM checkpoints 
    WHERE thread_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(threadId);
  
  if (!checkpoint) return null;
  
  return {
    checkpointId: checkpoint.checkpoint_id,
    createdAt: checkpoint.created_at,
    state: JSON.parse(checkpoint.state_data)
  };
}

/**
 * Get all checkpoints for a thread
 * @param {string} threadId - Thread identifier
 * @param {number} limit - Maximum number of checkpoints to return
 * @returns {Array} Array of checkpoints
 */
function getThreadCheckpoints(threadId, limit = 10) {
  setupCheckpointer();
  
  const checkpoints = db.prepare(`
    SELECT checkpoint_id, parent_checkpoint_id, state_data, created_at 
    FROM checkpoints 
    WHERE thread_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(threadId, limit);
  
  return checkpoints.map(cp => ({
    checkpointId: cp.checkpoint_id,
    parentCheckpointId: cp.parent_checkpoint_id,
    createdAt: cp.created_at,
    state: JSON.parse(cp.state_data)
  }));
}

/**
 * Clear old checkpoints (keep only recent N per thread)
 * @param {number} keepCount - Number of recent checkpoints to keep per thread
 */
function cleanupOldCheckpoints(keepCount = 50) {
  setupCheckpointer();
  
  // Get all thread IDs
  const threads = db.prepare(`
    SELECT DISTINCT thread_id FROM checkpoints
  `).all();
  
  threads.forEach(({ thread_id }) => {
    // Delete all but the most recent N checkpoints for this thread
    db.prepare(`
      DELETE FROM checkpoints 
      WHERE thread_id = ? 
      AND checkpoint_id NOT IN (
        SELECT checkpoint_id 
        FROM checkpoints 
        WHERE thread_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      )
    `).run(thread_id, thread_id, keepCount);
  });
}

module.exports = {
  setupCheckpointer,
  saveCheckpoint,
  getLatestCheckpoint,
  getThreadCheckpoints,
  cleanupOldCheckpoints
};