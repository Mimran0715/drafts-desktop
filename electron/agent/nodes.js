// electron/agent/nodes.js
// Multi-node agent architecture: understand → execute → respond

const { ChatOllama } = require('@langchain/ollama');
const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');
const { searchContext, analyzeDraft, generateText, askQuestion } = require('./tools');

const model = new ChatOllama({
  model: 'llama3.1',
  temperature: 0.7,
});

/**
 * UNDERSTAND NODE
 * Analyzes user's message to determine intent and what they need
 * @param {Object} state - Current agent state
 * @returns {Promise<Object>} Updated state with userIntent
 */
async function understandNode(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  const messageContent = typeof lastMessage.content === 'string' 
    ? lastMessage.content 
    : String(lastMessage.content);
  
  const prompt = `Analyze this user request: "${messageContent}"

The user is working on a creative writing project.
Active document: ${state.activeDocumentPath || 'none'}
Project: ${state.projectPath || 'none'}

What does the user want? Categorize their intent:
- "search" - They want to find or recall information from their documents
- "analyze" - They want feedback or analysis of their writing
- "generate" - They want to write, continue, or expand content
- "question" - They have a general question or need clarification
- "conversational" - Just chatting, no specific tool needed

Respond with ONLY the category and a brief 1-sentence explanation.
Format: CATEGORY: explanation`;

  console.log('🧠 Understanding user request...');
  
  try {
    const response = await model.invoke([
      new SystemMessage("You are analyzing user intent for a writing assistant."),
      new HumanMessage(prompt)
    ]);
    
    const intent = typeof response.content === 'string' 
      ? response.content 
      : String(response.content);
    
    console.log('💡 User intent:', intent);
    
    return {
      userIntent: intent,
      iterationCount: state.iterationCount + 1
    };
  } catch (error) {
    console.error('Error in understand node:', error);
    return {
      userIntent: 'conversational: Could not determine intent',
      iterationCount: state.iterationCount + 1
    };
  }
}

/**
 * EXECUTE NODE
 * Runs appropriate tools based on understood intent
 * @param {Object} state - Current agent state
 * @returns {Promise<Object>} Updated state with gatheredInfo
 */
