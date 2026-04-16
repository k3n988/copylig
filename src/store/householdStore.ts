// src/store/householdStore.ts

import { create } from 'zustand'
import type { Household } from '@/types'
import { supabase, rowToHousehold, householdToRow } from '@/lib/supabase'

interface HouseholdStore {
  households: Household[]
  panToId: string | null
  panToCoords: { lat: number; lng: number; zoom?: number } | null
  selectedId: string | null
  pickingLocation: boolean
  pendingCoords: { lat: number; lng: number } | null
  loadHouseholds: () => Promise<void>
  addHousehold: (h: Household) => Promise<void>
  updateHousehold: (id: string, patch: Partial<Household>) => Promise<void>
  deleteHousehold: (id: string) => Promise<void>
  approveHousehold: (id: string) => Promise<void>
  rejectHousehold: (id: string) => Promise<void>
  markRescued: (id: string) => Promise<void>
  restorePending: (id: string) => Promise<void>
  setPanTo: (id: string | null) => void
  setPanToCoords: (c: { lat: number; lng: number; zoom?: number } | null) => void
  setSelectedId: (id: string | null) => void
  dispatchRescue: (householdId: string, assetId: string) => Promise<void>
  setPickingLocation: (v: boolean) => void
  setPendingCoords: (c: { lat: number; lng: number } | null) => void
}

export const useHouseholdStore = create<HouseholdStore>((set) => ({
  households: [],
  panToId: null,
  panToCoords: null,
  selectedId: null,
  pickingLocation: false,
  pendingCoords: null,

  loadHouseholds: async () => {
    const { data, error } = await supabase
      .from('households')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { console.error('[LIGTAS] loadHouseholds:', error.message); return }
    set({ households: (data ?? []).map(rowToHousehold) })
  },

  addHousehold: async (h) => {
    // Optimistic — show immediately in UI
    set((s) => ({ households: [h, ...s.households] }))
    const { error } = await supabase.from('households').insert(householdToRow(h))
    if (error) {
      console.error('[LIGTAS] addHousehold:', error.message)
      // Roll back on failure
      set((s) => ({ households: s.households.filter((hh) => hh.id !== h.id) }))
      throw error
    }
  },

  markRescued: async (id) => {
    set((s) => ({
      households: s.households.map((hh) =>
        hh.id === id ? { ...hh, status: 'Rescued' as const } : hh,
      ),
    }))
    const { error } = await supabase
      .from('households').update({ status: 'Rescued' }).eq('id', id)
    if (error) console.error('[LIGTAS] markRescued:', error.message)
  },

  restorePending: async (id) => {
    set((s) => ({
      households: s.households.map((hh) =>
        hh.id === id ? { ...hh, status: 'Pending' as const } : hh,
      ),
    }))
    const { error } = await supabase
      .from('households').update({ status: 'Pending' }).eq('id', id)
    if (error) console.error('[LIGTAS] restorePending:', error.message)
  },

  setPanTo: (id) => set({ panToId: id }),
  setPanToCoords: (c) => set({ panToCoords: c }),
  setSelectedId: (id) => set({ selectedId: id }),

  dispatchRescue: async (householdId, assetId) => {
    const dispatchedAt = new Date().toISOString()
    set((s) => ({
      households: s.households.map((hh) =>
        hh.id === householdId
          ? { ...hh, assignedAssetId: assetId, dispatchedAt }
          : hh,
      ),
    }))
    const { error } = await supabase
      .from('households')
      .update({ assigned_asset_id: assetId, dispatched_at: dispatchedAt })
      .eq('id', householdId)
    if (error) console.error('[LIGTAS] dispatchRescue:', error.message)
  },

  updateHousehold: async (id, patch) => {
    set((s) => ({
      households: s.households.map((hh) => hh.id === id ? { ...hh, ...patch } : hh),
    }))
    const { error } = await supabase
      .from('households')
      .update({
        head:             patch.head,
        contact:          patch.contact,
        occupants:        patch.occupants,
        notes:            patch.notes,
        source:           patch.source ?? null,
        status:           patch.status,
        vuln_arr:         patch.vulnArr,
        triage_level:     patch.triage?.level,
        triage_hex:       patch.triage?.hex,
        triage_color_name: patch.triage?.colorName,
      })
      .eq('id', id)
    if (error) console.error('[LIGTAS] updateHousehold:', error.message)
  },

  deleteHousehold: async (id) => {
    set((s) => ({ households: s.households.filter((hh) => hh.id !== id) }))
    const { error } = await supabase.from('households').delete().eq('id', id)
    if (error) console.error('[LIGTAS] deleteHousehold:', error.message)
  },

  approveHousehold: async (id) => {
    set((s) => ({
      households: s.households.map((hh) =>
        hh.id === id ? { ...hh, approvalStatus: 'approved' as const } : hh,
      ),
    }))
    const { error } = await supabase
      .from('households').update({ approval_status: 'approved' }).eq('id', id)
    if (error) console.error('[LIGTAS] approveHousehold:', error.message)
  },

  rejectHousehold: async (id) => {
    set((s) => ({ households: s.households.filter((hh) => hh.id !== id) }))
    const { error } = await supabase.from('households').delete().eq('id', id)
    if (error) console.error('[LIGTAS] rejectHousehold:', error.message)
  },

  setPickingLocation: (v) => set({ pickingLocation: v }),
  setPendingCoords: (c) => set({ pendingCoords: c }),
}))
