// electron/agent/graph.js
// Agent workflow graph: orchestrates the multi-node flow

const { StateGraph, Annotation, START, END } = require('@langchain/langgraph');
const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');
const { understandNode, executeNode, respondNode } = require('./nodes');
const { saveCheckpoint, getLatestCheckpoint } = require('./checkpointer');
const { traceable } = require('langsmith/traceable');

const AgentStateAnnotation = Annotation.Root({
  messages: Annotation({
    reducer: (left = [], right = []) => {
      const nextMessages = Array.isArray(right) ? right : [right];
      return left.concat(nextMessages.filter(Boolean));
    },
    default: () => [],
  }),
  userId: Annotation(),
  projectPath: Annotation(),
  activeDocumentPath: Annotation(),
  liveContent: Annotation(),
  threadId: Annotation(),
  userIntent: Annotation(),
  gatheredInfo: Annotation({
    reducer: (left = {}, right = {}) => ({ ...left, ...right }),
    default: () => ({}),
  }),
  generatedText: Annotation(),
  iterationCount: Annotation({
    default: () => 0,
  }),
});

let compiledAgentGraph = null;

function hydrateMessage(message) {
  if (!message || typeof message !== 'object') {
    return message;
  }

  if (message._getType || message.constructor?.name?.endsWith('Message')) {
    return message;
  }

  const role = message.role || message.type;
  const content = message.content || '';

  if (role === 'human' || role === 'user') {
    return new HumanMessage(content);
  }

  if (role === 'ai' || role === 'assistant' || role === 'agent') {
    return new AIMessage(content);
  }

  if (role === 'system') {
    return new SystemMessage(content);
  }

  return message;
}

function mergeNodeUpdateForCheckpoint(state, update) {
  if (!update) return state;

  const nextState = { ...state, ...update };
  if (Object.prototype.hasOwnProperty.call(update, 'messages')) {
    const updateMessages = Array.isArray(update.messages) ? update.messages : [update.messages];
    nextState.messages = [...(state.messages || []), ...updateMessages.filter(Boolean)];
  }

  if (Object.prototype.hasOwnProperty.call(update, 'gatheredInfo')) {
    nextState.gatheredInfo = {
      ...(state.gatheredInfo || {}),
      ...(update.gatheredInfo || {}),
    };
  }

  return nextState;
}

function checkpointNode(name, node) {
  return async (state) => {
    console.log(`\n--- NODE: ${name.toUpperCase()} ---`);
    const update = await node(state);

    if (state.threadId) {
      saveCheckpoint(state.threadId, mergeNodeUpdateForCheckpoint(state, update));
    }

    return update;
  };
}

function buildAgentGraph() {
  if (compiledAgentGraph) {
    return compiledAgentGraph;
  }

  compiledAgentGraph = new StateGraph(AgentStateAnnotation)
    .addNode('understand', checkpointNode('understand', understandNode))
    .addNode('execute', checkpointNode('execute', executeNode))
    .addNode('respond', checkpointNode('respond', respondNode))
    .addEdge(START, 'understand')
    .addEdge('understand', 'execute')
    .addEdge('execute', 'respond')
    .addEdge('respond', END)
    .compile();

  return compiledAgentGraph;
}

/**
 * Run the agent graph: understand → execute → respond
 * @param {Object} initialState - Initial agent state
 * @param {Object} config - Configuration including threadId
 * @returns {Promise<Object>} Final agent state
 */
const runAgentGraph = traceable(async function runAgentGraph(initialState, config = {}) {
  const { threadId } = config;
  
  console.log('\n🚀 Starting agent graph...');
  console.log('Thread ID:', threadId);
  
  // Load previous state if continuing a conversation
  let state = { ...initialState, threadId };
  
  if (threadId) {
    const checkpoint = getLatestCheckpoint(threadId);
    if (checkpoint) {
      console.log('📦 Loaded checkpoint from', checkpoint.createdAt);
      const checkpointMessages = (checkpoint.state.messages || []).map(hydrateMessage);

      // Merge checkpoint state with new message
      state = {
        ...checkpoint.state,
        ...initialState,
        threadId,
        messages: [...checkpointMessages, ...initialState.messages],
        gatheredInfo: checkpoint.state.gatheredInfo || {},
        iterationCount: checkpoint.state.iterationCount || 0
      };
    }
  }
  
  try {
    const graph = buildAgentGraph();
    state = await graph.invoke(state);
    
    console.log('\n✅ Agent graph completed\n');
    
    return state;
  } catch (error) {
    console.error('❌ Error in agent graph:', error);
    throw error;
  }
}, {
  name: 'agent_graph',
  run_type: 'chain',
});

/**
 * Get or create agent graph (for compatibility with LangGraph API)
 */
async function getAgentGraph() {
  return buildAgentGraph();
}

module.exports = {
  runAgentGraph,
  getAgentGraph,
  buildAgentGraph
};
