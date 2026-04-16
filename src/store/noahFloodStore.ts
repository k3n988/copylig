import { create } from 'zustand'

type NoahAnalysisStatus = 'idle' | 'loading' | 'ready' | 'error'

type LatLng = { lat: number; lng: number }

interface NoahFloodStore {
  visible: boolean
  analysisStatus: NoahAnalysisStatus
  analysisError: string | null
  var3PolygonCount: number
  var2PolygonCount: number
  var1PolygonCount: number
  var3Polygons: Array<Array<LatLng>>
  var2Polygons: Array<Array<LatLng>>
  var1Polygons: Array<Array<LatLng>>
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

  ensureAnalysisLoaded: async () => {
    const { analysisStatus } = get()
    if (analysisStatus !== 'idle') return

    // Province-wide flood geometry is too large to fetch client-side.
    // The visual NOAH layer renders via bounds-based Supabase RPCs in NoahFloodLayer.tsx.
    set({ analysisStatus: 'ready', analysisError: null })
  },
}))
