// electron/ai/graph.js
// Agent workflow graph: orchestrates the multi-node flow

const { StateGraph, Annotation, START, END } = require('@langchain/langgraph');
const { understandNode, executeNode, respondNode } = require('./nodes');
const { getCheckpointer } = require('./checkpointer');
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
  ragEnabled: Annotation(),
  modelName: Annotation(),
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

function checkpointNode(name, node) {
  return async (state, config) => {
    console.log(`\n--- NODE: ${name.toUpperCase()} ---`);
    return node({
      ...state,
      streamWriter: config?.configurable?.streamWriter || null
    });
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
    .compile({ checkpointer: getCheckpointer() });

  return compiledAgentGraph;
}

/**
 * Run the agent graph: understand → execute → respond
 * @param {Object} initialState - Initial agent state
 * @param {Object} config - Configuration including threadId
 * @returns {Promise<Object>} Final agent state
 */
const runAgentGraph = traceable(async function runAgentGraph(initialState, config = {}) {
  const { threadId, streamWriter } = config;
  
  console.log('\n🚀 Starting agent graph...');
  console.log('Thread ID:', threadId);
  
  const state = { ...initialState, threadId };
  
  try {
    const graph = buildAgentGraph();
    const result = await graph.invoke(state, {
      configurable: {
        thread_id: threadId,
        streamWriter: streamWriter || null
      }
    });
    
    console.log('\n✅ Agent graph completed\n');
    
    return result;
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
