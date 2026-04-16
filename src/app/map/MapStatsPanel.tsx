'use client'

import { useState } from 'react'
import { useHouseholdStore } from '@/store/householdStore'
import { useAssetStore } from '@/store/assetStore'
import { useHazardStore } from '@/store/hazardStore'
import { TRIAGE_ORDER } from '@/lib/triage'
import SummaryReportModal from '@/components/dashboard/SummaryReportModal'
import { useMap } from 'react-leaflet'

export default function MapStatsPanel() {
  const households = useHouseholdStore((s) => s.households)
  const assets = useAssetStore((s) => s.assets)
  const activeHazard = useHazardStore((s) => s.activeHazard)
  const activeHazards = useHazardStore((s) => s.activeHazards)
  const floodZones = useHazardStore((s) => s.floodZones)
  useMap()
  const [showReport, setShowReport] = useState(false)

  const pending = households.filter((h) => h.status === 'Pending')
  const rescued = households.filter((h) => h.status === 'Rescued')

  const counts = {
    CRITICAL: pending.filter((h) => h.triage.level === 'CRITICAL').length,
    HIGH: pending.filter((h) => h.triage.level === 'HIGH').length,
    ELEVATED: pending.filter((h) => h.triage.level === 'ELEVATED').length,
    STABLE: pending.filter((h) => h.triage.level === 'STABLE').length,
  }

  const topPriority = [...pending].sort(
    (a, b) => TRIAGE_ORDER[a.triage.level] - TRIAGE_ORDER[b.triage.level],
  )

  const statCard = (label: string, value: number | string, color: string) => (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${color}`,
        borderRadius: 6,
        padding: '12px 15px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )

  return (
    <>
      <div>
        <h2
          style={{
            margin: '0 0 16px',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Operational Overview
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
          {statCard('CRITICAL', counts.CRITICAL, 'var(--critical-red)')}
          {statCard('HIGH', counts.HIGH, 'var(--high-orange)')}
          {statCard('ELEVATED', counts.ELEVATED, 'var(--elevated-yellow)')}
          {statCard('RESCUED', rescued.length, 'var(--resolved-green)')}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 20,
            padding: '10px 14px',
            background: 'var(--bg-surface)',
            borderRadius: 6,
            border: '1px solid var(--border-color)',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Registered</span>
          <span style={{ fontWeight: 700, color: 'var(--fg-default)' }}>{households.length}</span>
        </div>

        <h2
          style={{
            margin: '0 0 10px',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Active Assets
        </h2>
        <div style={{ marginBottom: 20 }}>
          {assets.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 0',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '0.82rem',
              }}
            >
              <span>{a.icon} {a.name}</span>
              <span
                style={{
                  color:
                    a.status === 'Active'
                      ? 'var(--resolved-green)'
                      : a.status === 'Dispatching'
                        ? 'var(--high-orange)'
                        : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.72rem',
                }}
              >
                {a.status}
              </span>
            </div>
          ))}
        </div>

        {topPriority.length > 0 && (
          <>
            <h2
              style={{
                margin: '0 0 10px',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Highest Priority
            </h2>
            {topPriority.slice(0, 3).map((hh) => (
              <div
                key={hh.id}
                style={{
                  padding: '10px 14px',
                  marginBottom: 8,
                  background: 'var(--bg-surface)',
                  borderRadius: 6,
                  borderLeft: `3px solid ${hh.triage.hex}`,
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--fg-default)', marginBottom: 2 }}>{hh.head}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {hh.street}, {hh.barangay}
                </div>
              </div>
            ))}
          </>
        )}

        <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
          <button
            onClick={() => setShowReport(true)}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--resolved-green)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              letterSpacing: 0.5,
            }}
          >
            Finalize and Export Report
          </button>
        </div>
      </div>

      {showReport && (
        <SummaryReportModal households={households} assets={assets} activeHazard={activeHazard} activeHazards={activeHazards} floodZones={floodZones} onClose={() => setShowReport(false)} />
      )}
    </>
  )
}
//s
