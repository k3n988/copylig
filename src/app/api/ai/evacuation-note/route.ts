import { NextRequest, NextResponse } from 'next/server'
import { buildEvacuationNote, type EvacuationNoteResult } from '@/lib/ai/advisories'
import { maybeGenerateGeminiJson } from '@/lib/ai/gemini'
import type { FloodZone, HazardEvent, Household } from '@/types'

const evacuationNoteSchema = {
  type: 'object',
  properties: {
    note: { type: 'string' },
    personnelRequired: { type: 'number' },
    equipment: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['note', 'personnelRequired', 'equipment'],
} as const

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    household: Household
    hazard?: HazardEvent | null
    floodZones?: FloodZone[]
  }

  const fallback = buildEvacuationNote({
    household: body.household,
    hazard: body.hazard ?? null,
    floodZones: body.floodZones ?? [],
  })

  const hh = body.household
  const vulnerabilities = hh.vulnArr.length > 0 ? hh.vulnArr.join(', ') : 'none'
  const hazardDesc = body.hazard?.isActive
    ? `Active ${body.hazard.type} hazard`
    : 'No active hazard'
  const floodInfo =
    body.floodZones && body.floodZones.length > 0
      ? `Flood zones present: ${body.floodZones.map((z) => `${z.severity}${z.depth ? ` (${z.depth} deep)` : ''}`).join(', ')}`
      : 'No flood zones'

  const prompt = [
    'You are generating a concise rescue evacuation note for a Philippine DRRMO operator.',
    `Household: ${hh.head}, ${hh.occupants} occupants at ${hh.street}, Brgy. ${hh.barangay}, ${hh.city}.`,
    `Vulnerabilities: ${vulnerabilities}.`,
    `${hazardDesc}. ${floodInfo}.`,
    `Fallback note: ${fallback.note}`,
    `Fallback equipment: ${fallback.equipment.join(', ') || 'none'}.`,
    'Keep the note under 2 sentences. Be specific and actionable. List required equipment.',
    `Minimum responders recommended: ${fallback.personnelRequired}.`,
  ].join('\n')

  const gemini = await maybeGenerateGeminiJson<Omit<EvacuationNoteResult, 'source'>>({
    prompt,
    schema: evacuationNoteSchema,
  })

  return NextResponse.json(
    gemini
      ? { ...gemini, source: 'gemini' }
      : fallback,
  )
}
