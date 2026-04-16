'use client'

import { useEffect, useRef, useState } from 'react'
import { useHouseholdStore } from '@/store/householdStore'
import { assessTriage } from '@/lib/triage'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { supabase } from '@/lib/supabase'
import type { RegistrySource, Vulnerability } from '@/types'
import TriagePreview from './TriagePreview'
import PasswordModal from './PasswordModal'

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

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const SOURCE_OPTIONS: { value: RegistrySource; label: string }[] = [
  { value: 'Senior Citizen Registry', label: 'Senior Citizen Registry (OSCA)' },
  { value: 'PWD Registry', label: 'PWD Registry (CPDAO)' },
  { value: 'Maternal Health Record', label: 'Maternal Health Record (RHU/BHW)' },
  { value: 'CSWDO Database', label: 'CSWDO Database' },
  { value: 'BHW Field Survey', label: 'BHW Field Survey / Community Round' },
]

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

const CITY_BARANGAY_MAP: Record<string, string[]> = {
  'Bacolod City': [
    'Alangilan', 'Alijis', 'Banago', 'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5',
    'Barangay 6', 'Barangay 7', 'Barangay 8', 'Barangay 9', 'Barangay 10', 'Barangay 11', 'Barangay 12',
    'Barangay 13', 'Barangay 14', 'Barangay 15', 'Barangay 16', 'Barangay 17', 'Barangay 18', 'Barangay 19',
    'Barangay 20', 'Barangay 21', 'Barangay 22', 'Barangay 23', 'Barangay 24', 'Barangay 25', 'Barangay 26',
    'Barangay 27', 'Barangay 28', 'Barangay 29', 'Barangay 30', 'Barangay 31', 'Barangay 32', 'Barangay 33',
    'Barangay 34', 'Barangay 35', 'Barangay 36', 'Barangay 37', 'Barangay 38', 'Barangay 39', 'Barangay 40',
    'Barangay 41', 'Bata', 'Cabug', 'Estefania', 'Felisa', 'Granada', 'Handumanan', 'Mandalagan',
    'Mansilingan', 'Montevista', 'Pahanocoy', 'Punta Taytay', 'Singcang-Airport', 'Sum-ag', 'Taculing',
    'Tangub', 'Villamonte', 'Vista Alegre',
  ],
  'Bago City': [
    'Abuanan', 'Alianza', 'Atipuluan', 'Bacong', 'Bagroy', 'Balingasag', 'Binubuhan', 'Busay', 'Calumangan',
    'Caridad', 'Don Jorge L. Araneta', 'Dulao', 'Ilijan', 'Lag-asan', 'Ma-ao Barrio', 'Mailum', 'Malingin',
    'Napoles', 'Pacol', 'Poblacion', 'Sagasa', 'Sampinit', 'Tabunan', 'Taloc',
  ],
  'Cadiz City': ['Andres Bonifacio', 'Burgos', 'Cabahug', 'Cadiz Viejo', 'Caduha-an', 'Celestino Villacin', 'Daga', 'Jerusalem', 'Luna', 'Mabini', 'Magsaysay', 'Sicaba', 'Tiglawigan', 'Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6'],
  'Murcia': ['Abejuvela', 'Amaya', 'Anahaw', 'Buenavista', 'Caliban', 'Canlandog', 'Cansilayan', 'Damsite', 'Iglau-an', 'Lopez Jaena', 'Minoyan', 'Pandanon', 'Salvacion', 'San Miguel', 'Santa Cruz', 'Santa Rosa', 'Talotog', 'Zone I', 'Zone II', 'Zone III', 'Zone IV', 'Zone V'],
  'La Carlota City': ['Ara-al', 'Ayungon', 'Balabag', 'Barangay I', 'Barangay II', 'Barangay III', 'Batuan', 'Cubay', 'Haguimit', 'La Granja', 'Nagasi', 'Roberto S. Benedicto', 'San Miguel', 'Yubo'],
  'Canlaon City': ['Bayog', 'Binalbagan', 'Bucalan', 'Budlasan', 'Linothangan', 'Lumapao', 'Mabigo', 'Malaiba', 'Masulog', 'Ninoy Aquino', 'Panubigan', 'Pula'],
  'Sagay City': ['Bato', 'Baviera', 'Bulanon', 'Campo Himoga-an', 'Campo Santiago', 'Colonia Divina', 'Fabrica', 'General Luna', 'Himoga-an Baybay', 'Lopez Jaena', 'Malubon', 'Molocaboc', 'Old Sagay', 'Plaridel', 'Poblacion I', 'Poblacion II', 'Rizal', 'Sewane', 'Taba-ao', 'Tadlong', 'Vito'],
  'Silay City': ['Bagtic', 'Balaring', 'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Barangay V', 'Guimbala-on', 'Guinhalaran', 'Kapitan Ramon', 'Lantad', 'Mambulac', 'Patag', 'Rizal'],
  'Talisay City': ['Bubog', 'Cabacungan', 'Concepcion', 'Dos Hermanas', 'Efigenio Lizares', 'Katubhan', 'Matab-ang', 'Poblacion', 'San Fernando', 'Tanza', 'Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 4-A', 'Zone 5', 'Zone 6', 'Zone 7', 'Zone 8', 'Zone 9', 'Zone 10', 'Zone 11', 'Zone 12', 'Zone 12-A', 'Zone 14', 'Zone 14-A', 'Zone 14-B', 'Zone 15', 'Zone 16'],
  'Victorias City': ['Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Barangay V', 'Barangay VI', 'Barangay VII', 'Barangay VIII', 'Barangay IX', 'Barangay X', 'Barangay XI', 'Barangay XII', 'Barangay XIII', 'Barangay XIV', 'Barangay XV', 'Barangay XVI', 'Barangay XVII', 'Barangay XVIII', 'Barangay XIX', 'Barangay XX', 'Barangay XXI'],
}

