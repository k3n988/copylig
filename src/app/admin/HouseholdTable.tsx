'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { assessTriage } from '@/lib/triage'
import { buildEvacuationNote, type EvacuationNoteResult } from '@/lib/ai/advisories'
import { useHouseholdStore } from '@/store/householdStore'
import { useHazardStore } from '@/store/hazardStore'
import type { Household, RegistrySource, TriageLevel, Vulnerability } from '@/types'

const TRIAGE_COLOR: Record<string, string> = {
  CRITICAL: '#ff4d4d',
  HIGH: '#ff8000',
  ELEVATED: '#f1c40f',
  STABLE: '#58a6ff',
}

const VULN_OPTIONS: { value: Vulnerability; label: string }[] = [
  { value: 'Bedridden', label: 'Bedridden' },
  { value: 'Senior', label: 'Senior Citizen' },
  { value: 'Wheelchair', label: 'Wheelchair User' },
  { value: 'Infant', label: 'Infant / Toddler' },
  { value: 'Pregnant', label: 'Pregnant' },
  { value: 'PWD', label: 'PWD' },
  { value: 'Oxygen', label: 'Oxygen Dependent' },
  { value: 'Dialysis', label: 'Dialysis Patient' },
]

const SOURCE_OPTIONS: RegistrySource[] = [
  'Senior Citizen Registry',
  'PWD Registry',
  'Maternal Health Record',
  'CSWDO Database',
  'BHW Field Survey',
  'Self-Reported',
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg-inset)',
  border: '1px solid var(--border)',
  color: 'var(--fg-strong)',
  borderRadius: 12,
  fontFamily: 'Inter, sans-serif',
  fontSize: '0.82rem',
  boxSizing: 'border-box',
}

function formatDate(iso?: string | null): string {
  if (!iso) return '-'
  const date = new Date(iso)
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso?: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function TimestampCell({
  createdAt,
  updatedAt,
}: {
  createdAt?: string | null
  updatedAt?: string | null
}) {
  const wasEdited = updatedAt && updatedAt !== createdAt

  return (
    <td style={{ padding: '12px 14px', minWidth: 148, color: 'var(--fg-default)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: '0.62rem', color: 'var(--accent-strong)', fontWeight: 700, letterSpacing: 0.5 }}>
          CREATED
        </span>
      </div>
      <div style={{ fontSize: '0.74rem', color: 'var(--fg-default)', marginTop: 1 }}>{formatDate(createdAt)}</div>
      <div style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>{formatTime(createdAt)}</div>

      {wasEdited && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--warning-strong)', fontWeight: 700, letterSpacing: 0.5 }}>
              UPDATED
            </span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--fg-default)', marginTop: 1 }}>{formatDate(updatedAt)}</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>{formatTime(updatedAt)}</div>
        </>
      )}
    </td>
  )
}

function statusBadge(status: 'Pending' | 'Rescued'): React.CSSProperties {
  const rescued = status === 'Rescued'
  return {
    padding: '3px 8px',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 700,
    background: rescued ? 'var(--success-soft)' : 'var(--warning-soft)',
    color: rescued ? 'var(--success-strong)' : 'var(--warning-strong)',
    border: `1px solid ${rescued ? 'var(--success-border)' : 'var(--warning-border)'}`,
  }
}

