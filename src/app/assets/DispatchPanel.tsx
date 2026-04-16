'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAssetStore } from '@/store/assetStore'
import { useHouseholdStore } from '@/store/householdStore'
import AssetCard from '@/components/dispatch/AssetCard'
import AddAssetForm from '@/components/dispatch/AddAssetForm'

export default function DispatchPanel() {
  const assets = useAssetStore((s) => s.assets)
  const households = useHouseholdStore((s) => s.households)
  const setPanTo = useHouseholdStore((s) => s.setPanTo)
  const setPanToCoords = useHouseholdStore((s) => s.setPanToCoords)
  const [showAddForm, setShowAddForm] = useState(false)

  const { critical } = useMemo(() => {
    const pendingList = households.filter((h) => h.status === 'Pending')
    const criticalList = pendingList.filter((h) => h.triage.level === 'CRITICAL')
    return { critical: criticalList }
  }, [households])

  useEffect(() => {
    const handler = (e: Event) => {
      const { lat, lng } = (e as CustomEvent<{ lat: number; lng: number }>).detail
      setPanToCoords({ lat, lng, zoom: 16 })
    }

    window.addEventListener('ligtas:panToAsset', handler)
    return () => window.removeEventListener('ligtas:panToAsset', handler)
  }, [setPanToCoords])

  const activeAssetsCount = assets.filter((a) => a.status === 'Active').length
  const dispatchingAssetsCount = assets.filter((a) => a.status === 'Dispatching').length

  return (
    <div className="flex flex-col">
      <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: '0.72rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Assets
        </h2>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className={showAddForm ? 'button-secondary' : 'button-success'}
          style={{
            padding: '8px 12px',
            border: showAddForm ? '1px solid var(--border)' : 'none',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {showAddForm ? 'Cancel' : '+ Add Asset'}
        </button>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: '0.76rem', color: 'var(--fg-muted)' }}>
        {activeAssetsCount} active - {dispatchingAssetsCount} dispatching
      </p>

      {showAddForm && <AddAssetForm onClose={() => setShowAddForm(false)} />}

      <div className="flex flex-col gap-2">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </div>

      {critical.length > 0 && (
        <>
          <h2 style={{ margin: '22px 0 10px', fontSize: '0.74rem', color: 'var(--fg-danger)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Critical - Awaiting Dispatch ({critical.length})
          </h2>
          {critical.map((hh) => (
            <div
              key={hh.id}
              style={{
                padding: '12px 14px',
                marginBottom: 8,
                background: 'var(--bg-surface)',
                borderRadius: 12,
                border: '1px solid var(--border)',
                borderLeft: '4px solid var(--critical-red)',
                boxShadow: 'var(--shadow-panel)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: 'var(--fg-default)', marginBottom: 2 }}>{hh.head}</div>
                <div style={{ color: 'var(--fg-muted)', fontSize: '0.75rem' }}>
                  {hh.street}, {hh.barangay}
                </div>
              </div>
              <button
                onClick={() => setPanTo(hh.id)}
                className="button-secondary"
                style={{
                  minWidth: 40,
                  padding: '8px 10px',
                  background: 'var(--bg-elevated)',
                  color: 'var(--fg-default)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                }}
              >
                Pin
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
