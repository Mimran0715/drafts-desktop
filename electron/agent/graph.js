// electron/agent/graph.js
// Agent workflow graph: orchestrates the multi-node flow

const { understandNode, executeNode, respondNode } = require('./nodes');
const { saveCheckpoint, getLatestCheckpoint } = require('./checkpointer');

/**
 * Run the agent graph: understand → execute → respond
 * @param {Object} initialState - Initial agent state
 * @param {Object} config - Configuration including threadId
 * @returns {Promise<Object>} Final agent state
 */
async function runAgentGraph(initialState, config = {}) {
  const { threadId } = config;
  
  console.log('\n🚀 Starting agent graph...');
  console.log('Thread ID:', threadId);
  
  // Load previous state if continuing a conversation
  let state = { ...initialState };
  
  if (threadId) {
    const checkpoint = getLatestCheckpoint(threadId);
    if (checkpoint) {
      console.log('📦 Loaded checkpoint from', checkpoint.createdAt);
      // Merge checkpoint state with new message
      state = {
        ...checkpoint.state,
        ...initialState,
        messages: [...(checkpoint.state.messages || []), ...initialState.messages],
        iterationCount: checkpoint.state.iterationCount || 0
      };
    }
  }
  
  try {
    // NODE 1: UNDERSTAND
    console.log('\n--- NODE 1: UNDERSTAND ---');
    const understandResult = await understandNode(state);
    state = { ...state, ...understandResult };
    
    // Save checkpoint after understand
    if (threadId) {
      saveCheckpoint(threadId, state);
    }
    
    // NODE 2: EXECUTE
    console.log('\n--- NODE 2: EXECUTE ---');
    const executeResult = await executeNode(state);
    state = { ...state, ...executeResult };
    
    // Save checkpoint after execute
    if (threadId) {
      saveCheckpoint(threadId, state);
    }
    
    // NODE 3: RESPOND
    console.log('\n--- NODE 3: RESPOND ---');
    const respondResult = await respondNode(state);
    state = { ...state, ...respondResult };
    
    // Save final checkpoint
    if (threadId) {
      saveCheckpoint(threadId, state);
    }
    
    console.log('\n✅ Agent graph completed\n');
    
    return state;
  } catch (error) {
    console.error('❌ Error in agent graph:', error);
    throw error;
  }
}

/**
 * Get or create agent graph (for compatibility with LangGraph API)
 * In our simplified version, this just returns the runAgentGraph function
 */
async function getAgentGraph() {
  return {
    invoke: runAgentGraph
  };
}

module.exports = {
  runAgentGraph,
  getAgentGraph
};