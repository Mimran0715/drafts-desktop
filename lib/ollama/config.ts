export function getModelConfig() {
  const defaultModel = process.env.OLLAMA_MODEL?.trim() || 'gemma4:31b'
  let models = [defaultModel]

  if (process.env.MODEL_LIST) {
    try {
      const parsed = JSON.parse(process.env.MODEL_LIST)
      if (Array.isArray(parsed)) {
        models = parsed.filter((model): model is string => typeof model === 'string' && !!model.trim())
      }
    } catch {
      throw new Error('MODEL_LIST must be a JSON array of model names.')
    }
  }

  if (!models.includes(defaultModel)) models.unshift(defaultModel)
  return { defaultModel, models: [...new Set(models)] }
}
