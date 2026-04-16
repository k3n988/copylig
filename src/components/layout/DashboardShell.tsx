'use client'
// src/components/layout/DashboardShell.tsx
// Must be a Client Component so it can use dynamic() with ssr:false.

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { APIProvider } from '@vis.gl/react-google-maps'
import Sidebar from './Sidebar'
import { useHouseholdStore } from '@/store/householdStore'
import { useAssetStore } from '@/store/assetStore'
import { useAuthStore } from '@/store/authStore'
import { useHazardStore } from '@/store/hazardStore'
import { supabase } from '@/lib/supabase'
import GuestPanel from '@/components/public/GuestPanel'
import CitizenPanel from '@/components/public/CitizenPanel'

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#1b1b1b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.9rem',
      }}
    >
      Loading map…
    </div>
  ),
})

interface Props {
  children: React.ReactNode
}

export default function DashboardShell({ children }: Props) {
  const loadHouseholds  = useHouseholdStore((s) => s.loadHouseholds)
  const loadAssets      = useAssetStore((s) => s.loadAssets)
  const user            = useAuthStore((s) => s.user)
  const loadActiveHazard = useHazardStore((s) => s.loadActiveHazard)

  useEffect(() => {
    void loadHouseholds()
    void loadAssets()
    void loadActiveHazard()

    const channel = supabase
      .channel('ligtas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'households' },
        () => { void loadHouseholds() },
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' },
        () => { void loadAssets() },
      )
      // Real-time hazard sync — mobile and web both receive this
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hazard_events' },
        () => { void loadActiveHazard() },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [loadHouseholds, loadAssets, loadActiveHazard]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <div
        className="dashboard-grid"
        style={{
          background: 'var(--bg-base)',
        }}
      >
        <MapView />
        <Sidebar>
          {!user
            ? <GuestPanel />
            : user.role === 'citizen'
              ? <CitizenPanel />
              : children
          }
        </Sidebar>
      </div>
    </APIProvider>
  )
}
