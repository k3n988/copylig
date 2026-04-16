'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { supabase } from '@/lib/supabase'
import { useHouseholdStore } from '@/store/householdStore'
import { useHazardStore } from '@/store/hazardStore'
import type { PublicAdvisoryResult } from '@/lib/ai/advisories'

const CITIES = [
  'Bacolod City', 'Bago City', 'Cadiz City', 'Canlaon City', 'Escalante City',
  'Himamaylan City', 'Kabankalan City', 'La Carlota City', 'Murcia',
  'Sagay City', 'San Carlos City', 'Silay City', 'Talisay City', 'Victorias City',
]

const BARANGAYS_BY_CITY: Record<string, string[]> = {
  'Bacolod City': [
    'Alangilan', 'Alicante', 'Banago', 'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5', 'Barangay 6', 'Barangay 7', 'Barangay 8', 'Barangay 9', 'Barangay 10', 'Barangay 11', 'Barangay 12', 'Barangay 13', 'Barangay 14', 'Barangay 15', 'Barangay 16', 'Barangay 17', 'Barangay 18', 'Barangay 19', 'Barangay 20', 'Barangay 21', 'Barangay 22', 'Barangay 23', 'Barangay 24', 'Barangay 25', 'Barangay 26', 'Barangay 27', 'Barangay 28', 'Barangay 29', 'Barangay 30', 'Barangay 31', 'Barangay 32', 'Barangay 33', 'Barangay 34', 'Barangay 35', 'Barangay 36', 'Barangay 37', 'Barangay 38', 'Barangay 39', 'Barangay 40', 'Barangay 41', 'Bata', 'Cabug', 'Estefania', 'Felisa', 'Granada', 'Handumanan', 'Mandalagan', 'Mansilingan', 'Pahanocoy', 'Punta Taytay', 'Singcang', 'Sum-ag', 'Tangub', 'Vista Alegre',
  ],
  'Bago City': [
    'Abuanan', 'Alanza', 'Atipuluan', 'Bacong', 'Bagroy', 'Balingasag', 'Binubuhan', 'Busay', 'Calumangangan', 'Caridad', 'Don Jorge L. Araneta', 'Dulao', 'Ilijan', 'Ma-ao', 'Mailum', 'Malingin', 'Napoles', 'Pacol', 'Poblacion', 'Sagasa', 'Sampinit', 'Tabunan', 'Taloc', 'Ubay',
  ],
  'Cadiz City': [
    'Andres Bonifacio', 'Burgos', 'Cabahug', 'Cadiz Viejo', 'Caduha-an', 'Celestino Villacin', 'Daga', 'Jerusalem', 'Luna', 'Mabini', 'Magsaysay', 'Sicaba', 'Tiglawigan', 'Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6',
  ],
  'Murcia': [
    'Abejuvela', 'Amaya', 'Anahaw', 'Buenavista', 'Caliban', 'Canlandog', 'Cansilayan', 'Damsite', 'Iglau-an', 'Lopez Jaena', 'Minoyan', 'Pandanon', 'Salvacion', 'San Miguel', 'Santa Cruz', 'Santa Rosa', 'Talotog', 'Zone I', 'Zone II', 'Zone III', 'Zone IV', 'Zone V',
  ],
  'Canlaon City': [
    'Bayog', 'Binalbagan', 'Bucalan', 'Budlasan', 'Linothangan', 'Lumapao', 'Mabigo', 'Malaiba', 'Masulog', 'Ninoy Aquino', 'Panubigan', 'Pula',
  ],
  'Escalante City': [
    'Alimango', 'Balintawak', 'Binaguiohan', 'Buenavista', 'Cervantes', 'Dian-ay', 'Haba', 'Japitan', 'Jonobjonob', 'Langub', 'Libertad', 'Mabini', 'Magsaysay', 'Malasibog', 'Old Poblacion', 'Paitan', 'Pinapugasan', 'Rizal', 'Tamlang', 'Udtongan', 'Washington',
  ],
  'Himamaylan City': [
    'Aguisan', 'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Buenavista', 'Cabadiangan', 'Cabanbanan', 'Carabalan', 'Libacao', 'Mahalang', 'Nabali-an', 'San Antonio', 'Saraet', 'Su-ay', 'Talaban', 'To-oy',
  ],
  'Kabankalan City': [
    'Bantayan', 'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5', 'Barangay 6', 'Barangay 7', 'Barangay 8', 'Barangay 9', 'Binicuil', 'Camansi', 'Camingawan', 'Camugao', 'Carol-an', 'Daan Banua', 'Hilamonan', 'Inapoy', 'Linao', 'Locotan', 'Magballo', 'Oringao', 'Orong', 'Pinaguinpinan', 'Salong', 'Tabugon', 'Tagoc', 'Tagukon', 'Tampalon', 'Tan-Awan', 'Tayum',
  ],
  'La Carlota City': [
    'Ara-al', 'Ayungon', 'Balabag', 'Barangay I', 'Barangay II', 'Barangay III', 'Batuan', 'Cubay', 'Haguimit', 'La Granja', 'Nagasi', 'Roberto S. Benedicto', 'San Miguel', 'Yubo',
  ],
  'Sagay City': [
    'Bato', 'Baviera', 'Bulanon', 'Campo Himoga-an', 'Campo Santiago', 'Colonia Divina', 'Fabrica', 'General Luna', 'Himoga-an Baybay', 'Lopez Jaena', 'Malubon', 'Molocaboc', 'Old Sagay', 'Plaridel', 'Poblacion I', 'Poblacion II', 'Rizal', 'Sewane', 'Taba-ao', 'Tadlong', 'Vito',
  ],
  'San Carlos City': [
    'Bagonbon', 'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Barangay V', 'Barangay VI', 'Buluangan', 'Codcod', 'Ermita', 'Guadalupe', 'Nataban', 'Palampas', 'Prinza', 'Prosperidad', 'Punao', 'Quezon', 'Rizal', 'San Juan',
  ],
  'Silay City': [
    'Bagtic', 'Balaring', 'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Barangay V', 'Guimbala-on', 'Guinhalaran', 'Kapitan Ramon', 'Lantad', 'Mambulac', 'Patag', 'Rizal',
  ],
  'Talisay City': [
    'Bubog', 'Cabacungan', 'Concepcion', 'Dos Hermanas', 'Efigenio Lizares', 'Katubhan', 'Matab-ang', 'Poblacion', 'San Fernando', 'Tanza', 'Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 4-A', 'Zone 5', 'Zone 6', 'Zone 7', 'Zone 8', 'Zone 9', 'Zone 10', 'Zone 11', 'Zone 12', 'Zone 12-A', 'Zone 14', 'Zone 14-A', 'Zone 14-B', 'Zone 15', 'Zone 16',
  ],
  'Victorias City': [
    'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Barangay V', 'Barangay VI', 'Barangay VII', 'Barangay VIII', 'Barangay IX', 'Barangay X', 'Barangay XI', 'Barangay XII', 'Barangay XIII', 'Barangay XIV', 'Barangay XV', 'Barangay XVI', 'Barangay XVII', 'Barangay XVIII', 'Barangay XIX', 'Barangay XX', 'Barangay XXI',
  ],
}

