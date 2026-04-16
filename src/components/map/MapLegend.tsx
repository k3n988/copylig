'use client'

export default function MapLegend() {
  return (
    <div
      className="map-legend-overlay"
      style={{
        position: 'absolute',
        bottom: 30,
        left: 12,
        zIndex: 10,
        background: 'var(--map-panel-bg)',
        padding: '12px 14px',
        border: '1px solid var(--map-panel-border)',
        borderRadius: 12,
        fontFamily: 'Inter, sans-serif',
        fontSize: '0.75rem',
        color: 'var(--fg-default)',
        boxShadow: 'var(--shadow-overlay)',
        lineHeight: 1.3,
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 24px)',
      }}
    >
      <div className="map-legend-section map-legend-section--triage">
        <div
          style={{
            fontWeight: 700,
            fontSize: '0.72rem',
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: 'var(--fg-default)',
            marginBottom: 8,
          }}
        >
          Triage Levels
        </div>

        {[
          { color: '#ff4d4d', label: 'Critical (Immobile)' },
          { color: '#ff8000', label: 'High (Limited Mob.)' },
          { color: '#f1c40f', label: 'Elevated (Vuln.)' },
          { color: '#58a6ff', label: 'Stable' },
          { color: '#238636', label: 'Rescued' },
        ].map(({ color, label }) => (
          <div
            key={label}
            className="map-legend-row"
            style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: color,
                border: '1px solid rgba(255,255,255,.3)',
                marginRight: 8,
                flexShrink: 0,
              }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
//dd