const CITY_OPTIONS = Object.keys(CITY_BARANGAY_MAP).sort()

function resolveMapKey(cityVal: string): string | null {
  if (!cityVal) return null
  const normalized = cityVal.trim().toLowerCase()
  if (CITY_BARANGAY_MAP[cityVal]) return cityVal

  const exactCI = Object.keys(CITY_BARANGAY_MAP).find((k) => k.toLowerCase() === normalized)
  if (exactCI) return exactCI

  const withCity = normalized.endsWith(' city') ? normalized : normalized + ' city'
  const cityMatch = Object.keys(CITY_BARANGAY_MAP).find((k) => k.toLowerCase() === withCity)
  if (cityMatch) return cityMatch

  const withoutCity = normalized.replace(/ city$/, '').trim()
  const reverseMatch = Object.keys(CITY_BARANGAY_MAP).find(
    (k) => k.toLowerCase().replace(/ city$/, '') === withoutCity,
  )
  if (reverseMatch) return reverseMatch

  return null
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  color: 'var(--fg-default)',
  borderRadius: 10,
  boxSizing: 'border-box',
  fontSize: '0.85rem',
  lineHeight: 1.35,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  marginBottom: 7,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  fontWeight: 700,
  letterSpacing: '0.06em',
}

const subHeaderStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 800,
  color: 'var(--fg-default)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  marginBottom: 14,
  borderLeft: '4px solid var(--accent-blue)',
  paddingLeft: 12,
}