function EditModal({ hh, onClose }: { hh: Household; onClose: () => void }) {
  const updateHousehold = useHouseholdStore((s) => s.updateHousehold)
  const activeHazard = useHazardStore((s) => s.activeHazard)
  const floodZones = useHazardStore((s) => s.floodZones)
  const [head, setHead] = useState(hh.head)
  const [contact, setContact] = useState(hh.contact)
  const [occupants, setOccupants] = useState(hh.occupants)
  const [notes, setNotes] = useState(hh.notes)
  const [source, setSource] = useState<RegistrySource | ''>(hh.source ?? '')
  const [status, setStatus] = useState<'Pending' | 'Rescued'>(hh.status)
  const [vulnArr, setVulnArr] = useState<Vulnerability[]>(hh.vulnArr)
  const [saving, setSaving] = useState(false)
  const [aiNote, setAiNote] = useState<EvacuationNoteResult>(() =>
    buildEvacuationNote({
      household: { ...hh, head, contact, occupants, notes, status, vulnArr },
      hazard: activeHazard,
      floodZones,
    }),
  )
  const [aiNoteLoading, setAiNoteLoading] = useState(false)

  const refreshAiNote = useCallback(
    async (currentVulnArr: Vulnerability[], currentOccupants: number) => {
      setAiNoteLoading(true)
      try {
        const res = await fetch('/api/ai/evacuation-note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            household: { ...hh, head, contact, occupants: currentOccupants, notes, status, vulnArr: currentVulnArr },
            hazard: activeHazard,
            floodZones,
          }),
        })
        if (res.ok) {
          const data = (await res.json()) as EvacuationNoteResult
          setAiNote(data)
        }
      } catch {
        // keep existing note
      } finally {
        setAiNoteLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hh, activeHazard, floodZones],
  )

  useEffect(() => {
    void refreshAiNote(vulnArr, occupants)
    // only re-run when vulnArr or occupants change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vulnArr.join(','), occupants])

  const toggleVuln = (value: Vulnerability) => {
    setVulnArr((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]))
  }

  const handleSave = async () => {
    setSaving(true)
    const triage = assessTriage(vulnArr)
    const updated_at = new Date().toISOString()
    await updateHousehold(hh.id, {
      head,
      contact,
      occupants,
      notes,
      source: (source as RegistrySource) || undefined,
      status,
      vulnArr,
      triage,
      updated_at,
    })
    setSaving(false)
    onClose()
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10, 15, 22, 0.56)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(540px, 95vw)',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          zIndex: 1001,
          fontFamily: 'Inter, sans-serif',
          color: 'var(--fg-default)',
          boxShadow: 'var(--shadow-strong)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            background: 'var(--bg-surface)',
            zIndex: 1,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: 'var(--fg-strong)', fontSize: '0.95rem' }}>Edit Household</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 2 }}>
              ID: {hh.id} &mdash; {hh.street}, Brgy. {hh.barangay}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>
                <span style={{ color: 'var(--accent-strong)', fontWeight: 700 }}>Created:</span> {formatDate(hh.created_at)} {formatTime(hh.created_at)}
              </span>
              {hh.updated_at && hh.updated_at !== hh.created_at && (
                <span style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>
                  <span style={{ color: 'var(--warning-strong)', fontWeight: 700 }}>Last edited:</span> {formatDate(hh.updated_at)} {formatTime(hh.updated_at)}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--fg-muted)', fontSize: '1.1rem', cursor: 'pointer' }}>
            x
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Household Head</label>
            <input value={head} onChange={(e) => setHead(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Contact</label>
              <input value={contact} onChange={(e) => setContact(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Occupants</label>
              <input type="number" min={1} value={occupants} onChange={(e) => setOccupants(parseInt(e.target.value, 10) || 1)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as 'Pending' | 'Rescued')} style={inputStyle}>
                <option value="Pending">Pending</option>
                <option value="Rescued">Rescued</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Source Registry</label>
              <select value={source} onChange={(e) => setSource(e.target.value as RegistrySource)} style={inputStyle}>
                <option value="">- None -</option>
                {SOURCE_OPTIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--fg-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Vulnerability Profile</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--bg-elevated)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
              {VULN_OPTIONS.map(({ value, label }) => (
                <label key={value} style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--fg-default)' }}>
                  <input type="checkbox" checked={vulnArr.includes(value)} onChange={() => toggleVuln(value)} style={{ width: 'auto', marginRight: 8 }} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ marginTop: 8, padding: 10, borderRadius: 12, background: 'var(--bg-warning-subtle)', border: '1px solid var(--warning-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--warning-strong)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  AI Evacuation Note
                </div>
                <span style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: 999, fontWeight: 700,
                  background: aiNote.source === 'gemini' ? 'var(--accent-blue)' : 'var(--bg-elevated)',
                  color: aiNote.source === 'gemini' ? '#fff' : 'var(--fg-muted)',
                }}>
                  {aiNoteLoading ? 'loading…' : aiNote.source === 'gemini' ? 'AI' : 'Rule-based'}
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--fg-default)', lineHeight: 1.5, opacity: aiNoteLoading ? 0.5 : 1 }}>
                {aiNote.note}
              </div>
              {aiNote.equipment.length > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', marginTop: 6 }}>
                  Equipment: {aiNote.equipment.join(', ')}
                </div>
              )}
              <button
                type="button"
                onClick={() => setNotes(aiNote.note)}
                style={{
                  marginTop: 8,
                  padding: '7px 12px',
                  background: 'var(--warning-strong)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Use AI Note
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1,
                padding: '10px',
                background: saving ? 'var(--bg-elevated)' : 'var(--success-strong)',
                color: saving ? 'var(--fg-muted)' : '#fff',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={onClose} style={{ padding: '10px 20px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--fg-muted)', borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function HouseholdTable({
  view = 'registry',
  triageOverrides = new Map(),
}: {
  view?: 'registry' | 'pending'
  triageOverrides?: Map<string, TriageLevel>
}) {
  const households = useHouseholdStore((s) => s.households)
  const deleteHousehold = useHouseholdStore((s) => s.deleteHousehold)
  const approveHousehold = useHouseholdStore((s) => s.approveHousehold)
  const rejectHousehold = useHouseholdStore((s) => s.rejectHousehold)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Rescued'>('All')
  const [filterCity, setFilterCity] = useState('All')
  const [filterBarangay, setFilterBarangay] = useState('All')
  const [editTarget, setEditTarget] = useState<Household | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const pendingApprovals = households.filter((hh) => hh.approvalStatus === 'pending_review')
  const approvedCount = households.filter((hh) => hh.approvalStatus === 'approved').length
  const approvedHouseholds = households.filter((hh) => hh.approvalStatus === 'approved')

  const cityOptions = useMemo(() => (
    Array.from(new Set(
      approvedHouseholds
        .map((hh) => hh.city?.trim())
        .filter((value): value is string => Boolean(value)),
    )).sort((a, b) => a.localeCompare(b))
  ), [approvedHouseholds])

  const barangayOptions = useMemo(() => (
    Array.from(new Set(
      approvedHouseholds
        .filter((hh) => filterCity === 'All' || hh.city === filterCity)
        .map((hh) => hh.barangay?.trim())
        .filter((value): value is string => Boolean(value)),
    )).sort((a, b) => a.localeCompare(b))
  ), [approvedHouseholds, filterCity])

  const filtered = approvedHouseholds
    .filter((hh) => {
      const matchStatus = filterStatus === 'All' || hh.status === filterStatus
      const matchCity = filterCity === 'All' || hh.city === filterCity
      const matchBarangay = filterBarangay === 'All' || hh.barangay === filterBarangay
      const q = search.toLowerCase()
      const matchSearch = !q || hh.head.toLowerCase().includes(q) || hh.barangay.toLowerCase().includes(q) || hh.city.toLowerCase().includes(q) || hh.id.toLowerCase().includes(q)
      return matchStatus && matchCity && matchBarangay && matchSearch
    })

  const handleApprove = async (id: string) => {
    setApprovingId(id)
    await approveHousehold(id)
    setApprovingId(null)
  }

  const handleReject = async (id: string) => {
    setApprovingId(id)
    await rejectHousehold(id)
    setApprovingId(null)
  }

  return (
    <>
      {view === 'pending' ? (
        pendingApprovals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>
            No pending submissions.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pendingApprovals.map((hh) => (
              <div key={hh.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start', boxShadow: 'var(--shadow-soft)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--fg-strong)', fontSize: '0.92rem' }}>{hh.head}</span>
                    <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, background: 'var(--warning-soft)', color: 'var(--warning-strong)', border: '1px solid var(--warning-border)' }}>
                      Self-Reported
                    </span>
                    <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: TRIAGE_COLOR[hh.triage.level] }}>{hh.triage.level}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', lineHeight: 1.6 }}>
                    <span>Brgy. {hh.barangay}, {hh.city}</span>
                    {hh.street && <span> &mdash; {hh.street}</span>}
                    <span style={{ margin: '0 8px' }}>·</span>
                    <span>{hh.contact}</span>
                    <span style={{ margin: '0 8px' }}>·</span>
                    <span>{hh.occupants} occupant{hh.occupants !== 1 ? 's' : ''}</span>
                    {hh.created_at && (
                      <>
                        <span style={{ margin: '0 8px' }}>·</span>
                        <span style={{ color: 'var(--accent-strong)' }}>Submitted {formatDate(hh.created_at)} {formatTime(hh.created_at)}</span>
                      </>
                    )}
                  </div>
                  {hh.vulnArr.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {hh.vulnArr.map((value) => (
                        <span key={value} style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.68rem', background: 'var(--bg-elevated)', color: 'var(--fg-default)', border: '1px solid var(--border)' }}>
                          {value}
                        </span>
                      ))}
                    </div>
                  )}
                  {hh.notes && <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--fg-muted)', fontStyle: 'italic' }}>&ldquo;{hh.notes}&rdquo;</div>}
                  {hh.documentUrl && (
                    <div style={{ marginTop: 8 }}>
                      <a href={hh.documentUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-strong)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        View Supporting Document
                      </a>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button onClick={() => { void handleApprove(hh.id) }} disabled={approvingId === hh.id} style={{ padding: '8px 14px', background: approvingId === hh.id ? 'var(--bg-elevated)' : 'var(--success-strong)', color: approvingId === hh.id ? 'var(--fg-muted)' : '#fff', border: 'none', borderRadius: 999, fontWeight: 700, fontSize: '0.78rem', cursor: approvingId === hh.id ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    Approve
                  </button>
                  <button onClick={() => { void handleReject(hh.id) }} disabled={approvingId === hh.id} style={{ padding: '8px 14px', background: 'var(--danger-soft)', color: 'var(--danger-strong)', border: '1px solid var(--danger-border)', borderRadius: 999, fontWeight: 700, fontSize: '0.78rem', cursor: approvingId === hh.id ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, barangay, city, or ID..." style={{ ...inputStyle, flex: 1, minWidth: 220, borderRadius: 999, background: 'var(--bg-surface)' }} />
            <select
              value={filterCity}
              onChange={(e) => {
                setFilterCity(e.target.value)
                setFilterBarangay('All')
              }}
              style={{ ...inputStyle, width: 180, borderRadius: 999, background: 'var(--bg-surface)' }}
            >
              <option value="All">All Cities</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <select
              value={filterBarangay}
              onChange={(e) => setFilterBarangay(e.target.value)}
              style={{ ...inputStyle, width: 200, borderRadius: 999, background: 'var(--bg-surface)' }}
            >
              <option value="All">All Barangays</option>
              {barangayOptions.map((barangay) => (
                <option key={barangay} value={barangay}>{barangay}</option>
              ))}
            </select>
            {(['All', 'Pending', 'Rescued'] as const).map((item) => (
              <button key={item} onClick={() => setFilterStatus(item)} style={{ padding: '8px 16px', background: filterStatus === item ? 'var(--accent-solid)' : 'var(--bg-elevated)', color: filterStatus === item ? '#fff' : 'var(--fg-default)', border: `1px solid ${filterStatus === item ? 'var(--accent-solid)' : 'var(--border)'}`, borderRadius: 999, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                {item}
              </button>
            ))}
            <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginLeft: 'auto' }}>{filtered.length} of {approvedCount} households</span>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 18, border: '1px solid var(--border)', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-soft)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 980 }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', color: 'var(--fg-muted)', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: 0.8 }}>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>ID</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>Household Head</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>Location</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>Triage</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>Source</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>Timestamps</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--fg-muted)' }}>No households found.</td>
                  </tr>
                )}
                {filtered.map((hh) => (
                  <tr key={hh.id} style={{ borderTop: '1px solid var(--border-subtle)', background: confirmId === hh.id ? 'var(--danger-soft)' : 'transparent', transition: 'background 0.15s' }}>
                    <td style={{ padding: '12px 14px', color: 'var(--fg-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{hh.id}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--fg-strong)' }}>{hh.head}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 2 }}>{hh.contact} &mdash; {hh.occupants} occ.</div>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--fg-default)' }}>
                      <div>Brgy. {hh.barangay}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>{hh.city}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {(() => {
                        const override = triageOverrides.get(hh.id)
                        const level = override ?? hh.triage.level
                        return (
                          <>
                            <span style={{ color: TRIAGE_COLOR[level], fontWeight: 700, fontSize: '0.75rem' }}>{level}</span>
                            {override && override !== hh.triage.level && (
                              <span title={`Original: ${hh.triage.level}`} style={{ marginLeft: 5, fontSize: '0.6rem', fontWeight: 700, color: 'var(--warning-strong)', background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: 999, padding: '1px 6px', verticalAlign: 'middle' }}>
                                HAZARD
                              </span>
                            )}
                          </>
                        )
                      })()}
                      {hh.vulnArr.length > 0 && <div style={{ fontSize: '0.68rem', color: 'var(--fg-muted)', marginTop: 2 }}>{hh.vulnArr.join(', ')}</div>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={statusBadge(hh.status)}>{hh.status}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--fg-muted)', fontSize: '0.75rem' }}>{hh.source ?? '-'}</td>
                    <TimestampCell createdAt={hh.created_at} updatedAt={hh.updated_at} />
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {confirmId === hh.id ? (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--danger-strong)', fontWeight: 600 }}>Delete?</span>
                          <button onClick={() => { void deleteHousehold(hh.id); setConfirmId(null) }} style={{ padding: '4px 10px', background: 'var(--danger-strong)', color: '#fff', border: 'none', borderRadius: 999, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                            Yes
                          </button>
                          <button onClick={() => setConfirmId(null)} style={{ padding: '4px 10px', background: 'var(--bg-elevated)', color: 'var(--fg-muted)', border: '1px solid var(--border)', borderRadius: 999, cursor: 'pointer', fontSize: '0.72rem' }}>
                            No
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button onClick={() => setEditTarget(hh)} style={{ padding: '5px 12px', background: 'var(--accent-soft)', color: 'var(--accent-strong)', border: '1px solid var(--accent-border)', borderRadius: 999, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                            Edit
                          </button>
                          <button onClick={() => setConfirmId(hh.id)} style={{ padding: '5px 12px', background: 'var(--danger-soft)', color: 'var(--danger-strong)', border: '1px solid var(--danger-border)', borderRadius: 999, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editTarget && <EditModal hh={editTarget} onClose={() => setEditTarget(null)} />}
    </>
  )
}
