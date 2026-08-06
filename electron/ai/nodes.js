// electron/ai/nodes.js
// Multi-node agent architecture: understand → execute → respond

const { ChatOllama } = require('@langchain/ollama');
const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');
const { searchContext, analyzeDraft, generateText, askQuestion } = require('./tools');
const { traceable } = require('langsmith/traceable');

const MODEL = "llama-writer";
const modelCache = new Map();

function getModel(modelName = MODEL) {
  const name = modelName || MODEL;
  if (!modelCache.has(name)) {
    modelCache.set(name, new ChatOllama({
      model: name,
      temperature: 0.7,
    }));
  }

  return modelCache.get(name);
}

function chunkContentToText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && typeof part.text === 'string') return part.text;
        return '';
      })
      .join('');
  }
  return content ? String(content) : '';
}

async function invokeModel(messages, options = {}) {
  const model = getModel(options.modelName);

  if (!options.onToken) {
    const response = await model.invoke(messages);
    return chunkContentToText(response.content);
  }

  let content = '';
  const stream = await model.stream(messages);

  for await (const chunk of stream) {
    const text = chunkContentToText(chunk.content);
    if (!text) continue;
    content += text;
    options.onToken(text);
  }

  return content;
}

function classifyIntentFromText(messageContent) {
  const text = messageContent.toLowerCase();

  if (/\b(analy[sz]e|analysis|feedback|review|critique|thoughts|draft so far)\b/.test(text)) {
    return 'analyze: The user wants feedback or analysis of their writing.';
  }

  if (/\b(find|search|look up|locate|where did|what did|who is|recall)\b/.test(text)) {
    return 'search: The user wants to find or recall information from their documents.';
  }

  if (/\b(continue|write|generate|expand|add|draft|compose|help me write|revise|rewrite|alter|change|try again|different|instead|shorter|longer)\b/.test(text) || /^(more|less)\b/.test(text)) {
    return 'generate: The user wants to write, continue, or expand content.';
  }

  if (text.includes('?') || /\b(question|explain|how|why|what|should i|can i)\b/.test(text)) {
    return 'question: The user has a general question or needs clarification.';
  }

  return 'conversational: Just chatting, no specific tool needed.';
}

function isAmbiguousConversationalIntent(intent, messageContent) {
  const text = messageContent.trim().toLowerCase();
  return intent.startsWith('conversational') && !/^(hi|hello|hey|yo|thanks|thank you|ok|okay|cool|nice)[.!? ]*$/.test(text);
}

function formatToolFallbackResponse(state, errorMessage) {
  const info = state.gatheredInfo || {};

  if (info.generated?.success) {
    return "I wrote a continuation for you, but had trouble generating the chat wrapper. You can review the inserted suggestion in the editor.";
  }

  if (info.analysis) {
    if (info.analysis.success) {
      return `I was able to analyze "${info.analysis.documentName}" (${info.analysis.wordCount} words), but had trouble polishing the final reply.\n\n${info.analysis.analysis}`;
    }

    return `I tried to analyze the active document, but couldn't finish: ${info.analysis.message}`;
  }

  if (info.searchResults) {
    const results = info.searchResults;
    if (!results.found || results.results.length === 0) {
      return "I searched your project documents, but I didn't find a matching passage.";
    }

    const snippets = results.results.map(result => {
      const matches = result.matches.map(match => `- ${match.context}`).join('\n');
      return `From "${result.documentName}":\n${matches}`;
    }).join('\n\n');

    return `I found these relevant notes:\n\n${snippets}`;
  }

  if (info.error) {
    return `I hit an error while working on that: ${info.error}`;
  }

  return `I had trouble reaching the local Ollama model for the final response: ${errorMessage}. Please make sure Ollama is running and that the "${MODEL}" model is available.`;
}

function formatRagContext(searchResults) {
  if (!searchResults?.found || !Array.isArray(searchResults.results) || searchResults.results.length === 0) {
    return '';
  }

  return searchResults.results.map(result => {
    const snippets = result.matches
      .map(match => match.context)
      .filter(Boolean)
      .join('\n\n');

    return `--- ${result.documentName} ---\n${snippets}`;
  }).join('\n\n');
}

