export const GROQ_API_KEY =
  import.meta.env.VITE_GROQ_API_KEY ||
  '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'

export const GROQ_API_URL = 'https://api.openai.com/v1/chat/completions'
export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

export const GROQ_MODEL =
  import.meta.env.VITE_GROQ_MODEL || 'openai/gpt-oss-120b'
