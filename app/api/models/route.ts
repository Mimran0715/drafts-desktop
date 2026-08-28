import { NextResponse } from 'next/server'
import { getModelConfig } from '../../../lib/ollama/config'

export const runtime = 'nodejs'

export async function GET() {
  const { defaultModel, models } = getModelConfig()
  return NextResponse.json({ defaultModel, models })
}
