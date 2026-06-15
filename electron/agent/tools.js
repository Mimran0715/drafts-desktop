// electron/agent/tools.js
// Agent tools for searching, analyzing, and generating content

const fs = require('fs').promises;
const path = require('path');
const mammoth = require('mammoth');
const { ChatOllama } = require('@langchain/ollama');
const { traceable } = require('langsmith/traceable');
const { searchWithChroma } = require('./vectorStore');

const MODEL = "llama3.1";
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

function isSupportedFile(filename) {
  const ext = filename.toLowerCase();
  return ext.endsWith('.md') || ext.endsWith('.txt') || ext.endsWith('.docx') || ext.endsWith('.doc');
}

async function readDocumentContent(filePath) {
  const lowerFilePath = filePath.toLowerCase();

  if (lowerFilePath.endsWith('.md') || lowerFilePath.endsWith('.txt')) {
    return fs.readFile(filePath, 'utf-8');
  }

  if (lowerFilePath.endsWith('.docx')) {
    const stats = await fs.stat(filePath);
    if (stats.size === 0) {
      console.warn(`Skipping empty .docx file ${path.basename(filePath)}`);
      return '';
    }

    const result = await mammoth.extractRawText({ path: filePath });
    if (result.messages.length > 0) {
      console.log(`Mammoth warnings for ${path.basename(filePath)}:`, result.messages);
    }
    return result.value;
  }

  if (lowerFilePath.endsWith('.doc')) {
    return '';
  }

  return '';
}

/**
 * Load all documents from a project folder
 * @param {string} projectPath - Path to project folder
 * @returns {Promise<Array>} Array of documents with content
 */
const loadProjectDocuments = traceable(async function loadProjectDocuments(projectPath) {
  try {
    const files = await fs.readdir(projectPath);
    const supportedFiles = files.filter(isSupportedFile);
    
    const documents = await Promise.all(
      supportedFiles.map(async (filename) => {
        try {
          const filePath = path.join(projectPath, filename);
          const content = await readDocumentContent(filePath);
          const stats = await fs.stat(filePath);
          
          return {
            name: filename,
            path: filePath,
            content,
            modified: stats.mtime
          };
        } catch (error) {
          console.error(`Error loading project document ${filename}:`, error.message);
          return null;
        }
      })
    );
    
    return documents.filter(doc => doc !== null);
  } catch (error) {
    console.error('Error loading project documents:', error);
    return [];
  }
}, {
  name: 'load_project_documents',
  run_type: 'tool',
});

/**
 * Load a specific document by path
 * @param {string} documentPath - Path to document
 * @returns {Promise<Object|null>} Document object or null
 */
const loadDocument = traceable(async function loadDocument(documentPath) {
  try {
    const content = await readDocumentContent(documentPath);
    const stats = await fs.stat(documentPath);
    
    return {
      name: path.basename(documentPath),
      path: documentPath,
      content,
      modified: stats.mtime
    };
  } catch (error) {
    console.error(`Error loading document ${documentPath}:`, error);
    return null;
  }
}, {
  name: 'load_document',
  run_type: 'tool',
});

/**
 * Search for relevant content across project documents
 * @param {string} query - Search query
 * @param {string} projectPath - Project folder path
 * @param {Object} [liveContent] - Optional live content from editor
 * @returns {Promise<Object>} Search results with relevant excerpts
 */
function keywordSearchDocuments(query, documents) {
  // Simple keyword search across all documents
  const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
  const results = [];
  
  for (const doc of documents) {
    let relevanceScore = 0;
    const matchedLines = [];
    
    // Split content into lines for context extraction
    const lines = doc.content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      let lineMatches = 0;
      
      for (const term of searchTerms) {
        if (line.includes(term)) {
          lineMatches++;
          relevanceScore++;
        }
      }
      
      // If line has matches, include it with context
      if (lineMatches > 0) {
        const contextStart = Math.max(0, i - 1);
        const contextEnd = Math.min(lines.length - 1, i + 1);
        const context = lines.slice(contextStart, contextEnd + 1).join('\n');
        
        matchedLines.push({
          lineNumber: i + 1,
          context: context.trim(),
          matches: lineMatches
        });
      }
    }
    
    if (relevanceScore > 0) {
      results.push({
        documentName: doc.name + (doc.isLive ? ' (Current Draft)' : ''),
        documentPath: doc.path,
        relevanceScore,
        matches: matchedLines.slice(0, 5) // Limit to top 5 matches per doc
      });
    }
  }
  
  // Sort by relevance
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return {
    found: results.length > 0,
    query,
    resultCount: results.length,
    retrievalMode: 'keyword',
    results: results.slice(0, 3) // Return top 3 most relevant documents
  };
}

