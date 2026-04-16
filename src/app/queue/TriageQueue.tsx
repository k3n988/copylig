'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useAssetStore } from '@/store/assetStore'
import { useHouseholdStore } from '@/store/householdStore'
import { useHazardStore } from '@/store/hazardStore'
import { useNoahFloodStore } from '@/store/noahFloodStore'
import { TRIAGE_ORDER } from '@/lib/triage'
import {
  getEffectiveHouseholdTriageFromHazards,
  getNearestHouseholdHazardDistanceKm,
  haversineKm,
  isHouseholdInAnyHazardZone,
  isPointInAnyPolygon,
} from '@/lib/geo'
import HouseholdCard from '@/components/triage/HouseholdCard'
import type { Household, TriageLevel, TriageResult } from '@/types'

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '6px 10px',
  fontSize: '0.78rem',
  cursor: 'pointer',
  flex: 1,
  minWidth: 0,
  color: 'var(--fg-default)',
}

const TRIAGE_DISPLAY: Record<TriageLevel, TriageResult> = {
  CRITICAL: { level: 'CRITICAL', hex: '#ff4d4d', colorName: 'red' },
  HIGH: { level: 'HIGH', hex: '#ff8000', colorName: 'orange' },
  ELEVATED: { level: 'ELEVATED', hex: '#f1c40f', colorName: 'yellow' },
  STABLE: { level: 'STABLE', hex: '#58a6ff', colorName: 'blue' },
}

interface QueueEntry {
  household: Household
  effectiveLevel: TriageLevel
  isInHazardZone: boolean
  hazardDistanceKm: number | null
  hazardPriorityRank: number
  matchingHazardTypes: string[]
  rescuerDistanceKm: number | null
  assignedToCurrentRescuer: boolean
}

const HAZARD_LEVEL_PRIORITY: Record<TriageLevel, number> = {
  CRITICAL: 0,
  HIGH: 1,
  ELEVATED: 2,
  STABLE: 3,
}

function getHazardLevelForHousehold(
  household: Household,
  activeHazards: ReturnType<typeof useHazardStore.getState>['activeHazards'],
  floodZones: ReturnType<typeof useHazardStore.getState>['floodZones'],
): TriageLevel | null {
  let bestLevel: TriageLevel | null = null

  for (const hazard of activeHazards) {
    if (!hazard.isActive) continue

    if (hazard.type === 'Flood') {
      for (const zone of floodZones) {
        if (!isPointInAnyPolygon({ lat: household.lat, lng: household.lng }, [zone.polygon])) continue
        const zoneLevel = zone.severity.toUpperCase() as TriageLevel
        if (!bestLevel || HAZARD_LEVEL_PRIORITY[zoneLevel] < HAZARD_LEVEL_PRIORITY[bestLevel]) {
          bestLevel = zoneLevel
        }
      }
      continue
    }

    const distanceKm = getNearestHouseholdHazardDistanceKm(household, [hazard])
    if (distanceKm === null) continue

    const level =
      distanceKm <= hazard.radii.critical ? 'CRITICAL'
        : distanceKm <= hazard.radii.high ? 'HIGH'
          : distanceKm <= hazard.radii.elevated ? 'ELEVATED'
            : distanceKm <= hazard.radii.stable ? 'STABLE'
              : null

    if (level && (!bestLevel || HAZARD_LEVEL_PRIORITY[level] < HAZARD_LEVEL_PRIORITY[bestLevel])) {
      bestLevel = level
    }
  }

  return bestLevel
}

function getHazardLevelForType(
  household: Household,
  hazard: ReturnType<typeof useHazardStore.getState>['activeHazards'][number],
  floodZones: ReturnType<typeof useHazardStore.getState>['floodZones'],
  floodOverrideLevel: TriageLevel | null,
): TriageLevel | null {
  if (!hazard.isActive) return null

  if (hazard.type === 'Flood') {
    if (floodOverrideLevel) return floodOverrideLevel
    for (const zone of floodZones) {
      if (isPointInAnyPolygon({ lat: household.lat, lng: household.lng }, [zone.polygon])) {
        return zone.severity.toUpperCase() as TriageLevel
      }
    }
    return null
  }

  const distanceKm = getNearestHouseholdHazardDistanceKm(household, [hazard])
  if (distanceKm === null) return null
  if (distanceKm <= hazard.radii.critical) return 'CRITICAL'
  if (distanceKm <= hazard.radii.high) return 'HIGH'
  if (distanceKm <= hazard.radii.elevated) return 'ELEVATED'
  if (distanceKm <= hazard.radii.stable) return 'STABLE'
  return null
}