const HOTLINES: Record<string, { label: string; number: string }[]> = {
  'Bacolod City': [
    { label: 'CDRRMO', number: '(034) 434-0116' },
    { label: 'BFP Bacolod', number: '(034) 432-5401' },
    { label: 'PNP Bacolod', number: '(034) 433-3060' },
    { label: 'National Emergency', number: '911' },
  ],
  'Talisay City': [
    { label: 'MDRRMO Talisay', number: '(034) 495-0114' },
    { label: 'BFP Talisay', number: '(034) 495-0888' },
    { label: 'National Emergency', number: '911' },
  ],
  'Silay City': [
    { label: 'MDRRMO Silay', number: '(034) 495-5270' },
    { label: 'BFP Silay', number: '(034) 495-5116' },
    { label: 'National Emergency', number: '911' },
  ],
  'Bago City': [
    { label: 'CDRRMO Bago', number: '(034) 461-0333' },
    { label: 'National Emergency', number: '911' },
  ],
  'Cadiz City': [
    { label: 'MDRRMO Cadiz', number: '(034) 493-0365' },
    { label: 'National Emergency', number: '911' },
  ],
  'Escalante City': [
    { label: 'MDRRMO Escalante', number: '(034) 454-0011' },
    { label: 'National Emergency', number: '911' },
  ],
  'Himamaylan City': [
    { label: 'MDRRMO Himamaylan', number: '(034) 388-2154' },
    { label: 'National Emergency', number: '911' },
  ],
  'Kabankalan City': [
    { label: 'CDRRMO Kabankalan', number: '(034) 471-2063' },
    { label: 'National Emergency', number: '911' },
  ],
  'La Carlota City': [
    { label: 'MDRRMO La Carlota', number: '(034) 460-0335' },
    { label: 'National Emergency', number: '911' },
  ],
  'Sagay City': [
    { label: 'CDRRMO Sagay', number: '(034) 488-0333' },
    { label: 'National Emergency', number: '911' },
  ],
  'San Carlos City': [
    { label: 'CDRRMO San Carlos', number: '(034) 312-5240' },
    { label: 'National Emergency', number: '911' },
  ],
  'Victorias City': [
    { label: 'MDRRMO Victorias', number: '(034) 399-2100' },
    { label: 'National Emergency', number: '911' },
  ],
  'Murcia': [
    { label: 'MDRRMO Murcia', number: '(034) 399-2101' },
    { label: 'National Emergency', number: '911' },
  ],
  'Canlaon City': [
    { label: 'CDRRMO Canlaon', number: '(035) 400-0000' },
    { label: 'National Emergency', number: '911' },
  ],
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getHazardAdvisory(type: string): string {
  switch (type.toLowerCase()) {
    case 'volcano':
      return 'Ashfall warning. Stay indoors, seal windows, wear an N95 mask when going outside, and prepare an emergency go-bag with essential documents, medicine, and 3-day supplies.'
    case 'flood':
      return 'Monitor water levels closely. If you live near riverbanks or low-lying areas, evacuate immediately to the nearest evacuation center. Do not cross flooded roads.'
    case 'earthquake':
      return 'Aftershocks may occur. Stay away from damaged structures. Inspect your home for gas leaks and structural damage before re-entering.'
    case 'typhoon':
      return 'Secure loose objects outdoors. Stay indoors away from windows. Follow the local DRRMO for evacuation orders. Keep flashlights and emergency kits ready.'
    case 'landslide':
      return 'Avoid slopes, hillsides, and drainage channels. Evacuate if you hear rumbling or notice tilting trees and cracking ground. Do not return until authorities declare it safe.'
    case 'fire':
      return 'Evacuate the area immediately. Stay low to avoid smoke inhalation. Do not use elevators. Call BFP and do not re-enter until cleared by responders.'
    default:
      return 'A hazard has been detected near your area. Stay alert, monitor official channels, and follow the instructions of your local DRRMO.'
  }
}

type HazardZone = 'critical' | 'high' | 'elevated' | 'stable' | 'outside'

function getHazardZone(
  distKm: number,
  radii: { critical: number; high: number; elevated: number; stable: number },
): HazardZone {
  if (distKm <= radii.critical) return 'critical'
  if (distKm <= radii.high) return 'high'
  if (distKm <= radii.elevated) return 'elevated'
  if (distKm <= radii.stable) return 'stable'
  return 'outside'
}

type AlertLevel = 'Normal' | 'Monitoring' | 'Pre-emptive Evacuation'

function zoneToAlertLevel(zone: HazardZone): AlertLevel | null {
  if (zone === 'critical' || zone === 'high') return 'Pre-emptive Evacuation'
  if (zone === 'elevated' || zone === 'stable') return 'Monitoring'
  return null
}

const ZONE_LABEL: Record<HazardZone, string> = {
  critical: 'Critical Zone',
  high: 'High-Risk Zone',
  elevated: 'Elevated Zone',
  stable: 'Stable Zone',
  outside: 'Outside Hazard Area',
}

const ALERT_CONFIG: Record<AlertLevel, { icon: string; color: string; bg: string; border: string }> = {
  Normal: { icon: 'Green', color: '#3fb950', bg: '#0d2016', border: '#238636' },
  Monitoring: { icon: 'Yellow', color: '#d29922', bg: '#1f1a0e', border: '#9e6a03' },
  'Pre-emptive Evacuation': { icon: 'Red', color: '#f85149', bg: '#2d1217', border: '#da3633' },
}

interface AreaStatus {
  alert_level: AlertLevel
  advisory: string
  updated_at: string
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  padding: 16,
}

const innerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 10px',
  background: 'var(--bg-elevated)',
  borderRadius: 12,
  border: '1px solid var(--border)',
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  background: 'var(--bg-inset)',
  border: '1px solid var(--border)',
  color: 'var(--fg-default)',
  borderRadius: 12,
  fontSize: '0.82rem',
  fontFamily: 'Inter, monospace',
  boxSizing: 'border-box',
}

