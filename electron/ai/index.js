// electron/ai/index.js
// Main entry point for the agent

const { HumanMessage } = require('@langchain/core/messages');
const { runAgentGraph } = require('./graph');
const { createInitialState } = require('./state');
const db = require('../database.js');
const { OLLAMA_MODEL } = require('./config');

function cleanChatOutput(content) {
  return content
    .replace(/^\s*\*\s+/gm, '- ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\*/g, '');
}

/**
 * Run the multi-node agent
 * @param {Object} params - Agent parameters
 * @param {string} params.message - User message
 * @param {string} params.userId - User ID
 * @param {string} params.projectPath - Path to project folder
 * @param {string} params.activeDocumentPath - Path to active document
 * @param {string} [params.threadId] - Thread ID for conversation continuity
 * @param {Object} [params.liveContent] - Live content from editor {name, content, path}
 * @param {boolean} [params.ragEnabled] - Whether to retrieve project context for this request
 * @param {string} [params.modelName] - Ollama model name to use
 * @param {Function} [params.onToken] - Optional callback for streamed chat output chunks
 * @returns {Promise<Object>} Agent response
 */
async function runAgent(params) {
  const { message, userId, projectPath, activeDocumentPath, threadId, liveContent, ragEnabled, modelName, onToken } = params;
  
  // Generate thread ID if not provided
  const thread = threadId || `thread_${Date.now()}`;
  
  console.log('\n' + '='.repeat(60));
  console.log('🤖 RUNNING MULTI-NODE AGENT');
  console.log('='.repeat(60));
  console.log('User:', userId);
  console.log('Project:', projectPath);
  console.log('Active Document:', activeDocumentPath);
  console.log('Thread:', thread);
  console.log('Message:', message);
  console.log('Model:', modelName || OLLAMA_MODEL);
  console.log('Live Content:', liveContent ? 'Yes' : 'No');
  console.log('='.repeat(60) + '\n');
  
  try {
    // Save user message to database
    db.saveMessage(projectPath, thread, 'user', message);
    
    // Create initial state with live content
    const initialState = {
      ...createInitialState(message, userId, projectPath, activeDocumentPath),
      messages: [new HumanMessage(message)],
      liveContent: liveContent, // Pass live content to tools
      ragEnabled: !!ragEnabled,
      modelName: modelName || OLLAMA_MODEL,
      streamWriter: typeof onToken === 'function' ? onToken : null
    };
    
    // Run the agent graph
    const result = await runAgentGraph(initialState, {
      threadId: thread
    });
    
    // Extract final response
    const lastMessage = result.messages[result.messages.length - 1];
    const rawResponseContent = typeof lastMessage.content === 'string'
      ? lastMessage.content
      : String(lastMessage.content);
    const responseContent = cleanChatOutput(rawResponseContent);
    
    // Save agent response to database
    db.saveMessage(projectPath, thread, 'agent', responseContent);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ AGENT COMPLETED');
    console.log('='.repeat(60));
    
    // Check if there's generated text to return separately
    const generatedText = result.generatedText || null;
    if (generatedText) {
      console.log('📝 Generated text included for editor insertion');
    }
    
    return {
      response: responseContent,
      threadId: thread,
      userIntent: result.userIntent,
      gatheredInfo: result.gatheredInfo,
      generatedText: generatedText, // NEW: Pass generated text to frontend
      timestamp: new Date()
    };
  } catch (error) {
    console.error('\n❌ Agent error:', error);
    
    // Return error response
    return {
      response: cleanChatOutput(`I encountered an error: ${error.message}. Please try again.`),
      threadId: thread,
      error: error.message,
      timestamp: new Date()
    };
  }
}

module.exports = {
  runAgent
};
