// src/lib/geo.ts
import type { FloodZone, HazardEvent, Household, TriageLevel } from '@/types'

function normalizeHazards(hazardOrHazards: HazardEvent | HazardEvent[] | null | undefined): HazardEvent[] {
  if (!hazardOrHazards) return []
  return Array.isArray(hazardOrHazards) ? hazardOrHazards.filter((hazard) => hazard?.isActive) : hazardOrHazards.isActive ? [hazardOrHazards] : []
}

// ─── EXISTING CODE (unchanged) ───────────────────────────────────────────────

export function getDynamicTriage(
  lat: number,
  lng: number,
  originalLevel: TriageLevel,
  hazard: HazardEvent | null,
): TriageLevel {
  if (!hazard?.isActive) return originalLevel
  const d = haversineKm(lat, lng, hazard.center.lat, hazard.center.lng)
  if (d <= hazard.radii.critical) return 'CRITICAL'
  if (d <= hazard.radii.high)     return 'HIGH'
  if (d <= hazard.radii.elevated) return 'ELEVATED'
  if (d <= hazard.radii.stable)   return 'STABLE'
  return originalLevel
}

export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

export function pointInPolygon(
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>,
): boolean {
  let inside = false
  const { lat: y, lng: x } = point
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { lat: yi, lng: xi } = polygon[i]
    const { lat: yj, lng: xj } = polygon[j]
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

type GeoJsonPolygonCoordinates = number[][][]
type GeoJsonMultiPolygonCoordinates = number[][][][]

interface GeoJsonFeature {
  geometry?: {
    type?: string
    coordinates?: GeoJsonPolygonCoordinates | GeoJsonMultiPolygonCoordinates
  }
}

interface GeoJsonFeatureCollection {
  features?: GeoJsonFeature[]
}

function ringToLatLngPolygon(ring: number[][]): Array<{ lat: number; lng: number }> {
  return ring
    .filter((point) => point.length >= 2)
    .map(([lng, lat]) => ({ lat, lng }))
}

export function extractPolygonsFromGeoJson(
  geojson: GeoJsonFeatureCollection,
): Array<Array<{ lat: number; lng: number }>> {
  const polygons: Array<Array<{ lat: number; lng: number }>> = []

  for (const feature of geojson.features ?? []) {
    const geometry = feature.geometry
    if (!geometry?.coordinates) continue

    if (geometry.type === 'Polygon') {
      const outerRing = (geometry.coordinates as GeoJsonPolygonCoordinates)[0]
      if (!outerRing) continue
      const polygon = ringToLatLngPolygon(outerRing)
      if (polygon.length >= 3) polygons.push(polygon)
      continue
    }

    if (geometry.type === 'MultiPolygon') {
      for (const polygonCoords of geometry.coordinates as GeoJsonMultiPolygonCoordinates) {
        const outerRing = polygonCoords[0]
        if (!outerRing) continue
        const polygon = ringToLatLngPolygon(outerRing)
        if (polygon.length >= 3) polygons.push(polygon)
      }
    }
  }

  return polygons
}

export function isPointInAnyPolygon(
  point: { lat: number; lng: number },
  polygons: Array<Array<{ lat: number; lng: number }>>,
): boolean {
  return polygons.some((polygon) => pointInPolygon(point, polygon))
}

export function getHouseholdHazardDistanceKm(
  household: Pick<Household, 'lat' | 'lng'>,
  hazard: HazardEvent | null,
): number | null {
  if (!hazard?.isActive || hazard.type === 'Flood') return null
  return haversineKm(household.lat, household.lng, hazard.center.lat, hazard.center.lng)
}

export function getNearestHouseholdHazardDistanceKm(
  household: Pick<Household, 'lat' | 'lng'>,
  hazards: HazardEvent[] | HazardEvent | null,
): number | null {
  const distances = normalizeHazards(hazards)
    .filter((hazard) => hazard.type !== 'Flood')
    .map((hazard) => haversineKm(household.lat, household.lng, hazard.center.lat, hazard.center.lng))

  if (distances.length === 0) return null
  return Math.min(...distances)
}

export function isHouseholdInHazardZone(
  household: Pick<Household, 'lat' | 'lng'>,
  hazard: HazardEvent | null,
  floodZones: FloodZone[] = [],
): boolean {
  if (!hazard?.isActive) return false

  if (hazard.type === 'Flood') {
    return floodZones.some((zone) =>
      pointInPolygon({ lat: household.lat, lng: household.lng }, zone.polygon),
    )
  }

  const distanceKm = getHouseholdHazardDistanceKm(household, hazard)
  return distanceKm !== null && distanceKm <= hazard.radii.stable
}

export function isHouseholdInAnyHazardZone(
  household: Pick<Household, 'lat' | 'lng'>,
  hazards: HazardEvent[] | HazardEvent | null,
  floodZones: FloodZone[] = [],
): boolean {
  return normalizeHazards(hazards).some((hazard) => isHouseholdInHazardZone(household, hazard, floodZones))
}

export function getEffectiveHouseholdTriage(
  household: Pick<Household, 'lat' | 'lng' | 'triage'>,
  hazard: HazardEvent | null,
  floodZones: FloodZone[] = [],
): TriageLevel {
  if (!hazard?.isActive) return household.triage.level

  if (hazard.type === 'Flood') {
    return getFloodTriage(
      { lat: household.lat, lng: household.lng },
      floodZones,
      household.triage.level,
    )
  }

  return getDynamicTriage(household.lat, household.lng, household.triage.level, hazard)
}

export function getEffectiveHouseholdTriageFromHazards(
  household: Pick<Household, 'lat' | 'lng' | 'triage'>,
  hazards: HazardEvent[] | HazardEvent | null,
  floodZones: FloodZone[] = [],
): TriageLevel {
  let bestLevel = household.triage.level

  for (const hazard of normalizeHazards(hazards)) {
    const candidate = getEffectiveHouseholdTriage(
      { ...household, triage: { ...household.triage, level: bestLevel } },
      hazard,
      floodZones,
    )

    if (TRIAGE_PRIORITY[candidate] < TRIAGE_PRIORITY[bestLevel]) {
      bestLevel = candidate
    }
  }

  return bestLevel
}

// ─── NEW: Hazard zone filtering & queue prioritization ────────────────────────

/** Returns only households within the outermost hazard ring (stable radius). */
export function filterHouseholdsInHazardZone(
  households: Household[],
  hazard: HazardEvent,
): Household[] {
  return households.filter((hh) => {
    const dist = haversineKm(hh.lat, hh.lng, hazard.center.lat, hazard.center.lng)
    return dist <= hazard.radii.stable
  })
}

/**
 * Sorts hazard-affected households by ring priority then by proximity.
 *
 *   0 → Critical  (closest to epicenter first within ring)
 *   1 → High
 *   2 → Elevated
 *   3 → Stable
 */
export function sortHouseholdsByHazardProximity(
  households: Household[],
  hazard: HazardEvent,
): Household[] {
  function ringPriority(distKm: number): number {
    if (distKm <= hazard.radii.critical) return 0
    if (distKm <= hazard.radii.high)     return 1
    if (distKm <= hazard.radii.elevated) return 2
    return 3
  }

  return [...households].sort((a, b) => {
    const distA = haversineKm(a.lat, a.lng, hazard.center.lat, hazard.center.lng)
    const distB = haversineKm(b.lat, b.lng, hazard.center.lat, hazard.center.lng)
    const ringDiff = ringPriority(distA) - ringPriority(distB)
    if (ringDiff !== 0) return ringDiff
    return distA - distB  // same ring → closer first
  })
}

// ─── Flood polygon triage ─────────────────────────────────────────────────────

const FLOOD_SEVERITY_TO_TRIAGE: Record<string, TriageLevel> = {
  critical: 'CRITICAL',
  high:     'HIGH',
  elevated: 'ELEVATED',
  stable:   'STABLE',
}

const TRIAGE_PRIORITY: Record<TriageLevel, number> = {
  CRITICAL: 0,
  HIGH:     1,
  ELEVATED: 2,
  STABLE:   3,
}

/**
 * Returns the highest-severity triage level for a point based on which
 * flood zone polygons contain it. Rescued households are never downgraded.
 * If the point is inside no zone, returns `originalLevel` unchanged.
 */
export function getFloodTriage(
  point: { lat: number; lng: number },
  floodZones: FloodZone[],
  originalLevel: TriageLevel,
): TriageLevel {
  let best = originalLevel
  for (const zone of floodZones) {
    if (!pointInPolygon(point, zone.polygon)) continue
    const candidate = FLOOD_SEVERITY_TO_TRIAGE[zone.severity]
    if (TRIAGE_PRIORITY[candidate] < TRIAGE_PRIORITY[best]) best = candidate
  }
  return best
}

/**
 * Convenience: filter + sort in one call.
 * Falls back to the full unfiltered list when no hazard is active.
 *
 * Usage in a component:
 *   const queue = getHazardPrioritizedQueue(households, activeHazard)
 *
 * Usage in a Zustand selector:
 *   const queue = useHouseholdStore((s) => getHazardPrioritizedQueue(s.households, activeHazard))
 */
export function getHazardPrioritizedQueue(
  households: Household[],
  hazard: HazardEvent | null,
): Household[] {
  if (!hazard?.isActive) return households
  const affected = filterHouseholdsInHazardZone(households, hazard)
  return sortHouseholdsByHazardProximity(affected, hazard)
}