const searchContext = traceable(async function searchContext(query, projectPath, liveContent = null, options = {}) {
  console.log(`🔍 Searching for: "${query}" in project: ${projectPath}`);
  
  const documents = await loadProjectDocuments(projectPath);
  
  // Add live content if provided
  if (liveContent && liveContent.content) {
    documents.push({
      name: liveContent.name || 'Current Draft',
      path: liveContent.path || 'active-document',
      content: liveContent.content,
      modified: new Date(),
      isLive: true
    });
    console.log('📝 Added live content from editor');
  }
  
  if (documents.length === 0) {
    return {
      found: false,
      message: "No documents found in project",
      results: []
    };
  }

  if (options.useVector) {
    try {
      console.log('🧭 Running Chroma vector retrieval...');
      return await searchWithChroma(query, projectPath, documents, options);
    } catch (error) {
      console.warn('Chroma retrieval unavailable, falling back to keyword search:', error.message);
    }
  }

  return keywordSearchDocuments(query, documents);
}, {
  name: 'search_context',
  run_type: 'tool',
});

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

/**
 * Analyze the active draft document
 * @param {string} documentPath - Path to document to analyze
 * @param {string} projectPath - Project folder path
 * @param {Object} [liveContent] - Optional live content from editor
 * @returns {Promise<Object>} Analysis results
 */
const analyzeDraft = traceable(async function analyzeDraft(documentPath, projectPath, liveContent = null, options = {}) {
  console.log(`📝 Analyzing draft: ${documentPath}`);
  
  let document;
  
  // Prefer live content over file content
  if (liveContent && liveContent.content) {
    console.log('✨ Using live editor content for analysis');
    document = {
      name: liveContent.name || path.basename(documentPath),
      path: documentPath,
      content: liveContent.content,
      modified: new Date()
    };
  } else {
    console.log('📂 Loading content from file');
    document = await loadDocument(documentPath);
  }
  
  if (!document || !document.content || document.content.trim().length === 0) {
    return {
      success: false,
      message: "No content to analyze. The document appears to be empty or could not be loaded."
    };
  }
  
  const wordCount = document.content.split(/\s+/).filter(word => word.length > 0).length;
  const streamPrefix = `Here's my read on "${document.name}" (${wordCount} words):\n\n`;
  if (options.onToken) {
    options.onToken(streamPrefix);
  }
  
  // Use LLM to analyze the draft
  const ragContext = formatRagContext(options.ragResults);
  const ragPromptSection = ragContext
    ? `\nRelevant project context:\n${ragContext}\n\nUse this context to understand continuity, recurring details, and project-level patterns. Do not over-weight it over the active draft.\n`
    : '';

  const prompt = `Analyze this writing draft and provide constructive feedback.

Document: ${document.name}
Word count: ${wordCount}

Content:
${document.content}
${ragPromptSection}

Provide:
1. Strengths (what's working well)
2. Areas for improvement
3. Specific suggestions for what could happen next or how to improve
4. Overall assessment

Be specific, constructive, and encouraging.`;

  try {
    const analysis = await invokeModel([
      { role: 'system', content: 'You are a supportive writing coach providing detailed feedback.' },
      { role: 'user', content: prompt }
    ], options);
    
    return {
      success: true,
      documentName: document.name,
      wordCount: wordCount,
      characterCount: document.content.length,
      analysis
    };
  } catch (error) {
    console.error('Error analyzing draft:', error);
    return {
      success: false,
      message: "Error analyzing document: " + error.message
    };
  }
}, {
  name: 'analyze_draft',
  run_type: 'tool',
});

/**
 * Generate text based on user request
 * @param {string} userRequest - What user wants to generate
 * @param {string} projectPath - Project folder path
 * @param {string} activeDocumentPath - Active document path
 * @param {Object} [liveContent] - Optional live content from editor
 * @returns {Promise<Object>} Generated text
 */
