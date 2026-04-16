'use client'

import { useEffect, useRef, useState } from 'react'
import { useHazardStore } from '@/store/hazardStore'
import { useAuthStore } from '@/store/authStore'
import { useHouseholdStore } from '@/store/householdStore'
import type { PublicAdvisoryResult } from '@/lib/ai/advisories'
import type { Household } from '@/types'

export default function CitizenPanel() {
  const user = useAuthStore((s) => s.user)
  const households = useHouseholdStore((s) => s.households)
  const markRescued = useHouseholdStore((s) => s.markRescued)
  const restorePending = useHouseholdStore((s) => s.restorePending)
  const setPanToCoords = useHouseholdStore((s) => s.setPanToCoords)
  const activeHazards = useHazardStore((s) => s.activeHazards)

  const [confirming, setConfirming] = useState<'safe' | 'cancel' | null>(null)
  const [busy, setBusy] = useState(false)
  const [aiAdvisory, setAiAdvisory] = useState<PublicAdvisoryResult | null>(null)
  const pannedRef = useRef(false)

  const household: Household | undefined = households.find(
    (hh) => hh.contact === user?.contact,
  )

  // Auto-focus map to citizen's household location on first load
  useEffect(() => {
    if (!household || pannedRef.current) return
    pannedRef.current = true
    setPanToCoords({ lat: household.lat, lng: household.lng, zoom: 17 })
  }, [household, setPanToCoords])

  // Load AI advisory for the most critical active hazard
  useEffect(() => {
    if (!household || activeHazards.length === 0) {
      setAiAdvisory(null)
      return
    }

    const controller = new AbortController()
    const hh = household
    const hazard = activeHazards[0]

    async function loadAdvisory() {
      try {
        const response = await fetch('/api/ai/public-advisory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city: hh.city,
            barangay: hh.barangay,
            coords: { lat: hh.lat, lng: hh.lng },
            hazard,
            vulnerabilities: hh.vulnArr,
          }),
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Failed')
        setAiAdvisory((await response.json()) as PublicAdvisoryResult)
      } catch {
        if (!controller.signal.aborted) setAiAdvisory(null)
      }
    }

    void loadAdvisory()
    return () => controller.abort()
  }, [activeHazards, household])

  async function handleSafe() {
    if (!household) return
    setBusy(true)
    await markRescued(household.id)
    setBusy(false)
    setConfirming(null)
  }

  async function handleCancel() {
    if (!household) return
    setBusy(true)
    await restorePending(household.id)
    setBusy(false)
    setConfirming(null)
  }

  const effectiveConfirming =
    household?.status === 'Pending'
      ? (confirming === 'cancel' ? null : confirming)
      : household?.status === 'Rescued'
        ? (confirming === 'safe' ? null : confirming)
        : null

  const isPending = household?.status === 'Pending'
  const isRescued = household?.status === 'Rescued'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Active Disaster Warnings — one card per active hazard */}
      {activeHazards.map((hazard) => (
        <div
          key={hazard.id}
          style={{
            background: 'var(--bg-danger-subtle)',
            border: '1px solid var(--fg-danger)',
            borderRadius: 8,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <span style={{ fontSize: '0.6rem', color: 'var(--fg-danger)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 800 }}>
            Active Disaster Warning
          </span>
          <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--fg-danger)', textTransform: 'uppercase', letterSpacing: 1 }}>
            {hazard.type}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--fg-default)', lineHeight: 1.5, opacity: 0.85 }}>
            A <b>{hazard.type.toLowerCase()}</b> hazard zone is currently active. Stay alert and follow local DRRMO advisories.
          </span>
        </div>
      ))}

      {/* AI Safety Advisory */}
      {aiAdvisory && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--accent-blue)',
            borderRadius: 8,
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--accent-blue)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 800 }}>
              AI Safety Advisory
            </span>
            <span style={{
              fontSize: '0.58rem', padding: '1px 5px', borderRadius: 999, fontWeight: 700,
              background: aiAdvisory.source === 'gemini' ? 'var(--accent-blue)' : 'var(--bg-elevated)',
              color: aiAdvisory.source === 'gemini' ? '#fff' : 'var(--fg-muted)',
            }}>
              {aiAdvisory.source === 'gemini' ? 'AI' : 'Rule-based'}
            </span>
          </div>
          <p style={{ margin: '0 0 5px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--fg-default)' }}>
            {aiAdvisory.title}
          </p>
          <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
            {aiAdvisory.summary}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {aiAdvisory.actions.map((action) => (
              <div
                key={action}
                style={{
                  padding: '7px 10px',
                  borderRadius: 6,
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border)',
                  fontSize: '0.74rem',
                  color: 'var(--fg-default)',
                  lineHeight: 1.4,
                }}
              >
                · {action}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rescue Status Card */}
      {household && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>

          {/* Status Header */}
          <div style={{
            padding: '14px 16px',
            background: isPending ? 'var(--bg-warning-subtle)' : 'var(--bg-success-subtle)',
            borderBottom: '1px solid var(--border)',
          }}>
            <p style={{ margin: '0 0 3px', fontSize: '0.6rem', color: 'var(--fg-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>
              Rescue Status
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 3px' }}>
              <span style={{ color: isPending ? 'var(--fg-warning)' : 'var(--fg-success)', display: 'flex' }}>
                {isPending ? <ClockIcon /> : <CheckCircleIcon />}
              </span>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: isPending ? 'var(--fg-warning)' : 'var(--fg-success)' }}>
                {isPending ? 'Queued — Awaiting Rescue' : 'Marked as Rescued'}
              </p>
            </div>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
              {isPending
                ? 'Your request has been received. Rescuers have been notified.'
                : 'You have been marked as rescued. Stay safe!'}
            </p>

            {isPending && (
              <div
                style={{
                  marginTop: 10,
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 20,
                  background: `${household.triage.hex}22`,
                  border: `1px solid ${household.triage.hex}`,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: household.triage.hex,
                  letterSpacing: 1,
                }}
              >
                {household.triage.level} PRIORITY
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ padding: 14 }}>
            {isPending && (
              effectiveConfirming === 'safe' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--fg-success)', fontWeight: 600 }}>
                    Confirm you are safe?
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleSafe}
                      disabled={busy}
                      style={{ flex: 1, padding: '10px', background: 'var(--resolved-green)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.8rem', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}
                    >
                      {busy ? 'Saving...' : 'Yes, I am Safe'}
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      disabled={busy}
                      style={{ flex: 1, padding: '10px', background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border)', borderRadius: 6, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      Go Back
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming('safe')}
                  style={{ width: '100%', padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--bg-success-subtle)', color: 'var(--fg-success)', border: '1px solid var(--fg-success)', borderRadius: 6, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', letterSpacing: 1 }}
                >
                  <CheckCircleIcon size={18} /> I AM SAFE
                </button>
              )
            )}

            {isRescued && (
              effectiveConfirming === 'cancel' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--fg-danger)', fontWeight: 600 }}>
                    Re-submit your rescue request?
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleCancel}
                      disabled={busy}
                      style={{ flex: 1, padding: '10px', background: 'var(--critical-red)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.8rem', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}
                    >
                      {busy ? 'Saving...' : 'Yes, I Need Help'}
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      disabled={busy}
                      style={{ flex: 1, padding: '10px', background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border)', borderRadius: 6, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      Go Back
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ margin: '0 0 10px', fontSize: '0.74rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                    If your situation has changed and you still need rescue, tap below to re-submit your request.
                  </p>
                  <button
                    onClick={() => setConfirming('cancel')}
                    style={{ width: '100%', padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', color: 'var(--fg-warning)', border: '1px solid var(--fg-warning)', borderRadius: 6, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', letterSpacing: 1 }}
                  >
                    <AlertTriangleIcon size={18} /> RE-SUBMIT REQUEST
                  </button>
                </>
              )
            )}
          </div>
        </div>
      )}

      {/* Registration Details */}
      {household && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
          <p style={{ margin: '0 0 10px', fontSize: '0.6rem', color: 'var(--fg-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>
            Your Registration
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[
              { label: 'ID', value: household.id },
              { label: 'Head', value: household.head },
              { label: 'Occupants', value: String(household.occupants) },
              { label: 'Address', value: [household.street, household.barangay, household.city].filter(Boolean).join(', ') },
              { label: 'Registered', value: household.created_at ? new Date(household.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : '-' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', gap: 8 }}>
                <span style={{ color: 'var(--fg-muted)', flexShrink: 0 }}>{label}</span>
                <span style={{ color: 'var(--fg-default)', textAlign: 'right' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Locate on Map button */}
          <button
            onClick={() => setPanToCoords({ lat: household.lat, lng: household.lng, zoom: 17 })}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '9px',
              background: 'var(--bg-inset)',
              border: '1px solid var(--accent-blue)',
              color: 'var(--accent-blue)',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            Locate My Home on Map
          </button>
        </div>
      )}

      {/* Not registered message */}
      {!household && (
        <div style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: 8, padding: '24px 16px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fg-muted)', fontWeight: 500 }}>
            No registration found for your account.
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--fg-subtle)' }}>
            Contact your local DRRMO to register your household.
          </p>
        </div>
      )}
    </div>
  )
}

function ClockIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function CheckCircleIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function AlertTriangleIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
