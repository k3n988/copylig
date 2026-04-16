// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Household } from '@/types'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// ── Row ↔ Household mappers ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToHousehold(row: any): Household {
  return {
    id:        row.id,
    lat:       row.lat,
    lng:       row.lng,
    city:      row.city,
    barangay:  row.barangay,
    purok:     row.purok,
    street:    row.street,
    structure: row.structure,
    head:      row.head,
    contact:   row.contact,
    occupants: row.occupants,
    vulnArr:   row.vuln_arr   ?? [],
    notes:     row.notes      ?? '',
    status:    row.status,
    triage: {
      level:     row.triage_level,
      hex:       row.triage_hex,
      colorName: row.triage_color_name,
    },
    source:          row.source            ?? undefined,
    approvalStatus:  row.approval_status   ?? 'approved',
    documentUrl:     row.document_url      ?? undefined,
    assignedAssetId: row.assigned_asset_id ?? undefined,
    dispatchedAt:    row.dispatched_at     ?? undefined,
    created_at:      row.created_at        ?? undefined,
    updated_at:      row.updated_at        ?? undefined,
    citizenPasswordHash: row.citizen_password_hash ?? undefined,

  }
}

export function householdToRow(h: Household) {
  return {
    id:        h.id,
    lat:       h.lat,
    lng:       h.lng,
    city:      h.city,
    barangay:  h.barangay,
    purok:     h.purok,
    street:    h.street,
    structure: h.structure,
    head:      h.head,
    contact:   h.contact,
    occupants: h.occupants,
    vuln_arr:  h.vulnArr,
    notes:     h.notes,
    status:    h.status,

    triage_level:      h.triage.level,
    triage_hex:        h.triage.hex,
    triage_color_name: h.triage.colorName,

    source:            h.source           ?? null,
    approval_status:   h.approvalStatus,
    document_url:      h.documentUrl      ?? null,
    assigned_asset_id: h.assignedAssetId  ?? null,
    dispatched_at:     h.dispatchedAt     ?? null,
    updated_at:        h.updated_at       ?? null,
    citizen_password_hash: h.citizenPasswordHash ?? null,
//s
  }
}