const hazardCardTheme: Record<string, { bg: string; border: string; glow: string; badgeBg: string; badgeColor: string; titleColor: string; eyebrowColor: string; bodyColor: string; chipBg: string; chipColor: string; iconBg: string; iconBorder: string; stripBg: string }> = {
  earthquake: {
    bg: 'linear-gradient(90deg, #fff2e6 0%, #fff6cb 100%)',
    border: '#f26b5f',
    glow: '0 10px 24px rgba(242,107,95,0.12)',
    badgeBg: '#df3d45',
    badgeColor: '#fff7f6',
    titleColor: '#0f1f46',
    eyebrowColor: '#8f9ab4',
    bodyColor: '#303548',
    chipBg: '#fffaf7',
    chipColor: '#2c3244',
    iconBg: 'rgba(255,255,255,0.74)',
    iconBorder: 'rgba(255,255,255,0.82)',
    stripBg: 'linear-gradient(90deg, #fff2e6 0%, #fff6cb 100%)',
  },
  volcano: {
    bg: 'linear-gradient(135deg, #fef2f2 0%, #fde8d0 100%)',
    border: '#b91c1c',
    glow: '0 12px 28px rgba(185,28,28,0.18)',
    badgeBg: '#7f1d1d',
    badgeColor: '#fef2f2',
    titleColor: '#7f1d1d',
    eyebrowColor: '#dc2626',
    bodyColor: '#1a0a0a',
    chipBg: 'rgba(255,255,255,0.76)',
    chipColor: '#7f1d1d',
    iconBg: 'rgba(255,255,255,0.56)',
    iconBorder: 'rgba(185,28,28,0.3)',
    stripBg: 'linear-gradient(90deg,#fef2f2,#fde8d0)',
  },
  flood: {
    bg: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
    border: '#2563eb',
    glow: '0 12px 28px rgba(37,99,235,0.16)',
    badgeBg: '#1d4ed8',
    badgeColor: '#eff6ff',
    titleColor: '#1e3a8a',
    eyebrowColor: '#2563eb',
    bodyColor: '#0f172a',
    chipBg: 'rgba(255,255,255,0.74)',
    chipColor: '#1d4ed8',
    iconBg: 'rgba(255,255,255,0.56)',
    iconBorder: 'rgba(37,99,235,0.3)',
    stripBg: 'linear-gradient(90deg,#dbeafe,#eff6ff)',
  },
  typhoon: {
    bg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    border: '#059669',
    glow: '0 12px 28px rgba(5,150,105,0.15)',
    badgeBg: '#065f46',
    badgeColor: '#ecfdf5',
    titleColor: '#064e3b',
    eyebrowColor: '#059669',
    bodyColor: '#022c22',
    chipBg: 'rgba(255,255,255,0.76)',
    chipColor: '#065f46',
    iconBg: 'rgba(255,255,255,0.56)',
    iconBorder: 'rgba(5,150,105,0.3)',
    stripBg: 'linear-gradient(90deg,#ecfdf5,#d1fae5)',
  },
  fire: {
    bg: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
    border: '#ea580c',
    glow: '0 12px 28px rgba(234,88,12,0.18)',
    badgeBg: '#9a3412',
    badgeColor: '#fff7ed',
    titleColor: '#7c2d12',
    eyebrowColor: '#ea580c',
    bodyColor: '#1c0a03',
    chipBg: 'rgba(255,255,255,0.76)',
    chipColor: '#9a3412',
    iconBg: 'rgba(255,255,255,0.56)',
    iconBorder: 'rgba(234,88,12,0.3)',
    stripBg: 'linear-gradient(90deg,#fff7ed,#ffedd5)',
  },
  default: {
    bg: 'linear-gradient(90deg, #fff2e6 0%, #fff6cb 100%)',
    border: '#f26b5f',
    glow: '0 10px 24px rgba(242,107,95,0.12)',
    badgeBg: '#df3d45',
    badgeColor: '#fff7f6',
    titleColor: '#0f1f46',
    eyebrowColor: '#8f9ab4',
    bodyColor: '#303548',
    chipBg: '#fffaf7',
    chipColor: '#2c3244',
    iconBg: 'rgba(255,255,255,0.74)',
    iconBorder: 'rgba(255,255,255,0.82)',
    stripBg: 'linear-gradient(90deg, #fff2e6 0%, #fff6cb 100%)',
  },
}

