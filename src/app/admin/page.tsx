'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useHouseholdStore } from '@/store/householdStore'
import { useAssetStore } from '@/store/assetStore'
import { useHazardStore } from '@/store/hazardStore'
import { getEffectiveHouseholdTriageFromHazards, isHouseholdInAnyHazardZone } from '@/lib/geo'
import HouseholdTable from './HouseholdTable'
import AssetTable from './AssetTable'
import SummaryReportModal from '@/components/dashboard/SummaryReportModal'
import type { TriageLevel } from '@/types'

export default function AdminPage() {
  const user = useAuthStore((s) => s.user)
  const isRescuer = user?.role === 'rescuer'
  const loadHouseholds = useHouseholdStore((s) => s.loadHouseholds)
  const households = useHouseholdStore((s) => s.households)
  const assets = useAssetStore((s) => s.assets)
  const activeHazard = useHazardStore((s) => s.activeHazard)
  const activeHazards = useHazardStore((s) => s.activeHazards)
  const floodZones = useHazardStore((s) => s.floodZones)
  const router = useRouter()

  const triageOverrides = useMemo<Map<string, TriageLevel>>(() => {
    const map = new Map<string, TriageLevel>()
    if (activeHazards.length === 0) return map

    for (const hh of households) {
      if (hh.status === 'Rescued') continue
      if (!isHouseholdInAnyHazardZone(hh, activeHazards, floodZones)) continue

      const level = getEffectiveHouseholdTriageFromHazards(hh, activeHazards, floodZones)
      if (level !== hh.triage.level) map.set(hh.id, level)
    }

    return map
  }, [households, activeHazards, floodZones])

  const [activeTab, setActiveTab] = useState<'summary' | 'registry' | 'assets'>('summary')
  const setTab = (tab: 'summary' | 'registry' | 'assets') => {
    if (isRescuer && tab !== 'summary') return
    setActiveTab(tab)
  }

  useEffect(() => {
    void loadHouseholds()
  }, [loadHouseholds])

  const getTabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    background: 'transparent',
    border: 'none',
    borderBottom: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
    color: isActive ? 'var(--accent-blue)' : 'var(--fg-muted)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
  })

  const exportCSV = () => {
    let headers: string[] = []
    let rows: string[][] = []
    let filename = ''

    if (activeTab === 'registry') {
      filename = 'household_registry.csv'
      headers = ['ID', 'Household Head', 'Contact', 'Source', 'City', 'Barangay', 'Purok', 'Street', 'Structure', 'Occupants', 'Vulnerabilities', 'Triage Level', 'Status', 'Approval Status', 'Lat', 'Lng', 'Registered At']
      rows = households.map((h) => [
        h.id,
        h.head ?? '',
        h.contact ?? '',
        h.source ?? '',
        h.city ?? '',
        h.barangay ?? '',
        h.purok ?? '',
        h.street ?? '',
        h.structure ?? '',
        String(h.occupants ?? ''),
        (h.vulnArr ?? []).join('; '),
        h.triage?.level ?? '',
        h.status ?? '',
        h.approvalStatus ?? '',
        String(h.lat ?? ''),
        String(h.lng ?? ''),
        h.created_at ? new Date(h.created_at).toLocaleString() : '',
      ])
    } else {
      filename = 'asset_registry.csv'
      headers = ['ID', 'Name', 'Type', 'Unit / Agency', 'Contact', 'Address', 'Status', 'Lat', 'Lng']
      rows = assets.map((a) => [
        a.id,
        a.name ?? '',
        a.type ?? '',
        a.unit ?? '',
        a.contact ?? '',
        a.address ?? '',
        a.status ?? '',
        String(a.lat ?? ''),
        String(a.lng ?? ''),
      ])
    }

    const escape = (val: string) =>
      val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val.replace(/"/g, '""')}"` : val

    const csv = [headers.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '12px 16px 20px', color: 'var(--fg-default)' }}>
      <div className="mobile-stack" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <button
          onClick={() => router.back()}
          style={{
            marginTop: 1,
            padding: '6px 14px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--fg-default)',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Back
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--fg-default)', lineHeight: 1.1 }}>
            Household & Asset Registry
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--fg-muted)' }}>
            View, edit, or delete registered data.
          </p>
        </div>
        <button
          onClick={exportCSV}
          style={{
            marginTop: 1,
            padding: '6px 14px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--accent-blue)',
            color: 'var(--accent-blue)',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Export CSV
        </button>
      </div>

      <div className="mobile-scroll-x hide-scrollbar" style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
        <button style={getTabStyle(activeTab === 'summary')} onClick={() => setTab('summary')}>
          Summary Report
        </button>
        {!isRescuer && (
          <>
            <button style={getTabStyle(activeTab === 'registry')} onClick={() => setTab('registry')}>
              Household Registry
            </button>
            <button style={getTabStyle(activeTab === 'assets')} onClick={() => setTab('assets')}>
              Asset Registry
            </button>
          </>
        )}
      </div>

      <div style={{ minHeight: '500px' }}>
        {activeTab === 'summary' && (
          <SummaryReportModal
            households={households}
            assets={assets}
            activeHazard={activeHazard}
            activeHazards={activeHazards}
            floodZones={floodZones}
            onClose={() => isRescuer ? undefined : setActiveTab('registry')}
          />
        )}
        {activeTab === 'registry' && (
          <>
            {activeHazards.length > 0 && (
              <div
                style={{
                  background: 'var(--bg-danger-subtle)',
                  border: '1px solid var(--fg-danger)',
                  borderRadius: 6,
                  padding: '10px 16px',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--fg-danger)',
                }}
              >
                <span>Hazard Layer Active</span>
                <span style={{ color: 'var(--fg-warning)' }}>{activeHazards.map((hazard) => hazard.type).join(', ')}</span>
                <span style={{ color: 'var(--fg-muted)', fontWeight: 400 }}>
                  {` · ${triageOverrides.size} households with overridden triage`}
                  {activeHazards
                    .filter((hazard) => hazard.type !== 'Flood')
                    .map((hazard) => (
                      <span key={hazard.id}>
                        {` · ${hazard.type}: Critical <=${hazard.radii.critical}km / High <=${hazard.radii.high}km / Elevated <=${hazard.radii.elevated}km / Stable <=${hazard.radii.stable}km`}
                      </span>
                    ))}
                  {activeHazards.some((hazard) => hazard.type === 'Flood') && (
                    <>{` · ${floodZones.length} polygon zone${floodZones.length !== 1 ? 's' : ''} active`}</>
                  )}
                </span>
              </div>
            )}
            <HouseholdTable triageOverrides={triageOverrides} />
          </>
        )}
        {activeTab === 'assets' && <AssetTable />}
      </div>
    </div>
  )
}