async function executeNode(state) {
  const gatheredInfo = { ...state.gatheredInfo };
  const intent = (state.userIntent || '').toLowerCase();
  const userMessage = state.messages[state.messages.length - 1];
  const messageContent = typeof userMessage.content === 'string'
    ? userMessage.content
    : String(userMessage.content);
  
  console.log('⚙️ Executing tools based on intent...');
  console.log('Intent category:', intent);
  
  try {
    // SEARCH - Find information in project documents
    if (intent.includes('search') || intent.includes('find')) {
      console.log('🔍 Running searchContext tool...');
      
      // Extract search terms (remove common words)
      const searchTerms = messageContent
        .toLowerCase()
        .replace(/find|search|look|looking|information|about|out|for|what|is|tell|me|the|a|an|where|when|who/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      const searchQuery = searchTerms || messageContent;
      console.log('Search query:', searchQuery);
      
      const searchResults = await searchContext(
        searchQuery,
        state.projectPath
      );
      
      gatheredInfo.searchResults = searchResults;
    }
    
    // ANALYZE - Provide feedback on writing
    if (intent.includes('analyze') || intent.includes('feedback') || intent.includes('review')) {
      console.log('📝 Running analyzeDraft tool...');
      
      if (state.activeDocumentPath) {
        const analysis = await analyzeDraft(
          state.activeDocumentPath,
          state.projectPath
        );
        gatheredInfo.analysis = analysis;
      } else {
        gatheredInfo.analysis = {
          success: false,
          message: "No active document to analyze"
        };
      }
    }
    
    // GENERATE - Create new content
    if (intent.includes('generate') || intent.includes('write') || intent.includes('continue') || intent.includes('help me write')) {
      console.log('✍️ Running generateText tool...');
      
      const generated = await generateText(
        messageContent,
        state.projectPath,
        state.activeDocumentPath
      );
      gatheredInfo.generated = generated;
    }
    
    // QUESTION - Need clarification
    if (intent.includes('question') && !gatheredInfo.searchResults && !gatheredInfo.analysis && !gatheredInfo.generated) {
      console.log('❓ User needs clarification...');
      
      const clarification = await askQuestion(messageContent);
      gatheredInfo.clarification = clarification;
    }
    
    // CONVERSATIONAL - No tool needed
    if (intent.includes('conversational')) {
      console.log('💬 Conversational response (no tools needed)');
      gatheredInfo.conversational = true;
    }
    
    console.log('✅ Gathered info:', Object.keys(gatheredInfo));
    
    return {
      gatheredInfo,
      iterationCount: state.iterationCount + 1
    };
  } catch (error) {
    console.error('Error in execute node:', error);
    return {
      gatheredInfo: {
        ...gatheredInfo,
        error: error.message
      },
      iterationCount: state.iterationCount + 1
    };
  }
}

/**
 * RESPOND NODE
 * Synthesizes gathered information into a helpful response
 * @param {Object} state - Current agent state
 * @returns {Promise<Object>} Updated state with AI response message
 */
async function respondNode(state) {
  const userMessage = state.messages[state.messages.length - 1];
  const messageContent = typeof userMessage.content === 'string'
    ? userMessage.content
    : String(userMessage.content);
  
  // Build context from gathered information
  let contextSummary = '';
  
  if (state.gatheredInfo.searchResults) {
    const sr = state.gatheredInfo.searchResults;
    if (sr.found && sr.results.length > 0) {
      contextSummary += '\n\nSearch Results:\n';
      sr.results.forEach(result => {
        contextSummary += `\nFrom "${result.documentName}":\n`;
        result.matches.forEach(match => {
          contextSummary += `- ${match.context}\n`;
        });
      });
    } else {
      contextSummary += '\n\nNo relevant information found in project documents.';
    }
  }
  
  if (state.gatheredInfo.analysis) {
    const analysis = state.gatheredInfo.analysis;
    if (analysis.success) {
      contextSummary += '\n\nDocument Analysis:\n';
      contextSummary += `Document: ${analysis.documentName}\n`;
      contextSummary += `Word count: ${analysis.wordCount}\n`;
      contextSummary += `\n${analysis.analysis}`;
    } else {
      contextSummary += `\n\nCould not analyze document: ${analysis.message}`;
    }
  }
  
  if (state.gatheredInfo.generated) {
    const gen = state.gatheredInfo.generated;
    if (gen.success) {
      contextSummary += '\n\nGenerated Content:\n';
      contextSummary += gen.generated;
    } else {
      contextSummary += `\n\nCould not generate content: ${gen.message}`;
    }
  }
  
  if (state.gatheredInfo.clarification) {
    contextSummary += '\n\nNeed clarification from user.';
  }
  
  if (state.gatheredInfo.conversational) {
    contextSummary += '\n\nGeneral conversation - no specific tools needed.';
  }
  
  const systemPrompt = `You are a warm, supportive writing companion helping a creative writer.

Your personality:
- Encouraging and genuinely interested in their work
- Specific and thoughtful (never generic)
- Conversational and friendly
- Honest but kind

User's request: "${messageContent}"
Intent: ${state.userIntent}

${contextSummary}

Provide a helpful, conversational response that:
1. Directly addresses their request
2. Uses the gathered information naturally
3. Offers specific, actionable suggestions when relevant
4. Stays encouraging and supportive
5. Keeps it concise but thorough

If you're responding with generated content, present it naturally.
If providing feedback, be specific and constructive.
If no relevant info was found, be honest but helpful.`;

  console.log('💬 Generating final response...');
  
  try {
    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage("Provide your response now.")
    ]);
    
    const responseText = typeof response.content === 'string' 
      ? response.content 
      : String(response.content);
    
    console.log('✅ Response generated');
    
    return {
      messages: [new AIMessage(responseText)]
    };
  } catch (error) {
    console.error('Error in respond node:', error);
    return {
      messages: [new AIMessage(`I encountered an error: ${error.message}. Please try again.`)]
    };
  }
}

module.exports = {
  understandNode,
  executeNode,
  respondNode
};