function getHazardTheme(type: string | undefined) {
  if (!type) return hazardCardTheme.default
  return hazardCardTheme[type.toLowerCase()] ?? hazardCardTheme.default
}

function getHazardActions(type: string | undefined) {
  switch ((type ?? '').toLowerCase()) {
    case 'volcano':
      return ['Wear mask outdoors', 'Stay indoors if ashfall increases', 'Prepare for evacuation updates']
    case 'flood':
      return ['Move to higher ground', 'Avoid flooded roads', 'Keep emergency kit ready']
    case 'earthquake':
      return ['Expect aftershocks', 'Stay away from damaged buildings', 'Check for gas leaks']
    case 'typhoon':
      return ['Secure loose objects', 'Stay away from windows', 'Charge devices now']
    default:
      return ['Stay alert', 'Follow official advisories', 'Prepare essentials']
  }
}

function getHazardSummaryLabel(type: string) {
  switch (type.toLowerCase()) {
    case 'earthquake':
      return 'Critical watch'
    case 'volcano':
      return 'Ashfall watch'
    case 'flood':
      return 'Flood watch'
    default:
      return 'Active'
  }
}

export default function GuestPanel() {
  const setPanToCoords = useHouseholdStore((s) => s.setPanToCoords)
  const activeHazards = useHazardStore((s) => s.activeHazards)
  const focusedHazardType = useHazardStore((s) => s.focusedHazardType)
  const setFocusedHazardType = useHazardStore((s) => s.setFocusedHazardType)
  const activeHazard = activeHazards[0] ?? null
  const geocodingLib = useMapsLibrary('geocoding')
  const geocoder = useRef<google.maps.Geocoder | null>(null)
  const areaCheckerRef = useRef<HTMLDivElement | null>(null)

  const [city, setCity] = useState('')
  const [barangay, setBarangay] = useState('')
  const [status, setStatus] = useState<AreaStatus | null>(null)
  const [fetching, setFetching] = useState(false)
  const [noData, setNoData] = useState(false)
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [aiAdvisory, setAiAdvisory] = useState<PublicAdvisoryResult | null>(null)
  const [loadingAiAdvisory, setLoadingAiAdvisory] = useState(false)
  const [expandedHazardId, setExpandedHazardId] = useState<string | null>(null)

  const barangays = city ? (BARANGAYS_BY_CITY[city] ?? []) : []
  const hotlines = city ? (HOTLINES[city] ?? [{ label: 'National Emergency', number: '911' }]) : []

  useEffect(() => {
    if (geocodingLib) {
      geocoder.current = new geocodingLib.Geocoder()
    }
  }, [geocodingLib])

  useEffect(() => {
    const focusedHazard = activeHazards.find((hazard) => hazard.type === focusedHazardType)
    if (focusedHazard) {
      setExpandedHazardId(focusedHazard.id)
      return
    }
    setExpandedHazardId(activeHazards[0]?.id ?? null)
  }, [activeHazards, focusedHazardType])

  useEffect(() => {
    if (!city || !barangay) return

    supabase
      .from('area_status')
      .select('alert_level, advisory, updated_at')
      .eq('city', city)
      .eq('barangay', barangay)
      .single()
      .then(({ data, error }) => {
        setFetching(false)
        if (error || !data) {
          setNoData(true)
          return
        }
        setStatus(data as AreaStatus)
      })
  }, [city, barangay])

  function geocodeAndPan(query: string, zoom: number) {
    if (!geocoder.current) return

    geocoder.current.geocode(
      { address: query, componentRestrictions: { country: 'ph' } },
      (
        results: google.maps.GeocoderResult[] | null,
        geocodeStatus: google.maps.GeocoderStatus,
      ) => {
        if (geocodeStatus === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location
          setPanToCoords({ lat: loc.lat(), lng: loc.lng(), zoom })
          setSelectedCoords({ lat: loc.lat(), lng: loc.lng() })
        }
      },
    )
  }

  function handleCityChange(nextCity: string) {
    setCity(nextCity)
    setBarangay('')
    setStatus(null)
    setNoData(false)
    if (!nextCity) return
    geocodeAndPan(`${nextCity}, Negros Occidental, Philippines`, 13)
  }

  function handleBarangayChange(nextBarangay: string) {
    setBarangay(nextBarangay)
    setFetching(Boolean(nextBarangay && city))
    setNoData(false)
    if (!nextBarangay || !city) return
    geocodeAndPan(`${nextBarangay}, ${city}, Philippines`, 16)
  }

  const hazardInfo = (() => {
    if (!activeHazard?.isActive || !selectedCoords) return null
    const distKm = haversineKm(
      selectedCoords.lat,
      selectedCoords.lng,
      activeHazard.center.lat,
      activeHazard.center.lng,
    )
    const zone = getHazardZone(distKm, activeHazard.radii)
    const overrideLevel = zoneToAlertLevel(zone)
    const advisory = getHazardAdvisory(activeHazard.type)
    return { distKm, zone, overrideLevel, advisory }
  })()

  useEffect(() => {
    if (!activeHazard?.isActive || !city || !barangay) {
      setAiAdvisory(null)
      return
    }

    const controller = new AbortController()

    async function loadAdvisory() {
      setLoadingAiAdvisory(true)
      try {
        const response = await fetch('/api/ai/public-advisory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city,
            barangay,
            coords: selectedCoords,
            hazard: activeHazard,
          }),
          signal: controller.signal,
        })

        if (!response.ok) throw new Error('Advisory request failed')
        const data = (await response.json()) as PublicAdvisoryResult
        setAiAdvisory(data)
      } catch {
        if (!controller.signal.aborted) setAiAdvisory(null)
      } finally {
        if (!controller.signal.aborted) setLoadingAiAdvisory(false)
      }
    }

    void loadAdvisory()

    return () => controller.abort()
  }, [activeHazard, barangay, city, selectedCoords])

  const effectiveAlertLevel: AlertLevel =
    hazardInfo?.overrideLevel ??
    status?.alert_level ??
    'Normal'

  const alertCfg = (city && barangay)
    ? (ALERT_CONFIG[effectiveAlertLevel] ?? ALERT_CONFIG.Normal)
    : status
      ? (ALERT_CONFIG[status.alert_level] ?? ALERT_CONFIG.Normal)
      : null

  const alertSummary = useMemo(
    () => activeHazards.map((hazard) => ({
      id: hazard.id,
      type: hazard.type,
      level: getHazardSummaryLabel(hazard.type),
    })),
    [activeHazards],
  )

  function focusHazardCard(hazardId: string, hazardType: string) {
    setExpandedHazardId(hazardId)
    setFocusedHazardType(hazardType)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {activeHazards.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            padding: '9px 14px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'var(--fg-muted)',
          }}
        >
          <span style={{ color: 'var(--critical-red)', fontWeight: 800 }}>
            {activeHazards.length} Active {activeHazards.length === 1 ? 'Hazard' : 'Hazards'}
          </span>
          {alertSummary.map((s, i) => (
            <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <span style={{ color: 'var(--border-color)' }}>|</span>}
              <button
                onClick={() => focusHazardCard(s.id, s.type)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: expandedHazardId === s.id ? 'var(--accent-blue)' : 'var(--fg-default)',
                  padding: 0,
                  textDecoration: expandedHazardId === s.id ? 'underline' : 'none',
                }}
              >
                {s.type}: {s.level}
              </button>
            </span>
          ))}
        </div>
      )}

      {activeHazards.map((hazard) => {
        const theme = getHazardTheme(hazard.type)
        const actions = getHazardActions(hazard.type)
        const icon = hazard.type.toLowerCase() === 'volcano' ? '🌋'
          : hazard.type.toLowerCase() === 'flood' ? '🌊'
          : hazard.type.toLowerCase() === 'earthquake' ? '🔔'
          : hazard.type.toLowerCase() === 'fire' ? '🔥'
          : '(!)'
        const isExpanded = expandedHazardId === hazard.id

        if (!isExpanded) {
          return (
            <button
              key={hazard.id}
              onClick={() => focusHazardCard(hazard.id, hazard.type)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 14px',
                background: theme.stripBg,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{icon}</span>
              <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 700, color: theme.titleColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {hazard.type} Alert
              </span>
              <span style={{ fontSize: '0.65rem', color: theme.eyebrowColor, fontWeight: 700, whiteSpace: 'nowrap' }}>
                Tap to expand &rsaquo;
              </span>
            </button>
          )
        }

        return (
          <div
            key={hazard.id}
            className="guest-alert-card"
            style={{
              background: theme.bg,
              border: `1px solid ${theme.border}`,
              borderRadius: 22,
              padding: '16px 14px 14px',
              boxShadow: theme.glow,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 48%)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 92,
                height: 92,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.08) 72%, rgba(255,255,255,0) 100%)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'nowrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      className="guest-alert-badge"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        width: 'fit-content',
                        padding: '7px 12px',
                        borderRadius: 999,
                        background: theme.badgeBg,
                        color: theme.badgeColor,
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        letterSpacing: 0.45,
                        textTransform: 'uppercase',
                        lineHeight: 1,
                      }}
                    >
                      Live {hazard.type} Alert
                    </span>
                  </div>
                  <div>
                    <p className="guest-alert-eyebrow" style={{ margin: '0 0 6px', fontSize: '0.72rem', color: theme.eyebrowColor, letterSpacing: 1.9, textTransform: 'uppercase', fontWeight: 800 }}>
                      Active Disaster Warning
                    </p>
                    <p className="guest-alert-title" style={{ margin: 0, fontSize: '1.95rem', lineHeight: 0.95, fontWeight: 900, color: theme.titleColor, textTransform: 'uppercase', letterSpacing: 0.2 }}>
                      {hazard.type}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                  <div
                    className="guest-alert-icon"
                    aria-hidden="true"
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      background: theme.iconBg,
                      border: `1px solid ${theme.iconBorder}`,
                      boxShadow: '0 8px 18px rgba(255,255,255,0.28)',
                      fontSize: '1.25rem',
                    }}
                  >
                    {icon}
                  </div>
                  {false && (
                    <button
                      onClick={() => setExpandedHazardId(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.62rem',
                        color: theme.eyebrowColor,
                        fontWeight: 600,
                        padding: 0,
                      }}
                    >
                      Collapse ^
                    </button>
                  )}
                </div>
              </div>

              <p className="guest-alert-copy" style={{ margin: '2px 0 0', fontSize: '0.92rem', color: theme.bodyColor, lineHeight: 1.52, maxWidth: 470, fontWeight: 600 }}>
                A <strong>{hazard.type.toLowerCase()}</strong> hazard zone is currently being monitored on the map. Review the actions below before continuing.
              </p>

              <div className="guest-alert-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 2 }}>
                {actions.map((action) => (
                  <span
                    key={action}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 999,
                      background: theme.chipBg,
                      color: theme.chipColor,
                      border: '1px solid rgba(255,255,255,0.98)',
                      boxShadow: '0 3px 10px rgba(227, 179, 114, 0.14)',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                    }}
                  >
                    {action}
                  </span>
                ))}
              </div>

            </div>
          </div>
        )
      })}

      <div ref={areaCheckerRef} style={cardStyle}>
        <p style={{ margin: '0 0 4px', fontSize: '0.65rem', color: 'var(--accent-blue)', letterSpacing: 2, textTransform: 'uppercase' }}>
          Check Your Area
        </p>
        <p style={{ margin: '0 0 14px', fontSize: '0.78rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
          Select your city and barangay to see the current status and advisories for your area.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select value={city} onChange={(e) => handleCityChange(e.target.value)} style={selectStyle}>
            <option value="">- Select City -</option>
            {CITIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select
            value={barangay}
            onChange={(e) => handleBarangayChange(e.target.value)}
            disabled={!city || barangays.length === 0}
            style={{ ...selectStyle, opacity: !city ? 0.5 : 1 }}
          >
            <option value="">- Select Barangay -</option>
            {barangays.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>

      {city && barangay && (
        <>
          {fetching && (
            <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', textAlign: 'center', margin: 0 }}>
              Loading area status...
            </p>
          )}

          {noData && !fetching && (
            <div style={{ ...cardStyle, padding: 14 }}>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--fg-muted)', textAlign: 'center' }}>
                No status posted yet for {barangay}, {city}.
              </p>
            </div>
          )}

          {hazardInfo && (
            <div
              style={{
                background: 'var(--bg-warning-subtle)',
                border: '1px solid var(--high-orange)',
                borderRadius: 18,
                padding: 16,
              }}
            >
              <p style={{ margin: '0 0 4px', fontSize: '0.65rem', color: 'var(--fg-warning)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>
                Hazard-Aware Advisory
              </p>
              <p style={{ margin: '0 0 8px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--fg-default)' }}>
                {activeHazard?.type} - {ZONE_LABEL[hazardInfo.zone]}
              </p>
              <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                Your area is approximately <strong style={{ color: 'var(--fg-default)' }}>{hazardInfo.distKm.toFixed(1)} km</strong> from the hazard center.
                {hazardInfo.overrideLevel && (
                  <> Alert level has been automatically elevated to <strong style={{ color: ALERT_CONFIG[hazardInfo.overrideLevel].color }}>{hazardInfo.overrideLevel}</strong>.</>
                )}
              </p>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--fg-default)', lineHeight: 1.6, borderTop: '1px solid var(--high-orange)', paddingTop: 10 }}>
                {hazardInfo.advisory}
              </p>
            </div>
          )}

          {(aiAdvisory || loadingAiAdvisory) && (
            <div style={cardStyle}>
              <p style={{ margin: '0 0 8px', fontSize: '0.65rem', color: 'var(--accent-blue)', letterSpacing: 2, textTransform: 'uppercase' }}>
                AI Local Advisory
              </p>
              {loadingAiAdvisory && !aiAdvisory ? (
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
                  Drafting localized safety guidance...
                </p>
              ) : aiAdvisory ? (
                <>
                  <p style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--fg-default)' }}>
                    {aiAdvisory.title}
                  </p>
                  <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: 'var(--fg-muted)', lineHeight: 1.6 }}>
                    {aiAdvisory.summary}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {aiAdvisory.actions.map((action) => (
                      <div key={action} style={innerRowStyle}>
                        <span style={{ fontSize: '0.76rem', color: 'var(--fg-default)' }}>{action}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: '0.66rem', color: 'var(--fg-muted)' }}>
                    Source: {aiAdvisory.source === 'gemini' ? 'Gemini' : 'Rule-based fallback'}
                  </p>
                </>
              ) : null}
            </div>
          )}

          {status && alertCfg && (
            <>
              <div
                style={{
                  background: alertCfg.bg,
                  border: `1px solid ${alertCfg.border}`,
                  borderRadius: 18,
                  padding: 16,
                  boxShadow: 'var(--shadow-soft)',
                }}
              >
                <p style={{ margin: '0 0 6px', fontSize: '0.65rem', color: 'var(--fg-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>
                  Barangay Alert Level
                </p>
                <p style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 700, color: alertCfg.color }}>
                  {alertCfg.icon} {effectiveAlertLevel}
                </p>
                <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--fg-muted)' }}>
                  {barangay}, {city} - Updated {new Date(status.updated_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                  {hazardInfo?.overrideLevel && (
                    <> - <span style={{ color: 'var(--fg-warning)' }}>Auto-elevated by hazard proximity</span></>
                  )}
                </p>
              </div>

              {status.advisory && (
                <div style={cardStyle}>
                  <p style={{ margin: '0 0 8px', fontSize: '0.65rem', color: 'var(--fg-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>
                    LGU Advisory
                  </p>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--fg-default)', lineHeight: 1.6 }}>
                    {status.advisory}
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {city ? (
        <div style={cardStyle}>
          <p style={{ margin: '0 0 12px', fontSize: '0.65rem', color: 'var(--fg-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>
            Emergency Hotlines - {city}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hotlines.map(({ label, number }) => (
              <div key={label} style={innerRowStyle}>
                <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>{label}</span>
                <a
                  href={`tel:${number.replace(/\D/g, '')}`}
                  style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--fg-success)', textDecoration: 'none', letterSpacing: 0.5 }}
                >
                  {number}
                </a>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={cardStyle}>
          <p style={{ margin: '0 0 12px', fontSize: '0.65rem', color: 'var(--fg-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>
            Emergency Hotlines
          </p>
          <div style={innerRowStyle}>
            <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>National Emergency</span>
            <a
              href="tel:911"
              style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--fg-success)', textDecoration: 'none', letterSpacing: 0.5 }}
            >
              911
            </a>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: '0.7rem', color: 'var(--fg-muted)' }}>
            Select your city above to see local DRRMO numbers.
          </p>
        </div>
      )}
    </div>
  )
}