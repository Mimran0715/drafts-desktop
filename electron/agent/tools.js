// electron/agent/tools.js
// Agent tools for searching, analyzing, and generating content

const fs = require('fs').promises;
const path = require('path');
const { ChatOllama } = require('@langchain/ollama');

const model = new ChatOllama({
  model: 'llama3.1',
  temperature: 0.7,
});

/**
 * Load all documents from a project folder
 * @param {string} projectPath - Path to project folder
 * @returns {Promise<Array>} Array of documents with content
 */
async function loadProjectDocuments(projectPath) {
  try {
    const files = await fs.readdir(projectPath);
    const supportedFiles = files.filter(file => {
      const ext = file.toLowerCase();
      return ext.endsWith('.md') || ext.endsWith('.txt');
    });
    
    const documents = await Promise.all(
      supportedFiles.map(async (filename) => {
        const filePath = path.join(projectPath, filename);
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        
        return {
          name: filename,
          path: filePath,
          content,
          modified: stats.mtime
        };
      })
    );
    
    return documents.filter(doc => doc !== null);
  } catch (error) {
    console.error('Error loading project documents:', error);
    return [];
  }
}

/**
 * Load a specific document by path
 * @param {string} documentPath - Path to document
 * @returns {Promise<Object|null>} Document object or null
 */
async function loadDocument(documentPath) {
  try {
    const content = await fs.readFile(documentPath, 'utf-8');
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
}

/**
 * Search for relevant content across project documents
 * @param {string} query - Search query
 * @param {string} projectPath - Project folder path
 * @returns {Promise<Object>} Search results with relevant excerpts
 */
async function searchContext(query, projectPath) {
  console.log(`🔍 Searching for: "${query}" in project: ${projectPath}`);
  
  const documents = await loadProjectDocuments(projectPath);
  
  if (documents.length === 0) {
    return {
      found: false,
      message: "No documents found in project",
      results: []
    };
  }
  
  // Simple keyword search across all documents
  const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
  const results = [];
  
  for (const doc of documents) {
    const content = doc.content.toLowerCase();
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
        documentName: doc.name,
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
    results: results.slice(0, 3) // Return top 3 most relevant documents
  };
}

/**
 * Analyze the active draft document
 * @param {string} documentPath - Path to document to analyze
 * @param {string} projectPath - Project folder path
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeDraft(documentPath, projectPath) {
  console.log(`📝 Analyzing draft: ${documentPath}`);
  
  const document = await loadDocument(documentPath);
  
  if (!document) {
    return {
      success: false,
      message: "Could not load document for analysis"
    };
  }
  
  // Use LLM to analyze the draft
  const prompt = `Analyze this writing draft and provide constructive feedback.

Document: ${document.name}
Content:
${document.content}

Provide:
1. Strengths (what's working well)
2. Areas for improvement
3. Specific suggestions
4. Overall assessment

Be specific, constructive, and encouraging.`;

  try {
    const response = await model.invoke([
      { role: 'system', content: 'You are a supportive writing coach providing detailed feedback.' },
      { role: 'user', content: prompt }
    ]);
    
    return {
      success: true,
      documentName: document.name,
      wordCount: document.content.split(/\s+/).length,
      characterCount: document.content.length,
      analysis: response.content
    };
  } catch (error) {
    console.error('Error analyzing draft:', error);
    return {
      success: false,
      message: "Error analyzing document: " + error.message
    };
  }
}

/**
 * Generate text based on user request
 * @param {string} userRequest - What user wants to generate
 * @param {string} projectPath - Project folder path
 * @param {string} activeDocumentPath - Active document path
 * @returns {Promise<Object>} Generated text
 */
async function generateText(userRequest, projectPath, activeDocumentPath) {
  console.log(`✍️ Generating text for request: "${userRequest}"`);
  
  // Load active document for context
  const activeDoc = await loadDocument(activeDocumentPath);
  
  // Load other project documents for additional context
  const allDocs = await loadProjectDocuments(projectPath);
  const contextDocs = allDocs.filter(doc => doc.path !== activeDocumentPath);
  
  let contextString = '';
  
  if (activeDoc) {
    contextString += `\nCurrent document (${activeDoc.name}):\n${activeDoc.content}\n`;
  }
  
  if (contextDocs.length > 0) {
    contextString += '\nOther project documents:\n';
    contextDocs.forEach(doc => {
      contextString += `\n--- ${doc.name} ---\n${doc.content.substring(0, 500)}...\n`;
    });
  }
  
  const prompt = `Based on the following context, help with this request: "${userRequest}"

${contextString}

Generate helpful, relevant content that matches the style and context of the existing work.`;

  try {
    const response = await model.invoke([
      { role: 'system', content: 'You are a creative writing assistant helping to generate and expand content.' },
      { role: 'user', content: prompt }
    ]);
    
    return {
      success: true,
      generated: response.content,
      request: userRequest
    };
  } catch (error) {
    console.error('Error generating text:', error);
    return {
      success: false,
      message: "Error generating text: " + error.message
    };
  }
}

/**
 * Ask a clarifying question to the user
 * @param {string} context - Context about what needs clarification
 * @returns {Promise<Object>} Question to ask user
 */
async function askQuestion(context) {
  console.log(`❓ Need clarification: ${context}`);
  
  const prompt = `The user's request is unclear. Based on this context: "${context}"

Generate a friendly, specific question to clarify what they need. Keep it conversational and helpful.`;

  try {
    const response = await model.invoke([
      { role: 'system', content: 'You are a helpful assistant asking clarifying questions.' },
      { role: 'user', content: prompt }
    ]);
    
    return {
      needsClarification: true,
      question: response.content
    };
  } catch (error) {
    console.error('Error asking question:', error);
    return {
      needsClarification: true,
      question: "Could you provide more details about what you'd like help with?"
    };
  }
}

module.exports = {
  loadProjectDocuments,
  loadDocument,
  searchContext,
  analyzeDraft,
  generateText,
  askQuestion
};