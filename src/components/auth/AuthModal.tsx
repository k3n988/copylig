'use client'
// src/components/auth/AuthModal.tsx

import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'

interface Props {
  onClose: () => void
}

export default function AuthModal({ onClose }: Props) {
  const { login, loading } = useAuthStore()

  const [contact, setContact] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    const err = await login(contact.trim(), password)
    if (err) {
      setError(err)
    } else {
      onClose()
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg-inset)',
    border: '1px solid var(--border)',
    color: 'var(--fg-default)',
    borderRadius: 4,
    fontSize: '0.85rem',
    fontFamily: 'Inter, monospace',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.7rem',
    color: 'var(--fg-muted)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 5,
  }

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-overlay)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          width: 'min(360px, calc(100vw - 24px))',
          padding: 28,
          fontFamily: 'Inter, monospace',
          color: 'var(--fg-default)',
          boxShadow: 'var(--shadow-overlay)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--accent-blue)', letterSpacing: 2 }}>
            L.I.G.T.A.S. SYSTEM
          </p>
          <h2 style={{ margin: '4px 0 0', fontSize: '1rem', color: 'var(--fg-default)', letterSpacing: 1 }}>
            Sign In
          </h2>
        </div>

        {/* Info blurb — updated to mention all 3 roles */}
        <p style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', margin: '0 0 18px', lineHeight: 1.6 }}>
          Use your <strong style={{ color: 'var(--fg-default)' }}>email</strong> if you are an LGU admin.
          Use your <strong style={{ color: 'var(--fg-default)' }}>contact number</strong> and the password
          provided by LGU if you are a registered household member or a rescuer.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Email or Contact Number</label>
            <input
              type="text"
              placeholder="admin@lgu.gov or 09XX-XXX-XXXX"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
              style={inputStyle}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--fg-danger)',
                margin: 0,
                padding: '8px 10px',
                background: 'var(--bg-danger-subtle)',
                border: '1px solid color-mix(in srgb, var(--fg-danger) 35%, var(--border))',
                borderRadius: 4,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '11px',
              background: loading ? 'var(--bg-elevated)' : 'var(--accent-blue)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: '0.8rem',
              fontWeight: 700,
              letterSpacing: 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 4,
            }}
          >
            {loading ? 'Please wait…' : 'LOG IN'}
          </button>
        </form>

        <button
          onClick={onClose}
          style={{
            display: 'block',
            marginTop: 16,
            width: '100%',
            padding: '8px',
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--fg-muted)',
            borderRadius: 4,
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
