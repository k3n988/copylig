'use client'

import { useEffect, useState } from 'react'
import { useAssetStore } from '@/store/assetStore'
import { useHouseholdStore } from '@/store/householdStore'
import PasswordModal from '@/components/registration/PasswordModal'

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const arr = new Uint8Array(8)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((n) => chars[n % chars.length]).join('')
}

async function hashPassword(plain: string): Promise<string> {
  const encoded = new TextEncoder().encode(plain + 'LIGTAS_SALT_2025')
  const buf = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const ASSET_TYPES = ['Boat', 'Truck', 'Ambulance', 'Helicopter', 'Motorcycle', 'Van']

const ICON_OPTIONS = [
  { icon: '🚤', label: 'Boat' },
  { icon: '🛻', label: 'Truck' },
  { icon: '🚑', label: 'Ambulance' },
  { icon: '🚁', label: 'Helicopter' },
  { icon: '🏍️', label: 'Motorcycle' },
  { icon: '🚐', label: 'Van' },
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  color: 'var(--fg-default)',
  borderRadius: 10,
  boxSizing: 'border-box',
  fontSize: '0.82rem',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  marginBottom: 5,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  fontWeight: 700,
  letterSpacing: '0.05em',
}

export default function AddAssetForm({ onClose }: { onClose: () => void }) {
  const addAsset = useAssetStore((s) => s.addAsset)
  const setPickingLocation = useHouseholdStore((s) => s.setPickingLocation)
  const pendingCoords = useHouseholdStore((s) => s.pendingCoords)
  const setPendingCoords = useHouseholdStore((s) => s.setPendingCoords)

  const [name, setName] = useState('')
  const [type, setType] = useState('Boat')
  const [unit, setUnit] = useState('')
  const [icon, setIcon] = useState('🚤')
  const [contact, setContact] = useState('')
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState('')
  const [pinSource, setPinSource] = useState<'gps' | 'map' | null>(null)
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [credModal, setCredModal] = useState<{ contact: string; password: string } | null>(null)

  useEffect(() => {
    if (!pendingCoords) return
    setCoords(`${pendingCoords.lat.toFixed(6)}, ${pendingCoords.lng.toFixed(6)}`)
    setPinSource('map')
  }, [pendingCoords])

  useEffect(() => {
    return () => {
      setPendingCoords(null)
    }
  }, [setPendingCoords])

  const getGPS = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    setCoords('Locating...')
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        setCoords(`${c.latitude.toFixed(6)}, ${c.longitude.toFixed(6)}`)
        setPinSource('gps')
        setLocating(false)
      },
      () => {
        setCoords('')
        setLocating(false)
      },
    )
  }

  const sendCredentialSms = async (assetContact: string, password: string) => {
    try {
      const response = await fetch('/api/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: assetContact,
          message: `LIGTAS: Asset registration successful. Contact: ${assetContact}. Temporary password: ${password}. Account type: rescuer`,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { warning?: string; error?: string } | null

      if (!response.ok) {
        console.error('[LIGTAS] Asset SMS failed:', payload?.error ?? payload?.warning ?? response.statusText)
        setWarning(payload?.warning ?? 'Asset saved, but SMS delivery failed.')
      }
    } catch (smsError) {
      console.error('[LIGTAS] Asset SMS request failed:', smsError)
      setWarning('Asset saved, but SMS delivery failed.')
    }
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setWarning(null)
    if (!coords || coords === 'Locating...') {
      setError('Location is required.')
      return
    }
    const [lat, lng] = coords.split(',').map((n) => parseFloat(n.trim()))
    if (isNaN(lat) || isNaN(lng)) {
      setError('Invalid coordinates.')
      return
    }
    if (!contact.trim()) {
      setError('Contact number is required.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const plainPassword = generatePassword()
      const passwordHash = await hashPassword(plainPassword)

      await addAsset({
        id: 'A-' + Date.now().toString().slice(-6),
        name,
        type,
        unit,
        icon,
        contact: contact.trim(),
        address: address || undefined,
        assetPasswordHash: passwordHash,
        status: 'Active',
        lat,
        lng,
      })
      await sendCredentialSms(contact.trim(), plainPassword)
      setPendingCoords(null)
      setCredModal({ contact: contact.trim(), password: plainPassword })
    } catch {
      setError('Failed to save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '16px',
        marginBottom: 16,
        boxShadow: 'var(--shadow-panel)',
      }}
    >
      <div
        className="mobile-stack"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--fg-default)' }}>
          Add Rescue Asset
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--fg-muted)',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div
            style={{
              background: 'var(--bg-danger-subtle)',
              border: '1px solid var(--fg-danger)',
              color: 'var(--fg-danger)',
              borderRadius: 10,
              padding: '8px 12px',
              marginBottom: 12,
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {warning && (
          <div
            style={{
              background: 'rgba(240, 136, 62, 0.12)',
              border: '1px solid var(--fg-warning)',
              color: 'var(--fg-warning)',
              borderRadius: 10,
              padding: '8px 12px',
              marginBottom: 12,
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            {warning}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Asset Icon</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ICON_OPTIONS.map((opt) => (
              <button
                key={opt.icon}
                type="button"
                onClick={() => setIcon(opt.icon)}
                title={opt.label}
                style={{
                  width: 40,
                  height: 40,
                  fontSize: '1.15rem',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: icon === opt.icon ? 'var(--bg-accent-soft)' : 'var(--bg-elevated)',
                  border: `1px solid ${icon === opt.icon ? 'var(--accent-blue)' : 'var(--border)'}`,
                }}
              >
                {opt.icon}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Asset Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rescue Boat Bravo" required style={inputStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Unit / Agency</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. BFP Marine" required style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>
            Contact Number <span style={{ color: 'var(--fg-warning)' }}>(used as login username)</span>
          </label>
          <input
            value={contact}
            onChange={(e) => {
              const raw = e.target.value
              const normalized = raw.replace(/(?!^\+)[^\d]/g, '')
              setContact(normalized.startsWith('+') ? `+${normalized.slice(1).replace(/[^\d]/g, '')}` : normalized)
            }}
            placeholder="09xxxxxxxxx"
            required
            inputMode="numeric"
            pattern="^(09[0-9]{9}|\\+639[0-9]{9})$"
            title="Enter a valid PH mobile number (e.g. 09171234567)"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>
            Station Address <span style={{ color: 'var(--fg-subtle)' }}>(optional)</span>
          </label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. Brgy. Bata, Bacolod City" style={inputStyle} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Current Location</label>
            {pinSource && (
              <span
                style={{
                  fontSize: '0.68rem',
                  color: pinSource === 'map' ? 'var(--accent-blue)' : 'var(--resolved-green)',
                  fontWeight: 600,
                }}
              >
                {pinSource === 'map' ? 'Pinned on map' : 'GPS captured'}
              </span>
            )}
          </div>

          <div className="mobile-stack" style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input
              value={coords}
              onChange={(e) => {
                setCoords(e.target.value)
                setPinSource(null)
              }}
              placeholder="Lat, Lng - or use buttons"
              required
              readOnly={locating}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={getGPS}
              disabled={locating}
              className="button-secondary"
              style={{
                flexShrink: 0,
                padding: '0 12px',
                background: 'var(--bg-elevated)',
                color: 'var(--fg-default)',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              GPS
            </button>
          </div>

          <button
            type="button"
            onClick={() => setPickingLocation(true)}
            className="button-secondary"
            style={{
              width: '100%',
              padding: '10px',
              borderColor: 'var(--accent-blue)',
              color: 'var(--accent-blue)',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 700,
            }}
          >
            Pin Location on Map
          </button>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="button-success"
          style={{
            width: '100%',
            padding: '10px',
            background: saving ? 'var(--bg-elevated)' : 'var(--resolved-green)',
            color: saving ? 'var(--fg-muted)' : '#fff',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : '+ Add Asset'}
        </button>
      </form>

      {credModal && (
        <PasswordModal
          contact={credModal.contact}
          password={credModal.password}
          role="rescuer"
          onClose={() => {
            setCredModal(null)
            onClose()
          }}
        />
      )}
    </div>
  )
}
