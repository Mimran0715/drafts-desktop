// electron/agent/state.js

/**
 * AgentState interface definition
 * @typedef {Object} AgentState
 * @property {Array} messages - Array of messages (HumanMessage, AIMessage, etc.)
 * @property {string} userId - User identifier
 * @property {string} projectPath - Path to the project folder
 * @property {string} activeDocumentPath - Path to active document
 * @property {string} [userIntent] - Understood user intent
 * @property {Object} [gatheredInfo] - Information gathered during execution
 * @property {number} iterationCount - Current iteration count
 */

/**
 * Create initial agent state
 * @param {string} message - User message
 * @param {string} userId - User ID
 * @param {string} projectPath - Project folder path
 * @param {string} activeDocumentPath - Active document path
 * @returns {Partial<AgentState>}
 */
function createInitialState(message, userId, projectPath, activeDocumentPath) {
  return {
    userId,
    projectPath,
    activeDocumentPath,
    iterationCount: 0,
    gatheredInfo: {},
    messages: []
  };
}

module.exports = {
  createInitialState
};