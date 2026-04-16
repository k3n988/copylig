'use client'

import { useAssetStore } from '@/store/assetStore'

function getStatusStyle(status: string): React.CSSProperties {
  if (status === 'Active') {
    return {
      background: 'var(--success-soft)',
      color: 'var(--success-strong)',
      border: '1px solid var(--success-border)',
    }
  }

  if (status === 'Dispatching') {
    return {
      background: 'var(--warning-soft)',
      color: 'var(--warning-strong)',
      border: '1px solid var(--warning-border)',
    }
  }

  return {
    background: 'var(--bg-elevated)',
    color: 'var(--fg-muted)',
    border: '1px solid var(--border)',
  }
}

export default function AssetTable() {
  const assets = useAssetStore((s) => s.assets)
  const deleteAsset = useAssetStore((s) => s.deleteAsset)

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this asset?')) {
      deleteAsset(id)
    }
  }

  return (
    <div
      style={{
        width: '100%',
        background: 'var(--bg-surface)',
        borderRadius: 18,
        border: '1px solid var(--border)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <table style={{ width: '100%', textAlign: 'left', fontSize: '0.88rem', color: 'var(--fg-default)', borderCollapse: 'collapse' }}>
        <thead style={{ background: 'var(--bg-elevated)', fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)' }}>
          <tr>
            <th style={{ padding: '14px 16px', fontWeight: 700 }}>Asset ID</th>
            <th style={{ padding: '14px 16px', fontWeight: 700 }}>Name</th>
            <th style={{ padding: '14px 16px', fontWeight: 700 }}>Type</th>
            <th style={{ padding: '14px 16px', fontWeight: 700 }}>Unit / Agency</th>
            <th style={{ padding: '14px 16px', fontWeight: 700 }}>Status</th>
            <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assets.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--fg-muted)' }}>
                No assets registered yet.
              </td>
            </tr>
          ) : (
            assets.map((asset) => (
              <tr key={asset.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                  {asset.id.substring(0, 8)}...
                </td>
                <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--fg-strong)' }}>{asset.name}</td>
                <td style={{ padding: '14px 16px' }}>{asset.type}</td>
                <td style={{ padding: '14px 16px' }}>{asset.unit}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, ...getStatusStyle(asset.status) }}>
                    {asset.status}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <button
                    onClick={() => alert(`Edit functionality for ${asset.id} coming soon!`)}
                    style={{
                      marginRight: 8,
                      padding: '6px 12px',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent-strong)',
                      borderRadius: 999,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: '1px solid var(--accent-border)',
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(asset.id)}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--danger-soft)',
                      color: 'var(--danger-strong)',
                      borderRadius: 999,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: '1px solid var(--danger-border)',
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
