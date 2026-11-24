export const GROQ_API_KEY =
  process.env.NEXT_PUBLIC_GROQ_API_KEY ||
  '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'

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

export const GROQ_MODEL =
  process.env.NEXT_PUBLIC_GROQ_MODEL || 'openai/gpt-oss-120b'

export const CHAT_API_ENDPOINT = '/api/chat'
