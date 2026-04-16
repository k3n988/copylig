import type { Asset, FloodZone, HazardEvent, Household } from '@/types'
import { haversineKm, pointInPolygon } from '@/lib/geo'

export type AdvisorySource = 'rule-based' | 'gemini'

export interface PublicAdvisoryResult {
  title: string
  summary: string
  actions: string[]
  severity: 'normal' | 'monitoring' | 'warning' | 'critical'
  source: AdvisorySource
}

export interface EvacuationNoteResult {
  note: string
  personnelRequired: number
  equipment: string[]
  source: AdvisorySource
}

export interface AssetRecommendationResult {
  summary: string
  rationale: string
  recommendedAssetIds: string[]
  blockedAssetIds: string[]
  source: AdvisorySource
}

function getHazardZoneLabel(
  hazard: HazardEvent,
  coords?: { lat: number; lng: number } | null,
) {
  if (!hazard.isActive || !coords) return 'outside'
  const distanceKm = haversineKm(coords.lat, coords.lng, hazard.center.lat, hazard.center.lng)
  if (distanceKm <= hazard.radii.critical) return 'critical'
  if (distanceKm <= hazard.radii.high) return 'high'
  if (distanceKm <= hazard.radii.elevated) return 'elevated'
  if (distanceKm <= hazard.radii.stable) return 'stable'
  return 'outside'
}

