import { getModelConfig } from './config'

type OllamaMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function chatWithOllama(messages: OllamaMessage[], requestedModel?: string) {
  const apiKey = process.env.OLLAMA_API_KEY?.trim()
  if (!apiKey) throw new Error('OLLAMA_API_KEY is not configured on the server.')

  const { defaultModel, models } = getModelConfig()
  const model = requestedModel && models.includes(requestedModel) ? requestedModel : defaultModel
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'https://ollama.com/api').replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, messages, stream: false, options: { temperature: 0.7 } }),
    signal: AbortSignal.timeout(55_000)
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Ollama returned ${response.status}: ${detail.slice(0, 240)}`)
  }

  const payload = await response.json()
  const content = payload?.message?.content
  if (typeof content !== 'string') throw new Error('Ollama returned an invalid chat response.')
  return content.trim()
}
