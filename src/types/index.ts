// src/types/index.ts

export type TriageLevel = 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'STABLE'

export type ApprovalStatus = 'approved' | 'pending_review' | 'rejected'

export type RegistrySource =
  | 'Senior Citizen Registry'
  | 'PWD Registry'
  | 'Maternal Health Record'
  | 'CSWDO Database'
  | 'BHW Field Survey'
  | 'Self-Reported'

export type Vulnerability =
  | 'Bedridden'
  | 'Senior'
  | 'Wheelchair'
  | 'Infant'
  | 'Pregnant'
  | 'PWD'
  | 'Oxygen'
  | 'Dialysis'

export interface TriageResult {
  level:     TriageLevel
  hex:       string
  colorName: string
}

export interface Household {
  id:        string
  lat:       number
  lng:       number
  city:      string
  barangay:  string
  purok:     string
  street:    string
  structure: string
  head:      string
  contact:   string
  occupants: number
  vulnArr:   Vulnerability[]
  notes:     string
  status:    'Pending' | 'Rescued'
  triage:    TriageResult

  source?:         RegistrySource
  approvalStatus:  ApprovalStatus
  documentUrl?:    string

  assignedAssetId?: string
  dispatchedAt?:    string
  created_at?:      string
  updated_at?:      string

  citizenPasswordHash?: string

  // ── Improvement fields ───────────────────────────────────────────────────
  /** Pre-built display string: street + barangay + city + province (#9) */
  fullAddress?: string
  /** GPS fix accuracy in meters — undefined when pinned via map (#5) */
  gpsAccuracy?: number
  /** How the location was captured (#4) */
  pinSource?: 'gps' | 'map'
}

export interface HazardRadii {
  critical: number  // km
  high:     number
  elevated: number
  stable:   number  // outermost boundary
}

export type FloodSeverity = 'critical' | 'high' | 'elevated' | 'stable'
export type FloodDepth    = 'ankle' | 'knee' | 'waist' | 'chest'

export interface FloodZone {
  id:       string
  severity: FloodSeverity
  depth?:   FloodDepth
  notes?:   string
  polygon:  Array<{ lat: number; lng: number }>  // min 3 points
}

export interface HazardEvent {
  id:       string
  type:     string  // e.g. 'Flood', 'Volcano', 'Earthquake'
  center:   { lat: number; lng: number }
  radii:    HazardRadii
  isActive: boolean
}

// Fields set at runtime by the hazard engine — not stored in DB
export interface HazardOverlay {
  dynamicTriage:        TriageLevel
  isPriorityOverridden: boolean
  distanceKm:           number
}

export interface Asset {
  id:      string
  name:    string
  type:    string
  unit:    string
  status:  'Active' | 'Dispatching' | 'Standby'
  lat:     number
  lng:     number
  icon:    string
  address?: string
  contact?: string
  assetPasswordHash?: string
}