export default function RegistrationForm() {
  const addHousehold = useHouseholdStore((s) => s.addHousehold)
  const households = useHouseholdStore((s) => s.households)
  const setPickingLocation = useHouseholdStore((s) => s.setPickingLocation)
  const pendingCoords = useHouseholdStore((s) => s.pendingCoords)
  const setPendingCoords = useHouseholdStore((s) => s.setPendingCoords)

  const geocodingLib = useMapsLibrary('geocoding')
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [coordsDisplay, setCoordsDisplay] = useState('')
  const [locating] = useState(false)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [pinSource, setPinSource] = useState<'gps' | 'map' | null>(null)

  const [geocoding, setGeocoding] = useState(false)
  const [cityVal, setCityVal] = useState('')
  const [barangayVal, setBarangayVal] = useState('')
  const [streetVal, setStreetVal] = useState('')

  const [vulnArr, setVulnArr] = useState<Vulnerability[]>([])
  const [sourceVal, setSourceVal] = useState<RegistrySource | ''>('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveWarning, setSaveWarning] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [credModal, setCredModal] = useState<{ contact: string; password: string } | null>(null)

  useEffect(() => {
    if (geocodingLib && !geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder()
    }
  }, [geocodingLib])

  const detectCity = (pLat: number, pLng: number, fillStreet = false) => {
    if (!geocoderRef.current) return
    setGeocoding(true)

    geocoderRef.current.geocode({ location: { lat: pLat, lng: pLng } }, (results, status) => {
      setGeocoding(false)
      if (status !== 'OK' || !results?.length) return

      const comps = results[0].address_components
      const cityComp =
        comps.find((c) => c.types.includes('locality')) ||
        comps.find((c) => c.types.includes('administrative_area_level_3')) ||
        comps.find((c) => c.types.includes('administrative_area_level_2')) ||
        comps.find((c) => c.types.includes('administrative_area_level_1'))

      const rawCity = cityComp?.long_name?.trim() ?? ''
      let resolved = resolveMapKey(rawCity)
      if (!resolved) resolved = resolveMapKey(rawCity + ' City')

      if (resolved) {
        setCityVal(resolved)
        setBarangayVal('')
      }

      if (fillStreet) {
        const formattedParts = results[0].formatted_address?.split(',') ?? []
        const streetParts = formattedParts.slice(0, -3).map((p) => p.trim()).filter(Boolean)
        const street = streetParts.join(', ')
        if (street) setStreetVal(street)
      }
    })
  }

  useEffect(() => {
    if (!pendingCoords) return
    setLat(pendingCoords.lat)
    setLng(pendingCoords.lng)
    setCoordsDisplay(`${pendingCoords.lat.toFixed(6)}, ${pendingCoords.lng.toFixed(6)}`)
    setPinSource('map')
    setGpsAccuracy(null)
    detectCity(pendingCoords.lat, pendingCoords.lng)
  }, [pendingCoords]) // eslint-disable-line react-hooks/exhaustive-deps

  const triage = assessTriage(vulnArr)
  const resolvedCityKey = resolveMapKey(cityVal)

  const toggleVuln = (v: Vulnerability) => {
    setVulnArr((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))
  }

  const fullAddressPreview = [streetVal, barangayVal, cityVal, 'Negros Occidental']
    .filter(Boolean)
    .join(', ')

  const resetForm = () => {
    formRef.current?.reset()
    setVulnArr([])
    setLat(null)
    setLng(null)
    setCoordsDisplay('')
    setPinSource(null)
    setGpsAccuracy(null)
    setPendingCoords(null)
    setSourceVal('')
    setCityVal('')
    setBarangayVal('')
    setStreetVal('')
    setSaveError(null)
  }

  const sendCredentialSms = async (contact: string, password: string) => {
    try {
      const response = await fetch('/api/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: contact,
          message: `LIGTAS: Registration successful. Contact: ${contact}. Temporary password: ${password}. Account type: citizen`,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { warning?: string; error?: string } | null

      if (!response.ok) {
        console.error('[LIGTAS] Household SMS failed:', payload?.error ?? payload?.warning ?? response.statusText)
        setSaveWarning(payload?.warning ?? 'Registration saved, but SMS delivery failed.')
      }
    } catch (error) {
      console.error('[LIGTAS] Household SMS request failed:', error)
      setSaveWarning('Registration saved, but SMS delivery failed.')
    }
  }

  const detectDuplicate = (contact: string, pLat: number, pLng: number) => {
    for (const hh of households) {
      if (hh.contact === contact) {
        return { isDuplicate: true, reason: `Contact ${contact} already registered (${hh.id}).` }
      }
      if (haversineMeters(pLat, pLng, hh.lat, hh.lng) <= 10) {
        return { isDuplicate: true, reason: `Household within 10 m already exists (${hh.id} - ${hh.head}).` }
      }
    }
    return { isDuplicate: false, reason: '' }
  }

  useEffect(() => {
    if (!saveSuccess) return
    const t = setTimeout(() => setSaveSuccess(null), 5000)
    return () => clearTimeout(t)
  }, [saveSuccess])

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaveError(null)
    setSaveWarning(null)
    setSaveSuccess(null)

    if (!pinSource) {
      setSaveError('Please pin a location using GPS or the map before submitting.')
      return
    }
    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
      setSaveError('Invalid coordinates. Please re-pin the location.')
      return
    }
    if (!barangayVal.trim()) {
      setSaveError('Please select a barangay.')
      return
    }

    const form = e.currentTarget
    const fd = new FormData(form)
    const source = fd.get('source') as RegistrySource
    const contactVal = (fd.get('contact') as string).trim()
    const id = 'HH-' + Date.now().toString().slice(-6)

    const fullAddress = [streetVal, barangayVal, cityVal, 'Negros Occidental']
      .filter(Boolean)
      .join(', ')

    const { isDuplicate, reason } = detectDuplicate(contactVal, lat, lng)
    if (isDuplicate) {
      setSaveError(`Duplicate detected - ${reason}`)
      return
    }

    setSaving(true)
    try {
      let documentUrl: string | undefined
      const file = fileRef.current?.files?.[0]
      if (source === 'Self-Reported' && file) {
        const { data: up, error: ue } = await supabase.storage
          .from('verification-docs')
          .upload(`${id}/${file.name}`, file, { upsert: true })
        if (ue) throw ue
        const { data: ud } = supabase.storage.from('verification-docs').getPublicUrl(up.path)
        documentUrl = ud.publicUrl
      }

      const plainPassword = generatePassword()
      const passwordHash = await hashPassword(plainPassword)

      await addHousehold({
        id,
        lat,
        lng,
        city: cityVal,
        barangay: barangayVal,
        purok: (fd.get('purok') as string) || 'N/A',
        street: streetVal,
        fullAddress,
        structure: 'N/A',
        head: fd.get('head') as string,
        contact: contactVal,
        occupants: parseInt(fd.get('occupants') as string, 10),
        vulnArr,
        notes: (fd.get('notes') as string) || '',
        source,
        status: 'Pending',
        triage,
        approvalStatus: source === 'Self-Reported' ? 'pending_review' : 'approved',
        documentUrl,
        citizenPasswordHash: passwordHash,
        gpsAccuracy: gpsAccuracy ?? undefined,
        pinSource: pinSource ?? undefined,
      })

      const headName = fd.get('head') as string
      await sendCredentialSms(contactVal, plainPassword)
      resetForm()
      setSaveSuccess(`"${headName}" has been registered and pinned to the vulnerability map.`)
    } catch (err) {
      console.error('[LIGTAS] handleSubmit:', err)
      setSaveError('Failed to save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="sidebar-hero" style={{ marginBottom: 20, fontSize: '0.75rem', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--fg-default)', display: 'block', marginBottom: 4, fontSize: '0.88rem' }}>
            LGU Vulnerability Registry - Authorized Personnel Only
          </strong>
          <span style={{ color: 'var(--fg-muted)' }}>
            For use by Barangay Health Workers, CSWDO, and LGU field staff to digitize existing registries before disasters.
          </span>
        </div>

        <div className="sidebar-form-section" style={{ marginBottom: 20 }}>
          <h3 style={subHeaderStyle}>1. Rescue Location</h3>

          <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Latitude, Longitude</label>
            {pinSource && (
              <span style={{ fontSize: '0.68rem', color: pinSource === 'map' ? 'var(--accent-blue)' : 'var(--resolved-green)', fontWeight: 700 }}>
                {pinSource === 'map' ? 'Pinned on map' : 'GPS captured'}
                {gpsAccuracy !== null && ` · ±${gpsAccuracy} m`}
              </span>
            )}
          </div>

          <div className="sidebar-form-grid" style={{ marginBottom: 12 }}>
            <input
              style={{ ...inputStyle, color: pinSource ? 'var(--accent-blue)' : 'var(--fg-default)', fontVariantNumeric: 'tabular-nums' }}
              type="text"
              value={coordsDisplay}
              onChange={(e) => {
                const raw = e.target.value
                setCoordsDisplay(raw)
                setPinSource(null)
                setPendingCoords(null)
                setGpsAccuracy(null)
                const parts = raw.split(',').map((n) => parseFloat(n.trim()))
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                  setLat(parts[0])
                  setLng(parts[1])
                } else {
                  setLat(null)
                  setLng(null)
                }
              }}
              placeholder="e.g. 10.676553, 122.954105"
              required
              readOnly={locating}
            />

            <button
              type="button"
              onClick={() => setPickingLocation(true)}
              className="button-secondary"
              style={{ width: '100%', padding: '12px 14px', color: 'var(--accent-blue)', borderColor: 'var(--accent-blue)', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 800 }}
            >
              Manually Adjust Pin
            </button>
          </div>

          {geocoding && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-blue)', fontSize: '0.78rem', marginBottom: 10, fontWeight: 600 }}>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span>
              Detecting city...
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>
                City
                {geocoding ? (
                  <span style={{ marginLeft: 6, fontSize: '0.65rem', color: 'var(--accent-blue)', fontWeight: 500, textTransform: 'none' }}>detecting...</span>
                ) : cityVal ? (
                  <span style={{ marginLeft: 6, fontSize: '0.65rem', color: 'var(--resolved-green)', fontWeight: 700, textTransform: 'none' }}>auto-filled</span>
                ) : null}
              </label>
              <select
                name="city"
                required
                style={inputStyle}
                value={cityVal}
                onChange={(e) => {
                  setCityVal(e.target.value)
                  setBarangayVal('')
                }}
              >
                <option value="" disabled>
                  Select City
                </option>
                {CITY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                Barangay
                <span style={{ marginLeft: 6, fontSize: '0.65rem', color: 'var(--fg-warning)', fontWeight: 700, textTransform: 'none' }}>manual</span>
              </label>
              <select
                name="barangay"
                required
                style={inputStyle}
                value={barangayVal}
                onChange={(e) => setBarangayVal(e.target.value)}
              >
                <option value="" disabled>
                  Select Barangay
                </option>
                {resolvedCityKey
                  ? CITY_BARANGAY_MAP[resolvedCityKey].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))
                  : Object.entries(CITY_BARANGAY_MAP)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([city, bgs]) => (
                        <optgroup key={city} label={city}>
                          {bgs.map((b) => (
                            <option key={`${city}-${b}`} value={b}>
                              {b}
                            </option>
                          ))}
                        </optgroup>
                      ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Street / Landmark</label>
            <input
              name="street"
              type="text"
              placeholder="House #, street, or landmark"
              required
              style={inputStyle}
              value={streetVal}
              onChange={(e) => setStreetVal(e.target.value)}
            />
          </div>

          {(streetVal || barangayVal || cityVal) && !geocoding && (
            <div style={{ padding: '10px 12px', background: 'var(--bg-accent-soft)', border: '1px dashed var(--border)', borderRadius: 10, fontSize: '0.75rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--accent-blue)', fontWeight: 700, marginRight: 6 }}>Address:</span>
              {fullAddressPreview}
            </div>
          )}
        </div>

        <div className="sidebar-form-section" style={{ marginBottom: 25 }}>
          <h3 style={subHeaderStyle}>2. Triage Intelligence</h3>
          <label style={{ ...labelStyle, marginTop: 15 }}>Vulnerability Profile</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--bg-inset)', padding: 12, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 12 }}>
            {VULN_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className={vulnArr.includes(value) ? 'pill-option is-active' : 'pill-option'}
                style={{
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  color: (value === 'Bedridden' || value === 'Oxygen') && vulnArr.includes(value) ? 'var(--critical-red)' : 'var(--fg-default)',
                }}
              >
                <input type="checkbox" checked={vulnArr.includes(value)} onChange={() => toggleVuln(value)} style={{ width: 'auto', marginRight: 8, cursor: 'pointer' }} />
                {label}
              </label>
            ))}
          </div>
          <TriagePreview triage={triage} />
        </div>

        <div className="sidebar-form-section" style={{ marginBottom: 25 }}>
          <h3 style={subHeaderStyle}>3. Household Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Head of Household / Patient Name</label>
              <input name="head" type="text" placeholder="Full Name" required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Contact Number</label>
              <input
                name="contact"
                type="tel"
                inputMode="numeric"
                placeholder="09xxxxxxxxx"
                required
                pattern="^(09[0-9]{9}|\\+639[0-9]{9})$"
                title="Enter a valid PH mobile number (e.g. 09171234567)"
                style={inputStyle}
                onInput={(e) => {
                  const input = e.currentTarget
                  const normalized = input.value.replace(/(?!^\+)[^\d]/g, '')
                  input.value = normalized.startsWith('+') ? `+${normalized.slice(1).replace(/[^\d]/g, '')}` : normalized
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>Total Occupants</label>
              <input name="occupants" type="number" min="1" defaultValue="1" required style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: 15 }}>
            <label style={labelStyle}>Data Source / Registry</label>
            <select name="source" required style={inputStyle} value={sourceVal} onChange={(e) => setSourceVal(e.target.value as RegistrySource)}>
              <option value="" disabled>
                Select Source
              </option>
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: 15 }}>
            <label style={labelStyle}>Responder / Evacuation Notes</label>
            <textarea name="notes" rows={3} placeholder="Critical instructions (e.g. needs stretcher, 4 responders required)" style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        {saveError && (
          <div style={{ background: 'var(--bg-danger-subtle)', border: '1px solid var(--fg-danger)', color: 'var(--fg-danger)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontWeight: 600, fontSize: '0.82rem', lineHeight: 1.5 }}>
            {saveError}
          </div>
        )}

        {saveWarning && (
          <div style={{ background: 'rgba(240, 136, 62, 0.12)', border: '1px solid var(--fg-warning)', color: 'var(--fg-warning)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontWeight: 600, fontSize: '0.82rem', lineHeight: 1.5 }}>
            {saveWarning}
          </div>
        )}

        {saveSuccess && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: 'var(--bg-success-subtle)',
            border: '1px solid var(--success-border)',
            color: 'var(--success-strong)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
            fontSize: '0.82rem',
            lineHeight: 1.5,
          }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>✓</span>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Registration Successful</div>
              <div style={{ fontWeight: 400, opacity: 0.85 }}>{saveSuccess}</div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving || geocoding}
          className="button-primary"
          style={{
            width: '100%',
            padding: 15,
            background: saving ? 'var(--bg-elevated)' : 'var(--accent-blue)',
            color: saving ? 'var(--fg-muted)' : '#fff',
            border: 'none',
            fontWeight: 'bold',
            cursor: saving || geocoding ? 'not-allowed' : 'pointer',
            marginTop: 10,
            fontSize: '0.9rem',
            opacity: geocoding ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : geocoding ? 'Detecting city...' : 'Register & Pin to Vulnerability Map'}
        </button>
      </form>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 767px) {
          form > div[style*='grid-template-columns: repeat(2, minmax(0, 1fr))'],
          form > div[style*='grid-template-columns: 1fr 1fr'] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  )
}
