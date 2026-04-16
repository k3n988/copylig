import { NextRequest, NextResponse } from 'next/server'
import { buildAssetRecommendation, type AssetRecommendationResult } from '@/lib/ai/advisories'
import { maybeGenerateGeminiJson } from '@/lib/ai/gemini'
import type { Asset, FloodZone, HazardEvent, Household } from '@/types'

const assetRecommendationSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    rationale: { type: 'string' },
    recommendedAssetIds: {
      type: 'array',
      items: { type: 'string' },
    },
    blockedAssetIds: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['summary', 'rationale', 'recommendedAssetIds', 'blockedAssetIds'],
} as const

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    household: Household
    assets: Asset[]
    hazard?: HazardEvent | null
    floodZones?: FloodZone[]
  }

  const fallback = buildAssetRecommendation({
    household: body.household,
    assets: body.assets,
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
      ? `Flood zones: ${body.floodZones.map((z) => `${z.severity}${z.depth ? ` (${z.depth} deep)` : ''}`).join(', ')}`
      : 'No flood zones'
  const assetList = body.assets
    .map((a) => `${a.id}: ${a.name} (${a.type}, ${a.status})`)
    .join('; ')

  const prompt = [
    'You are ranking rescue assets for a Philippine DRRMO dispatch.',
    `Household: ${hh.head}, ${hh.occupants} occupants. Vulnerabilities: ${vulnerabilities}.`,
    `${hazardDesc}. ${floodInfo}.`,
    `Available assets: ${assetList}.`,
    `Rule-based recommendation: ${fallback.rationale}`,
    `Rule-based recommended IDs: ${fallback.recommendedAssetIds.join(', ') || 'none'}.`,
    `Rule-based blocked IDs: ${fallback.blockedAssetIds.join(', ') || 'none'}.`,
    'Return the same asset IDs from the list above. Only recommend assets suitable for the conditions.',
    'Block assets that would be dangerous or impractical given flood depth or household needs.',
  ].join('\n')

  const gemini = await maybeGenerateGeminiJson<Omit<AssetRecommendationResult, 'source'>>({
    prompt,
    schema: assetRecommendationSchema,
  })

  // Validate Gemini returned valid asset IDs only
  if (gemini) {
    const validIds = new Set(body.assets.map((a) => a.id))
    const recommendedAssetIds = gemini.recommendedAssetIds.filter((id) => validIds.has(id))
    const blockedAssetIds = gemini.blockedAssetIds.filter((id) => validIds.has(id))
    return NextResponse.json({ ...gemini, recommendedAssetIds, blockedAssetIds, source: 'gemini' })
  }

  return NextResponse.json(fallback)
}