const generateText = traceable(async function generateText(userRequest, projectPath, activeDocumentPath, liveContent = null, options = {}) {
  console.log(`✍️ Generating text for request: "${userRequest}"`);
  
  // Load or use live active document content
  let activeDoc;
  if (liveContent && liveContent.content) {
    console.log('✨ Using live editor content for generation');
    activeDoc = {
      name: liveContent.name || path.basename(activeDocumentPath),
      path: activeDocumentPath,
      content: liveContent.content
    };
  } else {
    console.log('📂 Loading active document from file');
    activeDoc = await loadDocument(activeDocumentPath);
  }
  
  // Load other project documents for additional context
  const allDocs = await loadProjectDocuments(projectPath);
  const contextDocs = allDocs.filter(doc => doc.path !== activeDocumentPath);
  
  let contextString = '';
  
  if (activeDoc && activeDoc.content) {
    contextString += `\nCurrent document (${activeDoc.name}):\n${activeDoc.content}\n`;
  } else {
    contextString += '\nCurrent document is empty or not loaded.\n';
  }
  
  if (contextDocs.length > 0) {
    contextString += '\nOther project documents:\n';
    contextDocs.forEach(doc => {
      contextString += `\n--- ${doc.name} ---\n${doc.content.substring(0, 500)}...\n`;
    });
  }

  const ragContext = formatRagContext(options.ragResults);
  if (ragContext) {
    contextString += `\nRetrieved project context:\n${ragContext}\n`;
  }
  
  const prompt = `Based on the following context, help with this request: "${userRequest}"

${contextString}

Generate helpful, relevant content that matches the style and context of the existing work.

Output format is required:
1. First, write ONLY the draft/story text that should be inserted into the editor.
2. Then write a standalone separator line containing exactly three hyphens: ---
3. After the separator, write any brief note, explanation, or question for the user.

Do not put commentary, explanation, greetings, or questions before the separator. The text before --- must be ready to insert directly into the draft.`;

  try {
    const generated = await invokeModel([
      { role: 'system', content: 'You are a creative writing assistant helping to generate and expand content.' },
      { role: 'user', content: prompt }
    ], options);
    
    return {
      success: true,
      generated,
      request: userRequest
    };
  } catch (error) {
    console.error('Error generating text:', error);
    return {
      success: false,
      message: "Error generating text: " + error.message
    };
  }
}, {
  name: 'generate_text',
  run_type: 'tool',
});

/**
 * Get current context information (project, file, stats)
 * @param {string} projectPath - Project folder path
 * @param {string} activeDocumentPath - Active document path
 * @param {Object} [liveContent] - Optional live content from editor
 * @returns {Promise<Object>} Context information
 */
const getContextInfo = traceable(async function getContextInfo(projectPath, activeDocumentPath, liveContent = null) {
  console.log(`📍 Getting context info for: ${activeDocumentPath}`);
  
  try {
    // Get active document info
    let activeDoc = null;
    if (liveContent && liveContent.content) {
      activeDoc = {
        name: liveContent.name || path.basename(activeDocumentPath),
        path: activeDocumentPath,
        content: liveContent.content
      };
    } else if (activeDocumentPath) {
      activeDoc = await loadDocument(activeDocumentPath);
    }
    
    // Get project documents
    const projectDocs = await loadProjectDocuments(projectPath);
    
    // Calculate stats
    const activeDocStats = activeDoc ? {
      name: activeDoc.name,
      wordCount: activeDoc.content.split(/\s+/).filter(w => w.length > 0).length,
      characterCount: activeDoc.content.length,
      lineCount: activeDoc.content.split('\n').length,
      isEmpty: activeDoc.content.trim().length === 0
    } : null;
    
    const projectStats = {
      totalDocuments: projectDocs.length,
      documentNames: projectDocs.map(doc => doc.name),
      totalWords: projectDocs.reduce((sum, doc) => 
        sum + doc.content.split(/\s+/).filter(w => w.length > 0).length, 0
      )
    };
    
    return {
      success: true,
      projectName: path.basename(projectPath),
      projectPath: projectPath,
      activeDocument: activeDocStats,
      project: projectStats
    };
  } catch (error) {
    console.error('Error getting context info:', error);
    return {
      success: false,
      message: "Error getting context information: " + error.message
    };
  }
}, {
  name: 'get_context_info',
  run_type: 'tool',
});

/**
 * Ask a clarifying question to the user
 * @param {string} context - Context about what needs clarification
 * @returns {Promise<Object>} Question to ask user
 */
const askQuestion = traceable(async function askQuestion(context, options = {}) {
  console.log(`❓ Need clarification: ${context}`);
  
  const prompt = `The user's request is unclear. Based on this context: "${context}"

Generate a friendly, specific question to clarify what they need. Keep it conversational and helpful.`;

  try {
    const question = await invokeModel([
      { role: 'system', content: 'You are a helpful assistant asking clarifying questions.' },
      { role: 'user', content: prompt }
    ], options);
    
    return {
      needsClarification: true,
      question
    };
  } catch (error) {
    console.error('Error asking question:', error);
    return {
      needsClarification: true,
      question: "Could you provide more details about what you'd like help with?"
    };
  }
}, {
  name: 'ask_clarifying_question',
  run_type: 'tool',
});

module.exports = {
  loadProjectDocuments,
  loadDocument,
  searchContext,
  analyzeDraft,
  generateText,
  getContextInfo,
  askQuestion
};
