import { NextResponse } from 'next/server'
import { runWebAgent } from '../../../lib/agent'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body || typeof body.message !== 'string' || !body.message.trim()) {
      return NextResponse.json({ error: 'A message is required.' }, { status: 400 })
    }

    const result = await runWebAgent(body.message.trim(), body.context || {})
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to run the writing assistant.'
    console.error('Web agent error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
