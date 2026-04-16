'use client'

import { useMemo, useState } from 'react'
import { getEffectiveHouseholdTriageFromHazards, isHouseholdInAnyHazardZone } from '@/lib/geo'
import { TRIAGE_ORDER } from '@/lib/triage'
import type { Asset, FloodZone, HazardEvent, Household, TriageLevel, TriageResult } from '@/types'

interface Props {
  households: Household[]
  assets: Asset[]
  activeHazard: HazardEvent | null
  activeHazards: HazardEvent[]
  floodZones: FloodZone[]
  onClose: () => void
}

type FilterLevel = TriageLevel | 'RESCUED' | 'TOTAL' | null

const LEVEL_COLOR: Record<string, string> = {
  CRITICAL: '#ff4d4d',
  HIGH:     '#ff8000',
  ELEVATED: '#f1c40f',
  STABLE:   '#58a6ff',
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: '0.68rem',
  fontWeight: 700,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '0.8rem',
  color: 'var(--fg-default)',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'top',
}

const sectionShell: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 18,
  overflow: 'hidden',
  background: 'var(--bg-surface)',
  boxShadow: 'var(--shadow-soft)',
}

const TRIAGE_DISPLAY: Record<TriageLevel, TriageResult> = {
  CRITICAL: { level: 'CRITICAL', hex: '#ff4d4d', colorName: 'red' },
  HIGH:     { level: 'HIGH',     hex: '#ff8000', colorName: 'orange' },
  ELEVATED: { level: 'ELEVATED', hex: '#f1c40f', colorName: 'yellow' },
  STABLE:   { level: 'STABLE',   hex: '#58a6ff', colorName: 'blue' },
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadgeStyle(status: 'Pending' | 'Rescued'): React.CSSProperties {
  const isRescued = status === 'Rescued'
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 999,
    fontSize: '0.7rem',
    fontWeight: 700,
    background: isRescued ? 'var(--success-soft)' : 'var(--warning-soft)',
    border: `1px solid ${isRescued ? 'var(--success-border)' : 'var(--warning-border)'}`,
    color: isRescued ? 'var(--success-strong)' : 'var(--warning-strong)',
  }
}

function assetStatusBadgeStyle(status: string): React.CSSProperties {
  if (status === 'Active') {
    return {
      background: 'var(--success-soft)',
      border: '1px solid var(--success-border)',
      color: 'var(--success-strong)',
    }
  }
  if (status === 'Dispatching') {
    return {
      background: 'var(--warning-soft)',
      border: '1px solid var(--warning-border)',
      color: 'var(--warning-strong)',
    }
  }
  return {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--fg-muted)',
  }
}

