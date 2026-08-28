require('dotenv').config()

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} must be set in the .env file`)
  }
  return value
}

function parseModelList(value) {
  try {
    const models = JSON.parse(value)
    if (Array.isArray(models) && models.every(model => typeof model === 'string' && model.trim())) {
      return [...new Set(models.map(model => model.trim()))]
    }
  } catch {
    // A clear configuration error is thrown below.
  }

  throw new Error('MODEL_LIST must be a JSON array of model names in the .env file')
}

const OLLAMA_MODEL = requireEnv('OLLAMA_MODEL')
const MODEL_LIST = parseModelList(requireEnv('MODEL_LIST'))

if (!MODEL_LIST.includes(OLLAMA_MODEL)) {
  throw new Error('OLLAMA_MODEL must also be included in MODEL_LIST')
}

module.exports = { OLLAMA_MODEL, MODEL_LIST }