export default function TriageQueue() {
  const user = useAuthStore((s) => s.user)
  const assets = useAssetStore((s) => s.assets)
  const loadAssets = useAssetStore((s) => s.loadAssets)
  const households = useHouseholdStore((s) => s.households)
  const loadHouseholds = useHouseholdStore((s) => s.loadHouseholds)
  const setSelectedId = useHouseholdStore((s) => s.setSelectedId)
  const activeHazards = useHazardStore((s) => s.activeHazards)
  const loadActiveHazard = useHazardStore((s) => s.loadActiveHazard)
  const floodZones = useHazardStore((s) => s.floodZones)
  const showNoahFlood = useNoahFloodStore((s) => s.visible)
  const noahAnalysisStatus = useNoahFloodStore((s) => s.analysisStatus)
  const noahVar3Polygons = useNoahFloodStore((s) => s.var3Polygons)
  const noahVar2Polygons = useNoahFloodStore((s) => s.var2Polygons)
  const noahVar1Polygons = useNoahFloodStore((s) => s.var1Polygons)
  const ensureAnalysisLoaded = useNoahFloodStore((s) => s.ensureAnalysisLoaded)

  const [cityFilter, setCityFilter] = useState('')
  const [brgyFilter, setBrgyFilter] = useState('')
  const [vulnerabilityFilter, setVulnerabilityFilter] = useState('')
  const [hazardFilter, setHazardFilter] = useState('')
  const [rescuerView, setRescuerView] = useState<'priority' | 'assigned' | 'nearest'>('priority')

  useEffect(() => {
    void loadHouseholds()
  }, [loadHouseholds])

  useEffect(() => {
    void loadAssets()
  }, [loadAssets])

  useEffect(() => {
    void loadActiveHazard()
  }, [loadActiveHazard])

  useEffect(() => {
    if (!showNoahFlood) return
    void ensureAnalysisLoaded()
  }, [ensureAnalysisLoaded, showNoahFlood])

  const hasActiveHazards = activeHazards.length > 0
  const isRescuer = user?.role === 'rescuer'
  const rescuerAsset = user?.assetId ? assets.find((asset) => asset.id === user.assetId) ?? null : null
  const activeHazardTypes = useMemo(
    () => Array.from(new Set(activeHazards.map((hazard) => hazard.type))).sort((a, b) => a.localeCompare(b)),
    [activeHazards],
  )

  const cities = useMemo(
    () =>
      Array.from(new Set(households.map((h) => h.city.trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b)),
    [households],
  )

  const barangays = useMemo(() => {
    const source = cityFilter
      ? households.filter((h) => h.city === cityFilter)
      : households
    return Array.from(new Set(source.map((h) => h.barangay.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [households, cityFilter])

  const handleCityChange = (v: string) => {
    setCityFilter(v)
    setBrgyFilter('')
  }

  const queueEntries = useMemo<QueueEntry[]>(() => {
    const filtered = households
      .filter((h) => h.approvalStatus === 'approved')
      .filter((h) => !cityFilter || h.city === cityFilter)
      .filter((h) => !brgyFilter || h.barangay === brgyFilter)
      .map((household) => {
        const point = { lat: household.lat, lng: household.lng }
        const hazardLayerLevel = getHazardLevelForHousehold(household, activeHazards, floodZones)
        const isInsideNoahVar3 = hasActiveHazards
          && activeHazards.some((hazard) => hazard.type === 'Flood')
          && showNoahFlood
          && noahAnalysisStatus === 'ready'
          && isPointInAnyPolygon(point, noahVar3Polygons)
        const isInsideNoahVar2 = hasActiveHazards
          && activeHazards.some((hazard) => hazard.type === 'Flood')
          && showNoahFlood
          && noahAnalysisStatus === 'ready'
          && !isInsideNoahVar3
          && isPointInAnyPolygon(point, noahVar2Polygons)
        const isInsideNoahVar1 = hasActiveHazards
          && activeHazards.some((hazard) => hazard.type === 'Flood')
          && showNoahFlood
          && noahAnalysisStatus === 'ready'
          && !isInsideNoahVar3
          && !isInsideNoahVar2
          && isPointInAnyPolygon(point, noahVar1Polygons)

        const baseEffectiveLevel = getEffectiveHouseholdTriageFromHazards(household, activeHazards, floodZones)
        const effectiveLevel = isInsideNoahVar3 ? 'CRITICAL' : isInsideNoahVar2 ? 'HIGH' : isInsideNoahVar1 ? 'ELEVATED' : baseEffectiveLevel
        const effectiveHazardLevel = isInsideNoahVar3 ? 'CRITICAL' : isInsideNoahVar2 ? 'HIGH' : isInsideNoahVar1 ? 'ELEVATED' : hazardLayerLevel
        const isInHazardZone = Boolean(effectiveHazardLevel) || isHouseholdInAnyHazardZone(household, activeHazards, floodZones)
        const matchingHazardTypes = activeHazards
          .filter((hazard) => getHazardLevelForType(
            household,
            hazard,
            floodZones,
            isInsideNoahVar3 ? 'CRITICAL' : isInsideNoahVar2 ? 'HIGH' : isInsideNoahVar1 ? 'ELEVATED' : null,
          ))
          .map((hazard) => hazard.type)
        const rescuerDistanceKm = rescuerAsset
          ? haversineKm(household.lat, household.lng, rescuerAsset.lat, rescuerAsset.lng)
          : null
        const assignedToCurrentRescuer = Boolean(user?.assetId && household.assignedAssetId === user.assetId)

        return {
          household: {
            ...household,
            triage: TRIAGE_DISPLAY[effectiveLevel],
          },
          effectiveLevel,
          isInHazardZone,
          hazardDistanceKm: getNearestHouseholdHazardDistanceKm(household, activeHazards),
          hazardPriorityRank: effectiveHazardLevel ? HAZARD_LEVEL_PRIORITY[effectiveHazardLevel] : Number.MAX_SAFE_INTEGER,
          matchingHazardTypes,
          rescuerDistanceKm,
          assignedToCurrentRescuer,
        }
      })
      .filter((entry) => isRescuer || !hazardFilter || entry.matchingHazardTypes.includes(hazardFilter))
      .filter((entry) => !vulnerabilityFilter || entry.effectiveLevel === vulnerabilityFilter)
      .filter((entry) => {
        if (!isRescuer) return true
        if (rescuerView === 'assigned') return entry.assignedToCurrentRescuer
        return true
      })

    return filtered.sort((a, b) => {
      if (a.household.status === 'Rescued' && b.household.status !== 'Rescued') return 1
      if (a.household.status !== 'Rescued' && b.household.status === 'Rescued') return -1

      if (isRescuer && rescuerView === 'assigned' && a.assignedToCurrentRescuer !== b.assignedToCurrentRescuer) {
        return a.assignedToCurrentRescuer ? -1 : 1
      }

      if (isRescuer && rescuerView === 'nearest') {
        const distanceA = a.rescuerDistanceKm ?? Number.MAX_SAFE_INTEGER
        const distanceB = b.rescuerDistanceKm ?? Number.MAX_SAFE_INTEGER
        if (distanceA !== distanceB) return distanceA - distanceB
      }

      if (hasActiveHazards && a.isInHazardZone !== b.isInHazardZone) {
        return a.isInHazardZone ? -1 : 1
      }

      if (a.isInHazardZone && b.isInHazardZone && a.hazardPriorityRank !== b.hazardPriorityRank) {
        return a.hazardPriorityRank - b.hazardPriorityRank
      }

      const triageDiff = TRIAGE_ORDER[a.effectiveLevel] - TRIAGE_ORDER[b.effectiveLevel]
      if (triageDiff !== 0) return triageDiff

      if (a.isInHazardZone && b.isInHazardZone) {
        const distanceA = a.hazardDistanceKm ?? Number.MAX_SAFE_INTEGER
        const distanceB = b.hazardDistanceKm ?? Number.MAX_SAFE_INTEGER
        if (distanceA !== distanceB) return distanceA - distanceB
      }

      return a.household.city.localeCompare(b.household.city) || a.household.barangay.localeCompare(b.household.barangay)
    })
  }, [households, cityFilter, brgyFilter, vulnerabilityFilter, hazardFilter, rescuerView, user, activeHazards, floodZones, hasActiveHazards, isRescuer, rescuerAsset, showNoahFlood, noahAnalysisStatus, noahVar3Polygons, noahVar2Polygons, noahVar1Polygons])

  const pending = queueEntries.filter((entry) => entry.household.status === 'Pending')
  const rescued = queueEntries.filter((entry) => entry.household.status === 'Rescued')
  const hazardPending = pending.filter((entry) => entry.isInHazardZone)
  const regularPending = pending.filter((entry) => !entry.isInHazardZone)
  const isFiltered = Boolean(cityFilter || brgyFilter || vulnerabilityFilter || hazardFilter)
  const showHazardPriority = Boolean(hasActiveHazards && hazardPending.length > 0)
  const hazardPriorityLabel = hazardFilter || activeHazards.map((hazard) => hazard.type).join(', ')
  const assignedCount = pending.filter((entry) => entry.assignedToCurrentRescuer).length
  const nearestCount = pending.filter((entry) => entry.rescuerDistanceKm !== null).length

  const renderPriorityGroups = (entries: QueueEntry[]) =>
    Object.keys(TRIAGE_ORDER).map((level) => {
      const group = entries.filter((entry) => entry.effectiveLevel === level)
      if (group.length === 0) return null

      return (
        <div key={level} style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              color: group[0].household.triage.hex,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>{level.charAt(0) + level.slice(1).toLowerCase()} Priority</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)', opacity: 0.5 }} />
          </div>
          {group.map(({ household }) => (
            <div key={household.id} onClick={() => setSelectedId(household.id)}>
              <HouseholdCard household={household} />
            </div>
          ))}
        </div>
      )
    })

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: '0.7rem',
            color: 'var(--fg-muted)',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 6,
          }}
        >
          Filter
        </div>
        {isRescuer && (
          <div className="mobile-stack" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {([
              { id: 'priority', label: 'Priority Missions' },
              { id: 'assigned', label: 'Assigned To Me' },
              { id: 'nearest', label: 'Nearest To Me' },
            ] as const).map((option) => {
              const active = rescuerView === option.id
              return (
                <button
                  key={option.id}
                  onClick={() => setRescuerView(option.id)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: active ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
                    background: active ? 'var(--accent-blue)' : 'var(--bg-surface)',
                    color: active ? '#fff' : 'var(--fg-default)',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        )}
        <div className="mobile-stack" style={{ display: 'flex', gap: 8 }}>
          <select
            value={cityFilter}
            onChange={(e) => handleCityChange(e.target.value)}
            aria-label="Filter queue by city"
            style={{ ...selectStyle, color: cityFilter ? 'var(--fg-default)' : 'var(--fg-muted)' }}
          >
            <option value="">
              All Cities / Municipalities
            </option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={brgyFilter}
            onChange={(e) => setBrgyFilter(e.target.value)}
            aria-label="Filter queue by barangay"
            style={{ ...selectStyle, color: brgyFilter ? 'var(--fg-default)' : 'var(--fg-muted)' }}
          >
            <option value="">
              All Barangays
            </option>
            {barangays.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          {!isRescuer && (
            <select
              value={hazardFilter}
              onChange={(e) => setHazardFilter(e.target.value)}
              aria-label="Filter queue by active disaster"
              style={{ ...selectStyle, color: hazardFilter ? 'var(--fg-default)' : 'var(--fg-muted)' }}
            >
              <option value="">
                {activeHazardTypes.length > 1 ? 'All Active Disasters' : 'Active Disaster'}
              </option>
              {activeHazardTypes.map((hazardType) => (
                <option key={hazardType} value={hazardType}>
                  {hazardType}
                </option>
              ))}
            </select>
          )}

          <select
            value={vulnerabilityFilter}
            onChange={(e) => setVulnerabilityFilter(e.target.value)}
            aria-label="Filter queue by priority"
            style={{ ...selectStyle, color: vulnerabilityFilter ? 'var(--fg-default)' : 'var(--fg-muted)' }}
          >
            <option value="">
              All Priorities
            </option>
            {Object.keys(TRIAGE_ORDER).map((level) => (
              <option key={level} value={level}>
                {level.charAt(0) + level.slice(1).toLowerCase()}
              </option>
            ))}
          </select>

          {isFiltered && (
            <button
              onClick={() => {
                setCityFilter('')
                setBrgyFilter('')
                setHazardFilter('')
                setVulnerabilityFilter('')
                setRescuerView('priority')
              }}
              title="Clear filters"
              aria-label="Clear queue filters"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                color: 'var(--fg-muted)',
                borderRadius: 4,
                padding: '0 10px',
                cursor: 'pointer',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <XIcon size={14} />
            </button>
          )}
        </div>
      </div>

      <div
        className="mobile-stack"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          gap: 8,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          {isFiltered ? (
            <>
              {cityFilter || 'All Cities'}
              {brgyFilter ? ` · ${brgyFilter}` : ''}
            </>
          ) : (
            'Active Queue'
          )}
        </h2>
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--critical-red)',
            fontWeight: 700,
          }}
        >
          {pending.length} pending
        </span>
      </div>

      {showHazardPriority && (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--critical-red)',
            background: 'var(--bg-danger-subtle)',
            color: 'var(--fg-default)',
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: 'var(--critical-red)' }}>
            {isRescuer ? 'Priority Missions In Active Hazard Zones' : `${hazardPriorityLabel} Hazard Priority Active`}
          </div>
          <div style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
            {isRescuer
              ? `${hazardPending.length} priority mission${hazardPending.length !== 1 ? 's' : ''} are inside active hazard layers. Assigned: ${assignedCount}. Nearest available: ${nearestCount}.`
              : `${hazardPending.length} household${hazardPending.length !== 1 ? 's' : ''} inside the active hazard layer are pinned to the top of the queue.`}
          </div>
        </div>
      )}

      {queueEntries.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'var(--bg-surface)',
            border: '1px dashed var(--border)',
            borderRadius: 8,
            color: 'var(--fg-muted)',
          }}
        >
          <SearchIcon size={32} />
          <p style={{ margin: '12px 0 0', fontSize: '0.85rem', fontWeight: 500 }}>
            No reports match this filter.
          </p>
        </div>
      ) : (
        <>
          {showHazardPriority ? (
            <>
              <div
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--critical-red)',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  fontWeight: 800,
                  marginBottom: 12,
                }}
              >
                Inside Active Hazard Layer
              </div>
              {renderPriorityGroups(hazardPending)}

              {regularPending.length > 0 && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      margin: '24px 0 16px',
                      fontSize: '0.65rem',
                      color: 'var(--fg-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: 1.5,
                      fontWeight: 700,
                    }}
                  >
                    <span style={{ flexShrink: 0 }}>Outside Active Hazard Layer</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                  {renderPriorityGroups(regularPending)}
                </>
              )}
            </>
          ) : (
            renderPriorityGroups(pending)
          )}

          {rescued.length > 0 && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  margin: '24px 0 16px',
                  fontSize: '0.65rem',
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  fontWeight: 700,
                }}
              >
                <span style={{ flexShrink: 0 }}>Completed Operations</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              {rescued.map(({ household }) => (
                <div key={household.id} onClick={() => setSelectedId(household.id)}>
                  <HouseholdCard household={household} />
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}

function XIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function SearchIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
