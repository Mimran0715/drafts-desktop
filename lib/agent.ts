import { chatWithOllama } from './ollama/client'

type WebDocument = { id?: string; title?: string; path?: string; content?: string }
type AgentContext = {
  threadId?: string | null
  modelName?: string
  ragEnabled?: boolean
  liveContent?: { name?: string; content?: string; suggestionContext?: unknown } | null
  allDocuments?: WebDocument[]
}

type Intent = 'search' | 'analyze' | 'generate' | 'question' | 'conversational'

function understand(message: string): Intent {
  const text = message.toLowerCase()
  if (/\b(analy[sz]e|analysis|feedback|review|critique|thoughts)\b/.test(text)) return 'analyze'
  if (/\b(find|search|look up|locate|recall)\b/.test(text)) return 'search'
  if (/\b(continue|write|generate|expand|draft|compose|revise|rewrite|shorter|longer)\b/.test(text)) return 'generate'
  if (text.includes('?') || /\b(explain|how|why|what|should i|can i)\b/.test(text)) return 'question'
  return 'conversational'
}

function searchDocuments(query: string, documents: WebDocument[]) {
  const terms = query.toLowerCase().split(/\W+/).filter(term => term.length > 3)
  return documents
    .map(doc => {
      const content = doc.content || ''
      const score = terms.reduce((total, term) => total + (content.toLowerCase().split(term).length - 1), 0)
      return { title: doc.title || 'Untitled', content, score }
    })
    .filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

function execute(intent: Intent, message: string, context: AgentContext) {
  const current = context.liveContent
  const documents = context.allDocuments || []
  const common = `Active draft: ${current?.name || 'Untitled'}\n\n${current?.content || '(empty draft)'}`

  if (intent === 'search') {
    const results = searchDocuments(message, documents)
    return `Search the supplied project excerpts and answer precisely. If there is no evidence, say so.\n\n${results.map(doc => `--- ${doc.title} ---\n${doc.content}`).join('\n\n') || 'No matching excerpts.'}`
  }
  if (intent === 'analyze') return `Give specific, constructive editorial feedback. Address the request and cite short phrases from the draft when useful.\n\n${common}`
  if (intent === 'generate') {
    return `Write insertion-ready prose that follows the user's direction and matches the draft's voice. Return only the new prose: no heading, preface, quotation marks, explanation, or markdown fence. Avoid repeating existing lines.\n\n${common}`
  }
  return `Answer as a thoughtful writing collaborator. Be concise, concrete, and grounded in the active draft when relevant.\n\n${common}`
}

export async function runWebAgent(message: string, context: AgentContext) {
  const intent = understand(message)
  const executionContext = execute(intent, message, context)
  const output = await chatWithOllama([
    {
      role: 'system',
      content: `You are Drafts, an expert creative-writing collaborator. The request has been classified as ${intent}. ${executionContext}`
    },
    { role: 'user', content: message }
  ], context.modelName)

  const generatedText = intent === 'generate' ? output : null
  return {
    response: generatedText ? 'I drafted a suggestion in the editor.' : output,
    generatedText,
    userIntent: `${intent}: classified by the web agent`,
    gatheredInfo: { intent },
    threadId: context.threadId || `thread_${Date.now()}`,
    timestamp: new Date().toISOString()
  }
}
