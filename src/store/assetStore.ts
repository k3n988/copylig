// src/store/assetStore.ts

import { create } from 'zustand'
import type { Asset } from '@/types'
import { supabase } from '@/lib/supabase'

interface AssetStore {
  assets: Asset[]
  loadAssets: () => Promise<void>
  addAsset: (a: Asset) => Promise<void>
  setAssetStatus: (id: string, status: Asset['status']) => Promise<void>
  // ETO YUNG MGA DINAGDAG NATIN
  deleteAsset: (id: string) => Promise<void>
  updateAsset: (id: string, data: Partial<Asset>) => Promise<void>
}

export const useAssetStore = create<AssetStore>((set, get) => ({
  assets: [],

  loadAssets: async () => {
    const { data, error } = await supabase.from('assets').select('*').order('id')
    if (error) { console.error('[LIGTAS] loadAssets:', error.message); return }
    set({ assets: (data ?? []) as Asset[] })
  },

  addAsset: async (a) => {
    set((s) => ({ assets: [...s.assets, a] }))
    const { id, name, type, unit, status, lat, lng, icon, contact, assetPasswordHash } = a
    const { error } = await supabase.from('assets').insert({
      id, name, type, unit, status, lat, lng, icon,
      contact:             contact             ?? null,
      asset_password_hash: assetPasswordHash   ?? null,
    })
    if (error) {
      console.error('[LIGTAS] addAsset:', error.message)
      // Rollback kung nag-error sa database
      set((s) => ({ assets: s.assets.filter((x) => x.id !== a.id) }))
      throw error
    }
  },

  setAssetStatus: async (id, status) => {
    set((s) => ({
      assets: s.assets.map((a) => (a.id === id ? { ...a, status } : a)),
    }))
    const { error } = await supabase.from('assets').update({ status }).eq('id', id)
    if (error) console.error('[LIGTAS] setAssetStatus:', error.message)
  },

  // --- BAGONG FUNCTION PARA SA PAG-DELETE ---
  deleteAsset: async (id) => {
    // 1. I-save muna yung current state in case mag-error at kailangang ibalik (Rollback)
    const previousAssets = get().assets;

    // 2. Tanggalin na agad sa screen (Optimistic Update)
    set((s) => ({
      assets: s.assets.filter((a) => a.id !== id)
    }))

    // 3. Tanggalin sa Supabase database
    const { error } = await supabase.from('assets').delete().eq('id', id)
    
    // 4. Kung may error sa Supabase, ibalik sa dati yung screen
    if (error) {
      console.error('[LIGTAS] deleteAsset:', error.message)
      set({ assets: previousAssets })
      throw error
    }
  },

  // --- BAGONG FUNCTION PARA SA PAG-EDIT (Handa na rin para sa Edit Button mo) ---
  updateAsset: async (id, data) => {
    const previousAssets = get().assets;

    set((s) => ({
      assets: s.assets.map((a) => (a.id === id ? { ...a, ...data } : a)),
    }))

    const { name, type, unit, status, lat, lng, icon } = data
    const patch = Object.fromEntries(
      Object.entries({ name, type, unit, status, lat, lng, icon }).filter(([, v]) => v !== undefined)
    )
    const { error } = await supabase.from('assets').update(patch).eq('id', id)
    
    if (error) {
      console.error('[LIGTAS] updateAsset:', error.message)
      set({ assets: previousAssets })
      throw error
    }
  },
}))