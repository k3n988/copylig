import { NextRequest, NextResponse } from 'next/server'
import { buildPublicAdvisory, type PublicAdvisoryResult } from '@/lib/ai/advisories'
import { maybeGenerateGeminiJson } from '@/lib/ai/gemini'
import type { HazardEvent, Vulnerability } from '@/types'

const advisorySchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    actions: {
      type: 'array',
      items: { type: 'string' },
    },
    severity: {
      type: 'string',
      enum: ['normal', 'monitoring', 'warning', 'critical'],
    },
  },
  required: ['title', 'summary', 'actions', 'severity'],
} as const

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    city?: string
    barangay?: string
    coords?: { lat: number; lng: number } | null
    hazard?: HazardEvent | null
    vulnerabilities?: Vulnerability[]
  }

  const fallback = buildPublicAdvisory({
    hazard: body.hazard ?? null,
    city: body.city,
    barangay: body.barangay,
    coords: body.coords,
    vulnerabilities: body.vulnerabilities,
  })

  const hazardType = body.hazard?.type ?? 'hazard'
  const location = [body.barangay, body.city].filter(Boolean).join(', ') || 'Unknown area'
  const vulnerabilities = body.vulnerabilities?.length
    ? `Household vulnerabilities: ${body.vulnerabilities.join(', ')}.`
    : 'No special vulnerabilities reported.'

  const prompt = [
    'You are generating a concise Philippine disaster advisory for a public-facing map banner used by residents and responders.',
    `Location: ${location}.`,
    `Active hazard type: ${hazardType}.`,
    vulnerabilities,
    `Hazard zone: ${fallback.severity} (${fallback.summary})`,
    `Fallback actions: ${fallback.actions.join('; ')}.`,
    'Generate a short advisory title (max 8 words), a calm 1-2 sentence summary appropriate for Filipino residents, and exactly 3 short actionable bullet points.',
    'Use plain language. Do not use technical jargon. Keep it reassuring but urgent when needed.',
  ].join('\n')

  const gemini = await maybeGenerateGeminiJson<Omit<PublicAdvisoryResult, 'source'>>({
    prompt,
    schema: advisorySchema,
  })

  return NextResponse.json(
    gemini
      ? { ...gemini, source: 'gemini' }
      : fallback,
  )
}