function getFloodDepthAtPoint(
  coords: { lat: number; lng: number } | null | undefined,
  floodZones: FloodZone[],
) {
  if (!coords) return null
  const rankedDepths = ['ankle', 'knee', 'waist', 'chest'] as const
  let bestDepth: (typeof rankedDepths)[number] | null = null

  for (const zone of floodZones) {
    if (!pointInPolygon(coords, zone.polygon)) continue
    if (!zone.depth) continue
    if (!bestDepth || rankedDepths.indexOf(zone.depth) > rankedDepths.indexOf(bestDepth)) {
      bestDepth = zone.depth
    }
  }

  return bestDepth
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function buildPublicAdvisory(input: {
  hazard: HazardEvent | null
  city?: string
  barangay?: string
  coords?: { lat: number; lng: number } | null
  vulnerabilities?: Household['vulnArr']
}): PublicAdvisoryResult {
  const { hazard, city, barangay, coords, vulnerabilities = [] } = input

  if (!hazard?.isActive) {
    return {
      title: 'No Active Hazard Advisory',
      summary: 'No active hazard is currently affecting this area. Keep monitoring local DRRMO channels for updates.',
      actions: ['Keep phones charged', 'Prepare IDs and medicines', 'Check official LGU advisories'],
      severity: 'normal',
      source: 'rule-based',
    }
  }

  const zone = getHazardZoneLabel(hazard, coords)
  const areaLabel = [barangay, city].filter(Boolean).join(', ') || 'your area'
  const vulnerableHousehold = vulnerabilities.length > 0
  const zoneText =
    zone === 'critical'
      ? 'inside the critical impact zone'
      : zone === 'high'
        ? 'inside the high-risk zone'
        : zone === 'elevated'
          ? 'inside the elevated monitoring zone'
          : zone === 'stable'
            ? 'inside the outer hazard zone'
            : 'outside the main hazard radius'

  const baseActionsByHazard: Record<string, string[]> = {
    volcano: ['Wear a mask outdoors', 'Seal doors and windows from ash', 'Prepare for evacuation updates'],
    flood: ['Move valuables and people to higher ground', 'Avoid flooded roads and bridges', 'Prepare waterproof documents and medicine'],
    earthquake: ['Expect aftershocks', 'Stay away from damaged structures', 'Check gas, power, and water lines carefully'],
    typhoon: ['Stay indoors away from windows', 'Charge devices and lamps', 'Secure outdoor items now'],
    landslide: ['Leave steep slopes and riverbanks', 'Watch for cracks or rumbling sounds', 'Move early if rain continues'],
    fire: ['Evacuate immediately', 'Stay low to avoid smoke', 'Do not re-enter until cleared'],
  }

  const hazardKey = hazard.type.toLowerCase()
  const actions = [...(baseActionsByHazard[hazardKey] ?? ['Stay alert', 'Follow official instructions', 'Prepare to evacuate if told'])]

  if (vulnerableHousehold) {
    actions[0] = 'Evacuate early if anyone is elderly, bedridden, pregnant, or mobility-limited'
  }

  const severity =
    zone === 'critical' || zone === 'high'
      ? 'critical'
      : zone === 'elevated' || zone === 'stable'
        ? 'warning'
        : 'monitoring'

  return {
    title: `${toTitleCase(hazard.type)} Advisory for ${areaLabel}`,
    summary: `${areaLabel} is currently ${zoneText} for the active ${hazard.type.toLowerCase()} event. ${
      vulnerableHousehold
        ? 'Because this household has vulnerable members, early movement and medication prep are strongly advised.'
        : 'Residents should stay alert and be ready to follow barangay evacuation instructions.'
    }`,
    actions,
    severity,
    source: 'rule-based',
  }
}

export function buildEvacuationNote(input: {
  household: Household
  hazard: HazardEvent | null
  floodZones?: FloodZone[]
}): EvacuationNoteResult {
  const { household, hazard, floodZones = [] } = input
  const needs = new Set<string>()
  let personnelRequired = household.occupants >= 5 ? 3 : 2
  const reasons: string[] = []

  if (household.vulnArr.includes('Bedridden')) {
    personnelRequired = Math.max(personnelRequired, 2)
    needs.add('stretcher')
    needs.add('blanket')
    reasons.push('patient is bedridden and requires assisted lift')
  }

  if (household.vulnArr.includes('Wheelchair') || household.vulnArr.includes('PWD')) {
    personnelRequired = Math.max(personnelRequired, 2)
    needs.add('wheelchair support')
    reasons.push('mobility support is needed')
  }

  if (household.vulnArr.includes('Oxygen')) {
    personnelRequired = Math.max(personnelRequired, 2)
    needs.add('oxygen backup')
    reasons.push('oxygen support should be protected during transfer')
  }

  if (household.vulnArr.includes('Dialysis')) {
    needs.add('medical endorsement')
    reasons.push('patient may need urgent continuity of care')
  }

  if (household.vulnArr.includes('Infant') || household.vulnArr.includes('Pregnant')) {
    personnelRequired = Math.max(personnelRequired, 2)
    needs.add('priority transport')
    reasons.push('household includes maternal or infant risk')
  }

  if (household.occupants >= 6) {
    personnelRequired = Math.max(personnelRequired, 3)
    needs.add('multi-passenger transport')
    reasons.push('large household size may require larger capacity')
  }

  const floodDepth = getFloodDepthAtPoint({ lat: household.lat, lng: household.lng }, floodZones)
  if (hazard?.type.toLowerCase() === 'flood' && floodDepth) {
    needs.add('water evacuation gear')
    reasons.push(`${floodDepth}-deep flooding reported near structure`)
  }

  const note =
    reasons.length > 0
      ? `AI Advisory: ${toTitleCase(reasons.join('; '))}. Minimum ${personnelRequired} responder${personnelRequired > 1 ? 's' : ''} recommended.`
      : `AI Advisory: Standard evacuation for ${household.occupants} occupant${household.occupants !== 1 ? 's' : ''}. Minimum ${personnelRequired} responder${personnelRequired > 1 ? 's' : ''} recommended.`

  return {
    note,
    personnelRequired,
    equipment: Array.from(needs),
    source: 'rule-based',
  }
}

function scoreAsset(
  asset: Asset,
  household: Household,
  hazard: HazardEvent | null,
  floodDepth: 'ankle' | 'knee' | 'waist' | 'chest' | null,
) {
  const type = asset.type.toLowerCase()
  let score = 0

  if (asset.status === 'Active') score += 40
  if (asset.status === 'Standby') score += 20
  if (asset.status === 'Dispatching') score -= 10

  if (hazard?.type.toLowerCase() === 'flood') {
    if (floodDepth === 'waist' || floodDepth === 'chest') {
      if (type.includes('boat')) score += 120
      if (type.includes('helicopter')) score += 90
      if (type.includes('ambulance') || type.includes('van') || type.includes('truck') || type.includes('motorcycle')) score -= 120
    } else if (floodDepth === 'knee') {
      if (type.includes('boat')) score += 70
      if (type.includes('truck')) score += 40
      if (type.includes('ambulance')) score -= 10
      if (type.includes('motorcycle')) score -= 60
    }
  }

  if (household.vulnArr.includes('Bedridden') || household.vulnArr.includes('Oxygen') || household.vulnArr.includes('Dialysis')) {
    if (type.includes('ambulance')) score += 100
    if (type.includes('boat')) score += 70
    if (type.includes('motorcycle')) score -= 100
  }

  if (household.vulnArr.includes('Wheelchair') || household.vulnArr.includes('PWD')) {
    if (type.includes('ambulance') || type.includes('van') || type.includes('truck')) score += 45
    if (type.includes('motorcycle')) score -= 80
  }

  if (household.occupants >= 5) {
    if (type.includes('truck') || type.includes('van') || type.includes('boat')) score += 50
    if (type.includes('motorcycle')) score -= 90
  }

  return score
}

export function buildAssetRecommendation(input: {
  household: Household
  assets: Asset[]
  hazard: HazardEvent | null
  floodZones?: FloodZone[]
}): AssetRecommendationResult {
  const { household, assets, hazard, floodZones = [] } = input
  const floodDepth = getFloodDepthAtPoint({ lat: household.lat, lng: household.lng }, floodZones)

  const scored = assets
    .map((asset) => ({
      asset,
      score: scoreAsset(asset, household, hazard, floodDepth),
    }))
    .sort((a, b) => b.score - a.score)

  const recommendedAssetIds = scored.filter((entry) => entry.score >= 40).slice(0, 3).map((entry) => entry.asset.id)
  const blockedAssetIds = scored.filter((entry) => entry.score <= -50).map((entry) => entry.asset.id)

  const rationaleParts = []
  if (floodDepth === 'waist' || floodDepth === 'chest') rationaleParts.push(`deep floodwater (${floodDepth}) detected near household`)
  if (household.vulnArr.includes('Bedridden')) rationaleParts.push('bedridden patient needs assisted lift')
  if (household.vulnArr.includes('Wheelchair') || household.vulnArr.includes('PWD')) rationaleParts.push('mobility support is required')
  if (household.vulnArr.includes('Oxygen') || household.vulnArr.includes('Dialysis')) rationaleParts.push('medical continuity is needed during transport')
  if (household.occupants >= 5) rationaleParts.push('larger household may need higher-capacity transport')

  return {
    summary:
      recommendedAssetIds.length > 0
        ? 'Recommended assets have been ranked for this dispatch.'
        : 'No clearly safe asset match was found. Manual review is recommended before dispatch.',
    rationale:
      rationaleParts.length > 0
        ? `AI recommendation based on ${rationaleParts.join(', ')}.`
        : 'AI recommendation based on current asset availability and household profile.',
    recommendedAssetIds,
    blockedAssetIds,
    source: 'rule-based',
  }
}
