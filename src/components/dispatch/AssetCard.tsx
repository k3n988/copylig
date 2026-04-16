'use client'

import type { Asset } from '@/types'
import { useHouseholdStore } from '@/store/householdStore'
import { useAssetStore } from '@/store/assetStore'

interface Props {
  asset: Asset
}

const STATUS_COLOR: Record<Asset['status'], string> = {
  Active: 'var(--resolved-green)',
  Dispatching: 'var(--high-orange)',
  Standby: 'var(--text-muted)',
}

export default function AssetCard({ asset }: Props) {
  const setPanTo = useHouseholdStore((s) => s.setPanTo)
  const setSelectedId = useHouseholdStore((s) => s.setSelectedId)
  const setAssetStatus = useAssetStore((s) => s.setAssetStatus)

  const handleTrack = () => {
    void setPanTo(null)
    void setSelectedId(null)
    window.dispatchEvent(
      new CustomEvent('ligtas:panToAsset', {
        detail: { lat: asset.lat, lng: asset.lng },
      }),
    )
  }

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderLeft: '4px solid var(--accent-blue)',
        borderRadius: 12,
        padding: 15,
        marginBottom: 10,
        boxShadow: 'var(--shadow-panel)',
      }}
    >
      <div
        className="mobile-stack"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <h3 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: 'var(--fg-default)' }}>
          {asset.icon} {asset.name}
        </h3>
        <span style={{ fontSize: '0.75rem', color: STATUS_COLOR[asset.status], fontWeight: 'bold' }}>
          {asset.status}
        </span>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {asset.type} - {asset.unit}
      </p>

      <div className="mobile-stack" style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleTrack}
          className="button-secondary"
          style={{
            flex: 1,
            padding: '10px 12px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontWeight: 700,
            textTransform: 'uppercase',
            background: 'var(--bg-elevated)',
            color: 'var(--fg-default)',
          }}
        >
          Track Live
        </button>
        {asset.status !== 'Active' && (
          <button
            onClick={() => void setAssetStatus(asset.id, 'Active')}
            style={{
              flex: 1,
              padding: '10px 12px',
              fontSize: '0.75rem',
              border: '1px solid var(--resolved-green)',
              borderRadius: 10,
              cursor: 'pointer',
              fontWeight: 700,
              textTransform: 'uppercase',
              background: 'transparent',
              color: 'var(--resolved-green)',
            }}
          >
            Set Active
          </button>
        )}
      </div>
    </div>
  )
}
