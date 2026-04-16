'use client'
// src/components/map/HazardControlPanel.tsx
import { useMap } from '@vis.gl/react-google-maps'
import { useState } from 'react'
import { useHazardStore } from '@/store/hazardStore'
import { useAuthStore } from '@/store/authStore'
import type { FloodSeverity, FloodZone, HazardEvent } from '@/types'
import FloodDrawingManager from './FloodDrawingManager'

const HAZARD_TYPES = ['Flood', 'Volcano', 'Earthquake', 'Typhoon', 'Landslide', 'Storm Surge']

const SEVERITY_COLOR: Record<FloodSeverity, string> = {
  critical: '#ff4d4d',
  high:     '#ff8000',
  elevated: '#f1c40f',
  stable:   '#58a6ff',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  background: '#0d1117',
  border: '1px solid #30363d',
  color: '#fff',
  borderRadius: 4,
  fontSize: '0.78rem',
  fontFamily: 'Inter, sans-serif',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.62rem',
  color: '#8b949e',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 3,
  fontWeight: 600,
}

const RING_COLORS = {
  critical: '#ff4d4d',
  high:     '#ff8000',
  elevated: '#f1c40f',
  stable:   '#58a6ff',
}

export default function HazardControlPanel() {
  const {
    activeHazard,
    activeHazards,
    focusedHazardType,
    setActiveHazard,
    clearHazard,
    setFocusedHazardType,
    isSelectingCenter,
    setIsSelectingCenter,
    draftCenter,
    floodZones,
    draftFloodZones,
    addDraftFloodZone,
    removeDraftFloodZone,
    deleteFloodZone,
  } = useHazardStore()

  const user = useAuthStore((s) => s.user)
  const map  = useMap()

  // -- Panel open/close --------------------------------------------------
  const [open, setOpen] = useState(false)

  // -- Volcano state -----------------------------------------------------
  const [hazardType, setHazardType] = useState(() => activeHazard?.type ?? 'Flood')
  const [critical,   setCritical]   = useState(() => String(activeHazard?.radii.critical ?? 1))
  const [high,       setHigh]       = useState(() => String(activeHazard?.radii.high     ?? 3))
  const [elevated,   setElevated]   = useState(() => String(activeHazard?.radii.elevated ?? 5))
  const [stable,     setStable]     = useState(() => String(activeHazard?.radii.stable   ?? 10))

  // -- Flood drawing state -----------------------------------------------
  const [isDrawing, setIsDrawing] = useState(false)

  // -- Zone list collapse (auto-collapses when >= 5 zones) ---------------
  const [savedZonesOpen,   setSavedZonesOpen]   = useState(() => floodZones.length < 5)
  const [pendingZonesOpen, setPendingZonesOpen] = useState(() => draftFloodZones.length < 5)

  // Early return AFTER all hooks
  if (activeHazards.length === 0 && user?.role !== 'admin') return null

  // -- Handlers ----------------------------------------------------------

  function focusHazardOnMap(hazard: HazardEvent) {
    if (!map) return

    if (hazard.type === 'Flood') {
      const polygons = floodZones.flatMap((zone) => zone.polygon)
      if (polygons.length === 0) return

      const bounds = new google.maps.LatLngBounds()
      polygons.forEach((point) => bounds.extend(point))
      map.fitBounds(bounds)
      return
    }

    map.panTo(hazard.center)
    map.setZoom(12)
  }

  function handlePickCenter() {
    setIsSelectingCenter(true)
  }

  function handlePolygonComplete(coords: Array<{ lat: number; lng: number }>) {
    if (coords.length < 3) return
    const zone: FloodZone = {
      id:       'FZ-' + Date.now(),
      severity: 'critical',
      polygon:  coords,
    }
    addDraftFloodZone(zone)
    setIsDrawing(false)
  }

  function selectHazardType(nextType: string) {
    setHazardType(nextType)
    setIsDrawing(false)

    const matchingActiveHazard = activeHazards.find((hazard) => hazard.type === nextType)
    if (!matchingActiveHazard) return

    if (matchingActiveHazard.type !== 'Flood') {
      setCritical(String(matchingActiveHazard.radii.critical))
      setHigh(String(matchingActiveHazard.radii.high))
      setElevated(String(matchingActiveHazard.radii.elevated))
      setStable(String(matchingActiveHazard.radii.stable))
    }
  }

  async function handleActivate() {
    if (hazardType === 'Flood') {
      if (draftFloodZones.length === 0 && floodZones.length === 0) return
      const hazard: HazardEvent = {
        id:       'HZ-' + Date.now(),   // DB will return real id; store uses that for FK
        type:     'Flood',
        center:   { lat: 0, lng: 0 },
        radii:    { critical: 0, high: 0, elevated: 0, stable: 0 },
        isActive: true,
      }
      await setActiveHazard(hazard)
    } else {
      if (!draftCenter) return
      const hazard: HazardEvent = {
        id:       'HZ-' + Date.now(),
        type:     hazardType,
        center:   draftCenter,
        radii: {
          critical: parseFloat(critical) || 1,
          high:     parseFloat(high)     || 3,
          elevated: parseFloat(elevated) || 5,
          stable:   parseFloat(stable)   || 10,
        },
        isActive: true,
      }
      await setActiveHazard(hazard)
    }
    setOpen(false)
  }

  async function handleClear() {
    await clearHazard(hazardType)
    setIsDrawing(false)
    setOpen(false)
  }

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const isFlood       = hazardType === 'Flood'
  const selectedActiveHazard = activeHazards.find((hazard) => hazard.type === hazardType) ?? null
  const canActivate   = isFlood
    ? (draftFloodZones.length > 0 || floodZones.length > 0)
    : !!draftCenter

  const primaryControlStyle: React.CSSProperties = {
    height: 40,
    padding: '0 16px',
    borderRadius: 8,
    background: '#161b22',
    border: '1px solid #30363d',
    color: '#f0f6fc',
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: 1,
    cursor: (activeHazards.length > 0 || user?.role === 'admin') ? 'pointer' : 'default',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    fontFamily: 'Inter, sans-serif',
    whiteSpace: 'nowrap',
  }

  const activeBadgeStyle: React.CSSProperties = {
    height: 40,
    padding: '0 16px',
    borderRadius: 8,
    background: 'linear-gradient(180deg, rgba(255, 3, 3, 0.8) 0%, rgba(139, 0, 0, 0.9) 100%)',
    border: '1.5px solid #ff4d4d',
    color: '#ffffff',
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: 0.8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    boxShadow: '0 0 10px rgba(255, 77, 77, 0.4)',
    fontFamily: 'Inter, sans-serif',
    whiteSpace: 'nowrap',
    animation: 'pulse-red 2s infinite',
  }

  return (
    <>
      <style>{`
        @keyframes pulse-red {
          0% { border-color: #ff4d4d; box-shadow: 0 0 0 0 rgba(255, 77, 77, 0.7); }
          70% { border-color: #ff4d4d; box-shadow: 0 0 0 10px rgba(255, 77, 77, 0); }
          100% { border-color: #ff4d4d; box-shadow: 0 0 0 0 rgba(255, 77, 77, 0); }
        }
      `}</style>

      {/* Anchor 1: Top Left Action */}
      {(user?.role === 'admin' || activeHazards.length > 0) && (
        <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 30 }}>
          <button
            onClick={() => {
              setOpen((o) => !o)
              if (activeHazard?.isActive && map && activeHazard.type !== 'Flood') {
                map.panTo(activeHazard.center)
                map.setZoom(12)
              }
            }}
            style={primaryControlStyle}
          >
            HAZARD LAYER
          </button>
        </div>
      )}

      {/* Anchor 2: Top Middle Status */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}
      >
        {activeHazards.map((hazard) => (
          <button
            key={hazard.id}
            onClick={() => {
              selectHazardType(hazard.type)
              setFocusedHazardType(hazard.type)
              setOpen(true)
              focusHazardOnMap(hazard)
            }}
            style={activeBadgeStyle}
          >
            <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>▲</span>
            {`ACTIVE: ${hazard.type.toUpperCase()}`}
          </button>
        ))}
      </div>

      {/* -- Drawing manager (mounts only when drawing) ------------------- */}
      <FloodDrawingManager active={isDrawing} onPolygonComplete={handlePolygonComplete} />

      {open && (
        <div style={{
          position: 'absolute',
          top: 70,
          left: 20,
          width: 290,
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 8,
          padding: 14,
          boxShadow: '0 4px 20px rgba(0,0,0,.6)',
          fontFamily: 'Inter, sans-serif',
          maxHeight: '80vh',
          overflowY: 'auto',
          pointerEvents: 'auto',
        }}>

          {/* Header */}
          <div style={{
            fontSize: '0.72rem', fontWeight: 800, color: '#fff',
            textTransform: 'uppercase', letterSpacing: 1,
            borderLeft: '3px solid #ff4d4d', paddingLeft: 8, marginBottom: 12,
          }}>
            Hazard Layer
            {user?.role !== 'admin' && (
              <span style={{ float: 'right', fontSize: '0.6rem', color: '#8b949e', fontWeight: 400, textTransform: 'none' }}>
                Read-only
              </span>
            )}
          </div>

          {/* Active hazard badge */}
          {selectedActiveHazard && (
            <div style={{
              background: '#3d1a1a', border: '1px solid #da3633',
              borderRadius: 4, padding: '6px 10px', marginBottom: 12,
              fontSize: '0.72rem', color: '#ff4d4d', fontWeight: 600,
            }}>
              {selectedActiveHazard.type === 'Flood'
                ? `FLOOD - ${floodZones.length} zone${floodZones.length !== 1 ? 's' : ''} active`
                : `HAZARD: ${selectedActiveHazard.type} - ${selectedActiveHazard.center.lat.toFixed(4)}, ${selectedActiveHazard.center.lng.toFixed(4)}`
              }
            </div>
          )}

          {/* -- ADMIN CONTROLS ---------------------------------------------- */}
          {user?.role === 'admin' ? (
            <>
              {/* Disaster type selector */}
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Disaster Type</label>
                <select
                  value={hazardType}
                  onChange={(e) => {
                    selectHazardType(e.target.value)
                  }}
                  style={inputStyle}
                >
                  {HAZARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* -- FLOOD BRANCH ---------------------------------------------- */}
              {isFlood ? (
                <>
                  {/* Persisted zones (already saved) */}
                  {floodZones.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      {floodZones.length >= 5 ? (
                        /* Collapsible header when 5+ zones */
                        <button
                          onClick={() => setSavedZonesOpen((o) => !o)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', background: 'transparent', border: 'none',
                            padding: '2px 0', marginBottom: savedZonesOpen ? 5 : 0,
                            cursor: 'pointer',
                          }}
                        >
                          <span style={labelStyle}>Saved Zones ({floodZones.length})</span>
                          <span style={{ fontSize: '0.65rem', color: '#8b949e', lineHeight: 1 }}>
                            {savedZonesOpen ? '▲ collapse' : '▼ expand'}
                          </span>
                        </button>
                      ) : (
                        <label style={labelStyle}>Saved Zones ({floodZones.length})</label>
                      )}
                      {savedZonesOpen && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {floodZones.map((z) => (
                            <ZoneCard
                              key={z.id}
                              zone={z}
                              onRemove={() => deleteFloodZone(z.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Draft zones (not yet saved) */}
                  {draftFloodZones.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      {draftFloodZones.length >= 5 ? (
                        /* Collapsible header when 5+ zones */
                        <button
                          onClick={() => setPendingZonesOpen((o) => !o)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', background: 'transparent', border: 'none',
                            padding: '2px 0', marginBottom: pendingZonesOpen ? 5 : 0,
                            cursor: 'pointer',
                          }}
                        >
                          <span style={labelStyle}>Pending Zones ({draftFloodZones.length})</span>
                          <span style={{ fontSize: '0.65rem', color: '#8b949e', lineHeight: 1 }}>
                            {pendingZonesOpen ? '▲ collapse' : '▼ expand'}
                          </span>
                        </button>
                      ) : (
                        <label style={labelStyle}>Pending Zones ({draftFloodZones.length})</label>
                      )}
                      {pendingZonesOpen && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {draftFloodZones.map((z) => (
                            <ZoneCard
                              key={z.id}
                              zone={z}
                              onRemove={() => removeDraftFloodZone(z.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Draw trigger */}
                  <button
                    onClick={() => setIsDrawing(true)}
                    disabled={isDrawing}
                    style={{
                      width: '100%', padding: '8px',
                      background: isDrawing ? '#21262d' : '#1f6feb',
                      color: isDrawing ? '#8b949e' : '#fff',
                      border: 'none', borderRadius: 4,
                      fontWeight: 700, fontSize: '0.78rem',
                      cursor: isDrawing ? 'not-allowed' : 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      marginBottom: 10,
                    }}
                  >
                    {isDrawing ? 'Drawing... click map to place points' : 'Draw Flood Area'}
                  </button>
                </>
              ) : (
                /* -- VOLCANO / OTHER BRANCH ---------------------------------- */
                <>
                  {/* Radii grid */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Hazard Radii (km)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {([
                        { key: 'critical', label: 'Critical', val: critical, set: setCritical, color: RING_COLORS.critical },
                        { key: 'high',     label: 'High',     val: high,     set: setHigh,     color: RING_COLORS.high     },
                        { key: 'elevated', label: 'Elevated', val: elevated, set: setElevated, color: RING_COLORS.elevated },
                        { key: 'stable',   label: 'Stable',   val: stable,   set: setStable,   color: RING_COLORS.stable   },
                      ] as const).map(({ key, label, val, set, color }) => (
                        <div key={key}>
                          <label style={{ ...labelStyle, color }}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 4 }} />
                            {label}
                          </label>
                          <input
                            type="number" min="0.1" step="0.5"
                            value={val}
                            onChange={(e) => set(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Center picker */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Hazard Center</label>
                    {draftCenter ? (
                      <div style={{
                        padding: '6px 9px', background: '#0d2016',
                        border: '1px solid #238636', borderRadius: 4,
                        fontSize: '0.72rem', color: '#3fb950', fontWeight: 600,
                      }}>
                        {draftCenter.lat.toFixed(5)}, {draftCenter.lng.toFixed(5)}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.72rem', color: '#8b949e' }}>No center picked yet</div>
                    )}
                  </div>

                  <button
                    onClick={handlePickCenter}
                    disabled={isSelectingCenter}
                    style={{
                      width: '100%', padding: '8px',
                      background: '#1f6feb', color: '#fff',
                      border: 'none', borderRadius: 4,
                      fontWeight: 700, fontSize: '0.78rem',
                      cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      opacity: isSelectingCenter ? 0.6 : 1,
                      marginBottom: 6,
                    }}
                  >
                    Pick Center on Map
                  </button>
                </>
              )}

              {/* -- Shared action buttons ------------------------------------ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                <button
                  onClick={handleActivate}
                  disabled={!canActivate}
                  style={{
                    padding: '8px',
                    background: canActivate ? '#238636' : '#21262d',
                    color:      canActivate ? '#fff'     : '#8b949e',
                    border: 'none', borderRadius: 4,
                    fontWeight: 700, fontSize: '0.78rem',
                    cursor: canActivate ? 'pointer' : 'not-allowed',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Activate Hazard Layer
                </button>

                {selectedActiveHazard && (
                  <button
                    onClick={handleClear}
                    style={{
                      padding: '8px', background: 'transparent',
                      color: '#f85149', border: '1px solid #da3633',
                      borderRadius: 4, fontWeight: 600, fontSize: '0.78rem',
                      cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    Clear Hazard Layer
                  </button>
                )}
              </div>
            </>
          ) : (
            /* -- READ-ONLY VIEW (guests / citizens) ---------------------- */
            <div style={{ fontSize: '0.75rem', color: '#8b949e', lineHeight: 1.5 }}>
              {activeHazard?.type === 'Flood' ? (
                <>
                  <p style={{ margin: '0 0 8px' }}>
                    An active <b>Flood</b> hazard is being monitored. {floodZones.length} flood zone{floodZones.length !== 1 ? 's' : ''} are marked on the map.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(['critical', 'high', 'elevated', 'stable'] as FloodSeverity[]).map((sev) => {
                      const count = floodZones.filter((z) => z.severity === sev).length
                      if (!count) return null
                      return (
                        <div key={sev} style={{ color: SEVERITY_COLOR[sev] }}>
                          - {sev.charAt(0).toUpperCase() + sev.slice(1)}: {count} area{count !== 1 ? 's' : ''}
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p style={{ margin: '0 0 8px' }}>
                    An active <b>{activeHazard?.type}</b> hazard zone is being monitored.
                    Triage levels for households within these radii are dynamically adjusted.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ color: RING_COLORS.critical }}>- Critical: {activeHazard?.radii.critical}km</div>
                    <div style={{ color: RING_COLORS.high     }}>- High: {activeHazard?.radii.high}km</div>
                    <div style={{ color: RING_COLORS.elevated }}>- Elevated: {activeHazard?.radii.elevated}km</div>
                    <div style={{ color: RING_COLORS.stable   }}>- Stable: {activeHazard?.radii.stable}km</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// -- Zone card -----------------------------------------------------------

function ZoneCard({ zone, onRemove }: { zone: FloodZone; onRemove: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 8px',
      background: '#0d1117',
      border: `1px solid ${SEVERITY_COLOR[zone.severity]}44`,
      borderLeft: `3px solid ${SEVERITY_COLOR[zone.severity]}`,
      borderRadius: 4,
      gap: 6,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: SEVERITY_COLOR[zone.severity], textTransform: 'capitalize' }}>
          {zone.severity}
        </span>
        {zone.depth && (
          <span style={{ fontSize: '0.68rem', color: '#8b949e', marginLeft: 6 }}>
            {zone.depth}-deep
          </span>
        )}
        {zone.notes && (
          <p style={{ margin: '2px 0 0', fontSize: '0.65rem', color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {zone.notes}
          </p>
        )}
      </div>
      <button
        onClick={onRemove}
        style={{
          background: 'transparent', border: 'none',
          color: '#8b949e', cursor: 'pointer',
          fontSize: '0.9rem', lineHeight: 1, padding: '0 2px',
          flexShrink: 0,
        }}
        title="Remove zone"
      >
        x
      </button>
    </div>
  )
}
