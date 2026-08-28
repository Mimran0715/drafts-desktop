require('dotenv').config();

const { ChatOllama } = require('@langchain/ollama');
const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');

const MODEL = process.env.OLLAMA_MODEL || "llama-writer";

const model = new ChatOllama({
  model: MODEL,
  temperature: 0.7,
});

async function runSimpleAgent(message, context) {
  // Build context from documents
  let contextString = '';
  
  if (context.currentDocument) {
    contextString += `Current document: "${context.currentDocument.title}"\n`;
    contextString += `Content:\n${context.currentDocument.content}\n\n`;
  }
  
  if (context.allDocuments && context.allDocuments.length > 1) {
    contextString += 'Other documents in project:\n';
    context.allDocuments
      .filter(doc => doc.id !== context.currentDocument?.id)
      .forEach(doc => {
        contextString += `- ${doc.title} (${doc.content.length} characters)\n`;
      });
  }
  
  const systemPrompt = `You are a helpful writing assistant. Help the user with their creative writing, provide feedback, suggestions, and answer questions about their work.

${contextString}`;

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(message)
  ]);
  
  return response.content;
}

module.exports = { runSimpleAgent };
