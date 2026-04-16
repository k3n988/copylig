import { create } from 'zustand'

type NoahAnalysisStatus = 'idle' | 'loading' | 'ready' | 'error'

type LatLng = { lat: number; lng: number }

interface NoahFloodStore {
  setNoahAnalysis: (key: 'var1' | 'var2' | 'var3', data: any[]) => void
  setAnalysisData: (key: 'var1' | 'var2' | 'var3', data: any[]) => void
  visible: boolean
  analysisStatus: NoahAnalysisStatus
  analysisError: string | null
  var3PolygonCount: number
  var2PolygonCount: number
  var1PolygonCount: number
  var3Polygons: any[]
  var2Polygons: any[]
  var1Polygons: any[]
  setVisible: (visible: boolean) => void
  ensureAnalysisLoaded: () => Promise<void>
}

export const useNoahFloodStore = create<NoahFloodStore>((set, get) => ({
  visible:          true,
  analysisStatus:   'idle',
  analysisError:    null,
  var3PolygonCount: 0,
  var2PolygonCount: 0,
  var1PolygonCount: 0,
  var3Polygons:     [],
  var2Polygons:     [],
  var1Polygons:     [],

  setVisible: (visible) => set({ visible }),

  setNoahAnalysis: (key, data) => {
    const polyKey = `${key}Polygons` as const;
    set({
      [`${key}PolygonCount`]: data.length,
      [polyKey]: data.map((d: any) => d.geom)
    } as any);
  },

  setAnalysisData: (key, data) => {
    const countKey = `${key}PolygonCount` as const
    const polyKey = `${key}Polygons` as const
    set({
      [countKey]: data.length,
      [polyKey]: data.map(d => d.geom)
    } as any)
  },

  ensureAnalysisLoaded: async () => {
    const { analysisStatus } = get()
    if (analysisStatus !== 'idle') return

    // Province-wide flood geometry is too large to fetch client-side.
    // The visual NOAH layer renders via bounds-based Supabase RPCs in NoahFloodLayer.tsx.
    set({ analysisStatus: 'ready', analysisError: null })
  },
}))