function splitGeneratedWriting(generatedText = '') {
  const text = stripGeneratedLeadIn(String(generatedText).trim());
  const separatorMatch = text.match(/(?:^|\r?\n)\s*(?:\*\*)?\s*---+\s*(?:\*\*)?\s*(?:\r?\n|$)/);

  if (separatorMatch?.index !== undefined) {
    const separatorStart = separatorMatch.index;
    const separatorEnd = separatorStart + separatorMatch[0].length;

    return {
      writing: text.slice(0, separatorStart).trim(),
      note: cleanGeneratedNote(text.slice(separatorEnd).trim())
    };
  }

  const commentaryMatch = text.match(/\n{2,}(?=(How is that|How does that|Let me know|Would you like|I can also|If you'd like|If you want|Does that|Hope this)\b)/i);
  if (commentaryMatch?.index !== undefined) {
    return {
      writing: text.slice(0, commentaryMatch.index).trim(),
      note: cleanGeneratedNote(text.slice(commentaryMatch.index).trim())
    };
  }

  return {
    writing: text,
    note: ''
  };
}

function stripGeneratedLeadIn(text = '') {
  return String(text)
    .replace(
      /^\s*\*\*\s*(?:output|generated output|editor output|draft output|draft text|suggestion|generated text|editor suggestion|in-editor suggestion)\s*:\s*\*\*\s*/i,
      ''
    )
    .replace(
      /^\s*\*\*\s*(?:output|generated output|editor output|draft output|draft text|suggestion|generated text|editor suggestion|in-editor suggestion)\s*\*\*\s*:\s*/i,
      ''
    )
    .replace(
      /^\s*(?:output|generated output|editor output|draft output|draft text|suggestion|generated text|editor suggestion|in-editor suggestion)\s*:\s*/i,
      ''
    )
    .replace(
      /^\s*(?:here(?:'s| is)|this is|i(?:'ve| have) written)\s+(?:a\s+)?(?:continuation|draft|scene|passage)(?:\s+of\s+the\s+story)?\s*[:.-]\s*/i,
      ''
    )
    .trim();
}

function cleanGeneratedNote(note = '') {
  const cleaned = String(note)
    .replace(/^\s*(?:note|commentary|explanation)\s*:\s*/i, '')
    .trim();

  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  const isRoutingNote =
    /\b(?:output|text|suggestion|response)\b/.test(lower) &&
    /\b(?:meant|intended|for|goes|belongs|inserted|shown)\b/.test(lower) &&
    /\b(?:text editor|editor|suggestion box|in-text editor|in text editor)\b/.test(lower);

  return isRoutingNote ? '' : cleaned;
}

/**
 * UNDERSTAND NODE
 * Analyzes user's message to determine intent and what they need
 */
const understandNode = traceable(async function understandNode(state) {
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

  const heuristicIntent = classifyIntentFromText(messageContent);
  if (!isAmbiguousConversationalIntent(heuristicIntent, messageContent)) {
    console.log('💡 User intent (heuristic):', heuristicIntent);
    return {
      userIntent: heuristicIntent,
      iterationCount: state.iterationCount + 1
    };
  }
  
  try {
    const response = await getModel(state.modelName).invoke([
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
    const fallbackIntent = classifyIntentFromText(messageContent);
    console.log('💡 User intent (fallback):', fallbackIntent);

    return {
      userIntent: fallbackIntent,
      iterationCount: state.iterationCount + 1
    };
  }
}, {
  name: 'understand_intent',
  run_type: 'chain',
});

/**
 * EXECUTE NODE
 * Runs appropriate tools based on understood intent
 */
const executeNode = traceable(async function executeNode(state) {
  const gatheredInfo = { ...state.gatheredInfo };
  const intent = (state.userIntent || '').toLowerCase();
  const userMessage = state.messages[state.messages.length - 1];
  const messageContent = typeof userMessage.content === 'string'
    ? userMessage.content
    : String(userMessage.content);
  
  console.log('⚙️ Executing tools based on intent...');
  console.log('Intent category:', intent);
  
  try {
    if (state.ragEnabled && state.projectPath) {
      console.log('📚 Retrieving project context for RAG...');
      gatheredInfo.ragResults = await searchContext(
        messageContent,
        state.projectPath,
        state.liveContent,
        { useVector: true }
      );
    }

    // SEARCH - Find information in project documents
    if (intent.includes('search') || intent.includes('find')) {
      console.log('🔍 Running searchContext tool...');
      
      const searchTerms = messageContent
        .toLowerCase()
        .replace(/find|search|look|looking|information|about|out|for|what|is|tell|me|the|a|an|where|when|who/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      const searchQuery = searchTerms || messageContent;
      console.log('Search query:', searchQuery);
      
      const searchResults = gatheredInfo.ragResults || await searchContext(
          searchQuery,
          state.projectPath,
          state.liveContent,
          { useVector: !!state.ragEnabled }
        );
      
      gatheredInfo.searchResults = searchResults;
    }
    
    // ANALYZE - Provide feedback on writing
    if (intent.includes('analyze') || intent.includes('feedback') || intent.includes('review')) {
      console.log('📊 Running analyzeDraft tool...');
      
      if (state.activeDocumentPath) {
        const analysis = await analyzeDraft(
          state.activeDocumentPath,
          state.projectPath,
          state.liveContent,
          {
            onToken: state.streamWriter,
            ragResults: gatheredInfo.ragResults,
            modelName: state.modelName
          }
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
      console.log('✏️ Running generateText tool...');
      
      const generated = await generateText(
        messageContent,
        state.projectPath,
        state.activeDocumentPath,
        state.liveContent,
        {
          ragResults: gatheredInfo.ragResults,
          modelName: state.modelName
        }
      );
      gatheredInfo.generated = generated;
    }
    
    // QUESTION - Need clarification
    if (intent.includes('question') && !gatheredInfo.searchResults && !gatheredInfo.analysis && !gatheredInfo.generated) {
      console.log('❓ User needs clarification...');
      
      const clarification = await askQuestion(messageContent, {
        onToken: state.streamWriter,
        modelName: state.modelName
      });
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
}, {
  name: 'execute_tools',
  run_type: 'chain',
});

/**
 * RESPOND NODE
 * Synthesizes gathered information into a helpful response
 */
const respondNode = traceable(async function respondNode(state) {
  const userMessage = state.messages[state.messages.length - 1];
  const messageContent = typeof userMessage.content === 'string'
    ? userMessage.content
    : String(userMessage.content);
  
  // Check if we have generated text - if so, return it directly with minimal wrapper
  if (state.gatheredInfo.generated && state.gatheredInfo.generated.success) {
    const gen = state.gatheredInfo.generated;
    const { writing } = splitGeneratedWriting(gen.generated);
    
    console.log('✅ Returning generated text for editor insertion');
    
    const response = `I'll continue your story from where you left off. The suggested text is ready above the editor.`;
    if (state.streamWriter) {
      state.streamWriter(response);
    }
    
    return {
      messages: [new AIMessage(response)],
      generatedText: writing // This will be sent separately to the editor
    };
  }

  if (state.gatheredInfo.analysis) {
    const analysis = state.gatheredInfo.analysis;

    if (analysis.success) {
      const response = `Here's my read on "${analysis.documentName}" (${analysis.wordCount} words):\n\n${analysis.analysis}`;

      return {
        messages: [new AIMessage(response)]
      };
    }

    return {
      messages: [new AIMessage(`I tried to analyze the active document, but couldn't finish: ${analysis.message}`)]
    };
  }

  if (state.gatheredInfo.searchResults) {
    const sr = state.gatheredInfo.searchResults;

    if (!sr.found || sr.results.length === 0) {
      const response = "I searched your project documents, but I didn't find a matching passage.";
      if (state.streamWriter) {
        state.streamWriter(response);
      }

      return {
        messages: [new AIMessage(response)]
      };
    }

    const snippets = sr.results.map(result => {
      const matches = result.matches.map(match => `- ${match.context}`).join('\n');
      return `From "${result.documentName}":\n${matches}`;
    }).join('\n\n');
    const response = `I found these relevant notes:\n\n${snippets}`;
    if (state.streamWriter) {
      state.streamWriter(response);
    }

    return {
      messages: [new AIMessage(response)]
    };
  }

  if (state.gatheredInfo.clarification) {
    const response = state.gatheredInfo.clarification.question || "Could you provide more details about what you'd like help with?";

    return {
      messages: [new AIMessage(response)]
    };
  }
  
  // Build context from gathered information for other responses
  let contextSummary = '';
  const ragContext = formatRagContext(state.gatheredInfo.ragResults);

  if (ragContext) {
    contextSummary += `\n\nRetrieved Project Context:\n${ragContext}`;
  }
  
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

If providing feedback, be specific and constructive.
If no relevant info was found, be honest but helpful.`;

  console.log('💬 Generating final response...');
  
  try {
    const responseText = await invokeModel([
      new SystemMessage(systemPrompt),
      new HumanMessage("Provide your response now.")
    ], {
      onToken: state.streamWriter,
      modelName: state.modelName
    });
    
    console.log('✅ Response generated');
    
    return {
      messages: [new AIMessage(responseText)]
    };
  } catch (error) {
    console.error('Error in respond node:', error);
    return {
      messages: [new AIMessage(formatToolFallbackResponse(state, error.message))]
    };
  }
}, {
  name: 'respond_to_user',
  run_type: 'chain',
});

module.exports = {
  understandNode,
  executeNode,
  respondNode
};
