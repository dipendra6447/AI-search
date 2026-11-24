import { NextResponse } from 'next/server'

const GROQ_API_KEY =
  process.env.GROQ_API_KEY ||
  process.env.NEXT_PUBLIC_GROQ_API_KEY ||
  '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'

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL =
  process.env.GROQ_MODEL ||
  process.env.NEXT_PUBLIC_GROQ_MODEL ||
  'openai/gpt-oss-120b'

export async function POST(request) {
  try {
    const body = await request.json()
    const { messages } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 })
    }

    const payload = {
      model: GROQ_MODEL,
      messages: messages
    }

    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || `Groq API returned error ${response.status}` },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Chat API Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
