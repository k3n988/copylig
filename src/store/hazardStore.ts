// src/store/hazardStore.ts
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { FloodZone, HazardEvent } from '@/types'

// ── Row ↔ HazardEvent mappers ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToHazard(row: any): HazardEvent {
  return {
    id:       row.id,
    type:     row.type,
    center:   { lat: row.center_lat ?? 0, lng: row.center_lng ?? 0 },
    radii: {
      critical: row.radius_critical ?? 0,
      high:     row.radius_high     ?? 0,
      elevated: row.radius_elevated ?? 0,
      stable:   row.radius_stable   ?? 0,
    },
    isActive: row.is_active,
  }
}

function hazardToRow(h: HazardEvent) {
  // Flood hazards use center {0,0} and radii {0} as placeholders — columns are NOT NULL
  return {
    id:               h.id,
    type:             h.type,
    center_lat:       h.center.lat,
    center_lng:       h.center.lng,
    radius_critical:  h.radii.critical,
    radius_high:      h.radii.high,
    radius_elevated:  h.radii.elevated,
    radius_stable:    h.radii.stable,
    is_active:        h.isActive,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToFloodZone(row: any): FloodZone {
  return {
    id:       row.id,
    severity: row.severity,
    depth:    row.depth    ?? undefined,
    notes:    row.notes    ?? undefined,
    polygon:  row.polygon,
  }
}

// ── Store ──────────────────────────────────────────────────────────────────

interface HazardStore {
  activeHazard:         HazardEvent | null
  activeHazards:        HazardEvent[]
  focusedHazardType:    string | null
  isSelectingCenter:    boolean
  draftCenter:          { lat: number; lng: number } | null

  // ── Flood zone state ─────────────────────────────────────────────────────
  floodZones:           FloodZone[]   // persisted zones for activeHazard
  draftFloodZones:      FloodZone[]   // unsaved zones during editing session

  // ── Hazard event actions ─────────────────────────────────────────────────
  loadActiveHazard:     () => Promise<void>
  setActiveHazard:      (hazard: HazardEvent) => Promise<void>
  clearHazard:          (hazardType?: string) => Promise<void>
  setFocusedHazardType: (hazardType: string | null) => void
  setIsSelectingCenter: (v: boolean) => void
  setDraftCenter:       (c: { lat: number; lng: number } | null) => void

  // ── Flood zone actions ───────────────────────────────────────────────────
  loadFloodZones:        (hazardEventId: string) => Promise<void>
  addDraftFloodZone:     (zone: FloodZone) => void
  removeDraftFloodZone:  (id: string) => void
  updateFloodZone:       (id: string, updates: Partial<Pick<FloodZone, 'severity' | 'depth' | 'notes' | 'polygon'>>) => Promise<void>
  deleteFloodZone:       (id: string) => Promise<void>
  saveFloodZones:        (hazardEventId: string) => Promise<void>
  cancelDraftFloodZones: () => void
  clearFloodZones:       (hazardEventId?: string) => Promise<void>
}

export const useHazardStore = create<HazardStore>((set, get) => ({
  activeHazard:      null,
  activeHazards:     [],
  focusedHazardType: null,
  isSelectingCenter: false,
  draftCenter:       null,
  floodZones:        [],
  draftFloodZones:   [],

  // ── Load the single active hazard from Supabase ────────────────────────
  loadActiveHazard: async () => {
    const { data, error } = await supabase
      .from('hazard_events')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) { console.error('[LIGTAS] loadActiveHazard:', error.message); return }
    const hazards = (data ?? []).map(rowToHazard)
    const primaryHazard = hazards[0] ?? null
    const activeFloodHazard = hazards.find((hazard) => hazard.type === 'Flood') ?? null
    set((state) => ({
      activeHazard: primaryHazard,
      activeHazards: hazards,
      focusedHazardType: hazards.some((hazard) => hazard.type === state.focusedHazardType)
        ? state.focusedHazardType
        : primaryHazard?.type ?? null,
    }))

    if (activeFloodHazard) {
      await get().loadFloodZones(activeFloodHazard.id)
    } else {
      set({ floodZones: [], draftFloodZones: [] })
    }
  },

  // ── Activate a new hazard (deactivates any previous one first) ────────
  setActiveHazard: async (hazard) => {
    if (hazard.type === 'Flood') {
      const existingFloodHazard = get().activeHazards.find((item) => item.type === 'Flood')
      const pendingFloodZones = get().draftFloodZones

      if (existingFloodHazard) {
        if (pendingFloodZones.length > 0) {
          await get().saveFloodZones(existingFloodHazard.id)
        }
        set({
          activeHazard: existingFloodHazard,
          activeHazards: [
            existingFloodHazard,
            ...get().activeHazards.filter((item) => item.type !== 'Flood'),
          ],
        })
        await get().loadActiveHazard()
        return
      }
    }

    const previousHazards = get().activeHazards
    set({
      activeHazard: hazard,
      activeHazards: [hazard, ...previousHazards.filter((item) => item.type !== hazard.type)],
      focusedHazardType: hazard.type,
    })

    await supabase
      .from('hazard_events')
      .update({ is_active: false })
      .eq('is_active', true)
      .eq('type', hazard.type)

    // Insert the new hazard row
    const { data, error } = await supabase
      .from('hazard_events')
      .insert(hazardToRow(hazard))
      .select('id')
      .single()

    if (error) {
      console.error('[LIGTAS] setActiveHazard:', error.message)
      await get().loadActiveHazard()
      return
    }

    // For Flood: use the DB-returned id to save zones with correct FK
    if (hazard.type === 'Flood' && data?.id) {
      const insertedId = data.id as string
      set((s) => ({
        activeHazard: s.activeHazard ? { ...s.activeHazard, id: insertedId } : null,
        activeHazards: s.activeHazards.map((item, index) => (
          index === 0 ? { ...item, id: insertedId } : item
        )),
      }))
      await get().saveFloodZones(insertedId)
    }

    await get().loadActiveHazard()
  },

  // ── Deactivate — marks is_active = false in Supabase ──────────────────
  clearHazard: async (hazardType) => {
    const typeToClear = hazardType ?? get().activeHazard?.type
    if (!typeToClear) return

    const matchingHazard = get().activeHazards.find((hazard) => hazard.type === typeToClear)
    if (typeToClear === 'Flood' && matchingHazard) {
      await get().clearFloodZones(matchingHazard.id)
    }

    const remainingHazards = get().activeHazards.filter((hazard) => hazard.type !== typeToClear)
    set({
      activeHazard: remainingHazards[0] ?? null,
      activeHazards: remainingHazards,
      focusedHazardType: remainingHazards[0]?.type ?? null,
      draftCenter: null,
      floodZones: typeToClear === 'Flood' ? [] : get().floodZones,
      draftFloodZones: typeToClear === 'Flood' ? [] : get().draftFloodZones,
    })

    const { error } = await supabase
      .from('hazard_events')
      .update({ is_active: false })
      .eq('is_active', true)
      .eq('type', typeToClear)

    if (error) console.error('[LIGTAS] clearHazard:', error.message)
    await get().loadActiveHazard()
  },

  setFocusedHazardType: (hazardType) => set({ focusedHazardType: hazardType }),
  setIsSelectingCenter: (v) => set({ isSelectingCenter: v }),
  setDraftCenter:       (c) => set({ draftCenter: c }),

  // ── Flood zone: load from DB ───────────────────────────────────────────
  loadFloodZones: async (hazardEventId) => {
    const { data, error } = await supabase
      .from('flood_zones')
      .select('*')
      .eq('hazard_event_id', hazardEventId)
      .order('created_at', { ascending: true })

    if (error) { console.error('[LIGTAS] loadFloodZones:', error.message); return }
    set({ floodZones: (data ?? []).map(rowToFloodZone) })
  },

  // ── Flood zone: draft management ──────────────────────────────────────
  addDraftFloodZone: (zone) => {
    if (zone.polygon.length < 3) {
      console.warn('[LIGTAS] addDraftFloodZone: polygon needs ≥3 points')
      return
    }
    set((s) => ({ draftFloodZones: [...s.draftFloodZones, zone] }))
  },

  removeDraftFloodZone: (id) => {
    set((s) => ({ draftFloodZones: s.draftFloodZones.filter((z) => z.id !== id) }))
  },

  cancelDraftFloodZones: () => set({ draftFloodZones: [] }),

  // ── Flood zone: save drafts to Supabase ───────────────────────────────
  saveFloodZones: async (hazardEventId) => {
    const drafts = get().draftFloodZones
    if (drafts.length === 0) return

    const rows = drafts.map((z) => ({
      id:              z.id,
      hazard_event_id: hazardEventId,
      severity:        z.severity,
      depth:           z.depth   ?? null,
      notes:           z.notes   ?? null,
      polygon:         z.polygon,
    }))

    const { error } = await supabase.from('flood_zones').insert(rows)
    if (error) { console.error('[LIGTAS] saveFloodZones:', error.message); return }

    set((s) => ({
      floodZones:      [...s.floodZones, ...drafts],
      draftFloodZones: [],
    }))
  },

  // ── Flood zone: update a persisted zone ──────────────────────────────
  updateFloodZone: async (id, updates) => {
    set((s) => ({
      floodZones: s.floodZones.map((z) => z.id === id ? { ...z, ...updates } : z),
    }))

    const { error } = await supabase
      .from('flood_zones')
      .update({
        ...(updates.severity !== undefined && { severity: updates.severity }),
        ...(updates.depth    !== undefined && { depth:    updates.depth ?? null }),
        ...(updates.notes    !== undefined && { notes:    updates.notes ?? null }),
        ...(updates.polygon  !== undefined && { polygon:  updates.polygon }),
      })
      .eq('id', id)

    if (error) console.error('[LIGTAS] updateFloodZone:', error.message)
  },

  // ── Flood zone: delete a single persisted zone ────────────────────────
  deleteFloodZone: async (id) => {
    set((s) => ({ floodZones: s.floodZones.filter((z) => z.id !== id) }))

    const { error } = await supabase.from('flood_zones').delete().eq('id', id)
    if (error) console.error('[LIGTAS] deleteFloodZone:', error.message)
  },

  // ── Flood zone: delete all zones for current active hazard ────────────
  clearFloodZones: async (hazardEventId) => {
    const targetHazardId = hazardEventId
      ?? get().activeHazards.find((hazard) => hazard.type === 'Flood')?.id
      ?? get().activeHazard?.id
    if (!targetHazardId) return

    const { error } = await supabase
      .from('flood_zones')
      .delete()
      .eq('hazard_event_id', targetHazardId)

    if (error) console.error('[LIGTAS] clearFloodZones:', error.message)
    set({ floodZones: [], draftFloodZones: [] })
  },
}))
