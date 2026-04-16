// src/store/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

async function hashPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password + 'LIGTAS_SALT_2025')
  const hash = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

interface AuthUser {
  contact: string
  role: 'admin' | 'citizen' | 'rescuer'
  // For rescuers: the asset id they belong to
  assetId?: string
}

interface AuthStore {
  user: AuthUser | null
  loading: boolean
  showModal: boolean
  authTab: 'login' | 'signup'
  setShowModal: (v: boolean) => void
  setAuthTab: (tab: 'login' | 'signup') => void
  signUp: (contact: string, password: string) => Promise<string | null>
  login: (contact: string, password: string) => Promise<string | null>
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      loading: false,
      showModal: false,
      authTab: 'login',

      setShowModal: (v) => set({ showModal: v }),
      setAuthTab: (tab) => set({ authTab: tab }),

      signUp: async (contact, password) => {
        set({ loading: true })
        try {
          const isEmail = contact.includes('@')

          if (isEmail) {
            // SIGN UP VIA SUPABASE AUTH (For Admins/Email users)
            const { error } = await supabase.auth.signUp({
              email: contact,
              password: password,
            })
            if (error) {
              set({ loading: false })
              return error.message
            }
          } else {
            // SIGN UP VIA CUSTOM TABLE (For Household Members / Citizens only)
            // Note: Rescuers are registered via AddAssetForm by the admin, not here.
            const passwordHash = await hashPassword(password)
            const { error } = await supabase
              .from('households')
              .insert({ contact, citizen_password_hash: passwordHash })

            if (error) {
              set({ loading: false })
              if (error.code === '23505')
                return 'This contact number already has an account.'
              return error.message
            }
          }

          const role = contact.includes('@') ? 'admin' : 'citizen'
          set({ user: { contact, role }, loading: false })
          return null
        } catch {
          set({ loading: false })
          return 'Sign up failed. Please try again.'
        }
      },

      login: async (contact, password) => {
        set({ loading: true })
        try {
          const isEmail = contact.includes('@')

          if (isEmail) {
            // ── ADMIN LOGIN via Supabase Auth ────────────────────────────
            const { data, error } = await supabase.auth.signInWithPassword({
              email: contact,
              password: password,
            })

            if (error || !data.user) {
              set({ loading: false })
              return 'Invalid admin email or password.'
            }

            set({ user: { contact, role: 'admin' }, loading: false })
            return null
          }

          // ── PHONE-BASED LOGIN ─────────────────────────────────────────
          const passwordHash = await hashPassword(password)

          // 1. Check assets table first (Rescuer)
          const { data: assetData, error: assetError } = await supabase
            .from('assets')
            .select('id, contact')
            .eq('contact', contact)
            .eq('asset_password_hash', passwordHash)
            .single()

          if (!assetError && assetData) {
            // ✅ Found in assets → Rescuer
            set({
              user: { contact, role: 'rescuer', assetId: assetData.id },
              loading: false,
            })
            return null
          }

          // 2. Fall back to households table (Citizen)
          const { data: householdData, error: householdError } = await supabase
            .from('households')
            .select('contact')
            .eq('contact', contact)
            .eq('citizen_password_hash', passwordHash)
            .single()

          if (!householdError && householdData) {
            // ✅ Found in households → Citizen
            set({ user: { contact, role: 'citizen' }, loading: false })
            return null
          }

          // ❌ Not found in either table
          set({ loading: false })
          return 'Invalid contact number or password.'
        } catch {
          set({ loading: false })
          return 'Login failed. Please try again.'
        }
      },

      logout: async () => {
        // Sign out from Supabase Auth (cleans up admin session)
        await supabase.auth.signOut()
        set({ user: null })
      },
    }),
    { name: 'ligtas-auth' },
  ),
)