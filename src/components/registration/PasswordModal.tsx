'use client'

interface Props {
  contact: string
  password: string
  role: 'citizen' | 'rescuer'
  onClose: () => void
}

export default function PasswordModal({ contact, password, role, onClose }: Props) {
  const isCitizen = role === 'citizen'

 const config = {
  accent: isCitizen ? '#58a6ff' : '#58a6ff',
    label: isCitizen ? 'CITIZEN Login Credentials' : 'RESCUER Login Credentials',
    subtitle: isCitizen
      ? 'Give these credentials to the Citizen.'
      : 'Hand these to the Rescuers.',
    successMsg: isCitizen
      ? '✅ Citizen registered and pinned to map.'
      : '✅ Asset registered and pinned to map.',
    usernameLabel: isCitizen ? 'Username (Contact Number)' : 'Username (Contact Number)',
    passwordColor: isCitizen ? '#58a6ff' : '#58a6ff',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 10,
        padding: 28,
        width: '100%',
        maxWidth: 420,
      }}>
        <div style={{
          background: '#238636',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 20,
          fontSize: '0.82rem',
          fontWeight: 700,
          color: '#fff',
        }}>
          {config.successMsg}
        </div>

        <h3 style={{
          color: '#fff',
          fontSize: '0.95rem',
          fontWeight: 800,
          marginBottom: 6,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          borderLeft: `4px solid ${config.accent}`,
          paddingLeft: 10,
        }}>
          {config.label}
        </h3>
        <p style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: 20, paddingLeft: 14 }}>
          {config.subtitle}{' '}
          <strong style={{ color: '#f0883e' }}>Password will not be shown again.</strong>
        </p>

        <div style={{
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: 6,
          padding: '16px 18px',
          marginBottom: 20,
          fontFamily: 'monospace',
        }}>
          <div style={{ marginBottom: 14 }}>
            <span style={{ color: '#8b949e', fontSize: '0.68rem', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
              {config.usernameLabel}
            </span>
            <span style={{ color: config.accent, fontSize: '1.05rem', fontWeight: 700 }}>
              {contact}
            </span>
          </div>
          <div>
            <span style={{ color: '#8b949e', fontSize: '0.68rem', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
              Password (one-time display)
            </span>
            <span style={{ color: config.passwordColor, fontSize: '1.5rem', fontWeight: 900, letterSpacing: '0.15em' }}>
              {password}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: 13,
            background: config.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 800,
            fontSize: '0.9rem',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.03em',
          }}
        >
          ✓ DONE — I&apos;VE NOTED THE PASSWORD
        </button>
      </div>
    </div>
  )
}