export default function SummaryReportModal({ households, assets, activeHazard, activeHazards, floodZones }: Props) {
  const now = new Date().toISOString()

  // 0. Disaster selector (only relevant when 2+ active hazards)
  const [selectedHazardId, setSelectedHazardId] = useState<string>('ALL')

  // 1a. Narrow hazards/zones to the selected disaster
  const viewHazards = useMemo(() => {
    if (selectedHazardId === 'ALL' || activeHazards.length <= 1) return activeHazards
    return activeHazards.filter((h) => h.id === selectedHazardId)
  }, [activeHazards, selectedHazardId])

  const viewFloodZones = useMemo(() => {
    return viewHazards.some((h) => h.type === 'Flood') ? floodZones : []
  }, [viewHazards, floodZones])

  // 1b. Base Affected Households Logic
  const reportHouseholds = useMemo(() => {
    if (viewHazards.length === 0) return households

    return households
      .filter((household) => isHouseholdInAnyHazardZone(household, viewHazards, viewFloodZones))
      .map((household) => {
        const effectiveLevel = getEffectiveHouseholdTriageFromHazards(household, viewHazards, viewFloodZones)
        return {
          ...household,
          triage: TRIAGE_DISPLAY[effectiveLevel],
        }
      })
  }, [households, viewHazards, viewFloodZones])

  const [filter, setFilter] = useState<FilterLevel>('TOTAL')

  // 2. Summary Metrics
  const pending = reportHouseholds.filter((h) => h.status === 'Pending')
  const rescuedCount = reportHouseholds.filter((h) => h.status === 'Rescued').length
  const counts = {
    CRITICAL: pending.filter((h) => h.triage.level === 'CRITICAL').length,
    HIGH:     pending.filter((h) => h.triage.level === 'HIGH').length,
    ELEVATED: pending.filter((h) => h.triage.level === 'ELEVATED').length,
    STABLE:   pending.filter((h) => h.triage.level === 'STABLE').length,
  }

  const incidentLabel = viewHazards.length > 0
    ? viewHazards.map((h) => (h.type === 'Volcano' ? 'Volcano Eruption' : h.type)).join(', ')
    : null

  // 3. Filtered table rows (driven by stat card clicks)
  const filteredHouseholds = useMemo(() => {
    let list = [...reportHouseholds]
    if (filter === 'RESCUED' || filter === null) {
      list = list.filter((h) => h.status === 'Rescued')
    } else if (filter && filter !== 'TOTAL') {
      list = list.filter((h) => h.status === 'Pending' && h.triage.level === filter)
    }
    return list.sort((a, b) => TRIAGE_ORDER[a.triage.level] - TRIAGE_ORDER[b.triage.level])
  }, [reportHouseholds, filter])

  const handlePrint = () => window.print()

  const handleCopy = () => {
    const lines = [
      'L.I.G.T.A.S. INCIDENT SUMMARY REPORT',
      `Generated: ${fmt(now)}`,
      incidentLabel ? `Latest Incident: ${incidentLabel}` : 'Latest Incident: None',
      '',
      `CRITICAL: ${counts.CRITICAL}  HIGH: ${counts.HIGH}  ELEVATED: ${counts.ELEVATED}  STABLE: ${counts.STABLE}`,
      `RESCUED: ${rescuedCount}  PENDING: ${pending.length}  TOTAL: ${reportHouseholds.length}`,
      '',
      `=== ${incidentLabel ? `${incidentLabel.toUpperCase()} AFFECTED` : 'ALL HOUSEHOLDS'} ===`,
      ...filteredHouseholds.map((hh) => {
        const asset = assets.find((item) => item.id === hh.assignedAssetId)
        return `${hh.head} | ${hh.triage.level} | ${hh.barangay}, ${hh.city} | ${hh.status} | ${asset ? asset.name : 'Unassigned'}`
      }),
      '',
      '=== ASSETS ===',
      ...assets.map((a) => `${a.name} | ${a.unit} | ${a.status}`),
    ]

    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => alert('Report copied to clipboard.'))
      .catch(() => alert('Copy failed. Try Print instead.'))
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: 'var(--fg-default)' }}>
      <style>{`
        @keyframes pulse-red {
          0%   { box-shadow: 0 0 0 0 rgba(255,77,77,0.6); }
          70%  { box-shadow: 0 0 0 5px rgba(255,77,77,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,77,77,0); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--fg-strong)' }}>
            L.I.G.T.A.S. Incident Summary Report
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-strong)', marginTop: 3 }}>
            Generated: {fmt(now)} &mdash; Bacolod City DRRMO Command Center
          </div>
          <div style={{ fontSize: '0.74rem', color: activeHazard?.isActive ? 'var(--critical-red)' : 'var(--fg-muted)', marginTop: 8, fontWeight: 700 }}>
            {incidentLabel ? `Latest Incident: ${incidentLabel}` : 'Latest Incident: None'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 4 }}>
            {incidentLabel
              ? `This summary only includes households inside the active ${incidentLabel.toLowerCase()} hazard layer.`
              : 'This summary includes all registered households because there is no active hazard layer.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handlePrint}
            style={{
              padding: '8px 14px',
              background: 'var(--accent-blue)',
              border: '1px solid var(--accent-blue)',
              color: '#fff',
              borderRadius: 999,
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Print
          </button>
          <button
            onClick={handleCopy}
            style={{
              padding: '8px 14px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--fg-default)',
              borderRadius: 999,
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Copy
          </button>
        </div>
      </div>

      {/* Disaster selector — only shown when 2+ disasters are active */}
      {activeHazards.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Filter by Disaster
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* "All" pill */}
            <button
              onClick={() => { setSelectedHazardId('ALL'); setFilter('TOTAL') }}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                border: selectedHazardId === 'ALL'
                  ? '2px solid var(--accent-blue)'
                  : '1px solid var(--border)',
                background: selectedHazardId === 'ALL'
                  ? 'var(--accent-blue)'
                  : 'var(--bg-elevated)',
                color: selectedHazardId === 'ALL'
                  ? '#fff'
                  : 'var(--fg-default)',
              }}
            >
              All Disasters
            </button>
            {/* One pill per active disaster */}
            {activeHazards.map((hazard) => {
              const label = hazard.type === 'Volcano' ? 'Volcano Eruption' : hazard.type
              const isSelected = selectedHazardId === hazard.id
              const dotColor = '#ff4d4d'
              return (
                <button
                  key={hazard.id}
                  onClick={() => { setSelectedHazardId(hazard.id); setFilter('TOTAL') }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 999,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    border: isSelected
                      ? `2px solid ${dotColor}`
                      : '1px solid var(--border)',
                    background: isSelected
                      ? 'color-mix(in srgb, #ff4d4d 12%, var(--bg-surface))'
                      : 'var(--bg-elevated)',
                    color: isSelected ? dotColor : 'var(--fg-default)',
                  }}
                >
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: dotColor,
                    display: 'inline-block', flexShrink: 0,
                    animation: 'pulse-red 2s infinite',
                  }} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Stat cards — click to filter the table below */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10, marginBottom: 28 }}>
        {([
          { label: 'CRITICAL', value: counts.CRITICAL, color: LEVEL_COLOR.CRITICAL },
          { label: 'HIGH',     value: counts.HIGH,     color: LEVEL_COLOR.HIGH },
          { label: 'ELEVATED', value: counts.ELEVATED, color: LEVEL_COLOR.ELEVATED },
          { label: 'STABLE',   value: counts.STABLE,   color: LEVEL_COLOR.STABLE },
          { label: 'RESCUED',  value: rescuedCount,    color: '#2da44e' },
          { label: 'TOTAL',    value: reportHouseholds.length, color: 'var(--fg-strong)' },
        ] as const).map(({ label, value, color }) => {
          const active = filter === label
          return (
            <button
              key={label}
              onClick={() => setFilter(active ? null : label as FilterLevel)}
              style={{
                background: 'var(--bg-surface)',
                border: active
                  ? `3px solid ${color}`
                  : `1px solid color-mix(in srgb, ${color} 28%, var(--border))`,
                borderRadius: 16,
                padding: active ? '13px 11px' : '14px 12px',
                textAlign: 'center',
                boxShadow: active
                  ? `0 0 0 2px var(--bg-surface), 0 8px 20px -4px ${color}44`
                  : 'var(--shadow-soft)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                transform: active ? 'scale(1.03)' : 'none',
                outline: 'none',
              }}
            >
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--fg-muted)', marginTop: 5, letterSpacing: 0.5 }}>{label}</div>
            </button>
          )
        })}
      </div>

      {/* Households table */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderLeft: '3px solid var(--accent-blue)', paddingLeft: 10, marginBottom: 12 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--fg-strong)', textTransform: 'uppercase', letterSpacing: 1 }}>
            {incidentLabel
              ? `${incidentLabel} Affected Households (${filteredHouseholds.length})`
              : `All Households (${filteredHouseholds.length})`}
          </span>
          {filter && filter !== 'TOTAL' && (
            <button
              onClick={() => setFilter('TOTAL')}
              style={{ fontSize: '0.68rem', color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
            >
              ✕ Clear filter
            </button>
          )}
        </div>
        <div style={sectionShell}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg-elevated)' }}>
              <tr>
                <th style={thStyle}>Household Head</th>
                <th style={thStyle}>Triage</th>
                <th style={thStyle}>Location</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Assigned Asset</th>
                <th style={thStyle}>Dispatched At</th>
              </tr>
            </thead>
            <tbody>
              {filteredHouseholds.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, color: 'var(--fg-muted)', textAlign: 'center', padding: '20px' }}>
                    {incidentLabel
                      ? `No households are currently inside the active ${incidentLabel.toLowerCase()} hazard layer.`
                      : 'No households registered yet.'}
                  </td>
                </tr>
              )}
              {filteredHouseholds.map((hh) => {
                const asset = assets.find((item) => item.id === hh.assignedAssetId)
                return (
                  <tr
                    key={hh.id}
                    style={{ background: 'var(--bg-surface)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)' }}
                  >
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: 'var(--fg-strong)' }}>{hh.head}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', marginTop: 2 }}>{hh.contact}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 700, fontSize: '0.72rem', color: LEVEL_COLOR[hh.triage.level] ?? 'var(--fg-strong)' }}>
                        {hh.triage.level}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div>Brgy. {hh.barangay}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>{hh.city}</div>
                    </td>
                    <td style={{ ...tdStyle, fontSize: '0.74rem', color: 'var(--fg-muted)' }}>
                      {hh.source ?? '-'}
                    </td>
                    <td style={tdStyle}>
                      <span style={statusBadgeStyle(hh.status)}>{hh.status}</span>
                    </td>
                    <td style={tdStyle}>
                      {asset
                        ? `${asset.icon} ${asset.name}`
                        : <span style={{ color: 'var(--fg-muted)' }}>Unassigned</span>}
                    </td>
                    <td style={{ ...tdStyle, fontSize: '0.74rem', color: 'var(--fg-muted)' }}>
                      {hh.dispatchedAt ? fmt(hh.dispatchedAt) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assets table */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', borderLeft: '3px solid var(--accent-blue)', paddingLeft: 10, marginBottom: 12 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--fg-strong)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Assets ({assets.length})
          </span>
        </div>
        <div style={sectionShell}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg-elevated)' }}>
              <tr>
                <th style={thStyle}>Asset</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Unit / Agency</th>
                <th style={thStyle}>Contact</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Assigned To</th>
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, color: 'var(--fg-muted)', textAlign: 'center', padding: '20px' }}>
                    No assets registered yet.
                  </td>
                </tr>
              )}
              {assets.map((asset) => {
                const assignedHouseholds = reportHouseholds.filter((hh) => hh.assignedAssetId === asset.id)
                return (
                  <tr
                    key={asset.id}
                    style={{ background: 'var(--bg-surface)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)' }}
                  >
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: 'var(--fg-strong)' }}>{asset.icon} {asset.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', marginTop: 2 }}>{asset.id}</div>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--fg-muted)', fontSize: '0.78rem' }}>{asset.type}</td>
                    <td style={{ ...tdStyle, color: 'var(--fg-muted)', fontSize: '0.78rem' }}>{asset.unit}</td>
                    <td style={{ ...tdStyle, color: 'var(--fg-muted)', fontSize: '0.78rem' }}>{asset.contact}</td>
                    <td style={tdStyle}>
                      <span style={{ ...statusBadgeStyle('Pending'), ...assetStatusBadgeStyle(asset.status) }}>
                        {asset.status}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--fg-muted)', fontSize: '0.78rem' }}>
                      {assignedHouseholds.length > 0
                        ? `${assignedHouseholds.length} household${assignedHouseholds.length > 1 ? 's' : ''}`
                        : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
