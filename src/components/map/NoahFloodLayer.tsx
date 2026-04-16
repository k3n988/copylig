'use client'

import { useEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { supabase } from '@/lib/supabase'

type NoahLayerStatus = 'idle' | 'loading' | 'ready'

interface Props {
  visible: boolean
  onStatusChange?: (status: NoahLayerStatus) => void
  onFeatureCountChange?: (count: number) => void
}

interface BandConfig {
  fillColor: string
  strokeColor: string
  fillOpacity: number
  strokeOpacity: number
  zIndex: number
}

const VAR3_STYLE: BandConfig = {
  fillColor: '#ff4d4d',
  strokeColor: '#c0392b',
  fillOpacity: 0.34,
  strokeOpacity: 0.5,
  zIndex: 8,
}

export default function NoahFloodLayer({
  visible,
  onStatusChange,
  onFeatureCountChange,
}: Props) {
  const map = useMap()

  const var3LayerRef = useRef<google.maps.Data | null>(null)
  const var3FeatureCountRef = useRef(0)
  const var3RequestRef = useRef(0)
  const var2LayerRef = useRef<google.maps.Data | null>(null)
  const var2FeatureCountRef = useRef(0)
  const var2RequestRef = useRef(0)
  const var1LayerRef = useRef<google.maps.Data | null>(null)
  const var1FeatureCountRef = useRef(0)
  const var1RequestRef = useRef(0)

  useEffect(() => {
    if (!map) return

    const updateFeatureCount = () => {
      onFeatureCountChange?.(var3FeatureCountRef.current + var2FeatureCountRef.current + var1FeatureCountRef.current)
    }

    if (!var3LayerRef.current) {
      var3LayerRef.current = new google.maps.Data()
      var3LayerRef.current.setStyle({
        fillColor: VAR3_STYLE.fillColor,
        fillOpacity: VAR3_STYLE.fillOpacity,
        strokeColor: VAR3_STYLE.strokeColor,
        strokeOpacity: VAR3_STYLE.strokeOpacity,
        strokeWeight: 1,
        clickable: false,
        zIndex: VAR3_STYLE.zIndex,
      })
    }

    if (!var1LayerRef.current) {
      var1LayerRef.current = new google.maps.Data()
      var1LayerRef.current.setStyle({
        fillColor: '#f1c40f',
        fillOpacity: 0.2,
        strokeColor: '#b7950b',
        strokeOpacity: 0.34,
        strokeWeight: 1,
        clickable: false,
        zIndex: 6,
      })
    }

    if (!var2LayerRef.current) {
      var2LayerRef.current = new google.maps.Data()
      var2LayerRef.current.setStyle({
        fillColor: '#ff8000',
        fillOpacity: 0.26,
        strokeColor: '#cc6600',
        strokeOpacity: 0.42,
        strokeWeight: 1,
        clickable: false,
        zIndex: 7,
      })
    }

    const var3Layer = var3LayerRef.current
    const var2Layer = var2LayerRef.current
    const var1Layer = var1LayerRef.current

    const clearVar3Layer = () => {
      const featuresToRemove: google.maps.Data.Feature[] = []
      var3Layer.forEach((feature) => {
        featuresToRemove.push(feature)
      })
      featuresToRemove.forEach((feature) => var3Layer.remove(feature))
      var3FeatureCountRef.current = 0
    }

    const clearVar2Layer = () => {
      const featuresToRemove: google.maps.Data.Feature[] = []
      var2Layer.forEach((feature) => {
        featuresToRemove.push(feature)
      })
      featuresToRemove.forEach((feature) => var2Layer.remove(feature))
      var2FeatureCountRef.current = 0
    }

    const clearVar1Layer = () => {
      const featuresToRemove: google.maps.Data.Feature[] = []
      var1Layer.forEach((feature) => {
        featuresToRemove.push(feature)
      })
      featuresToRemove.forEach((feature) => var1Layer.remove(feature))
      var1FeatureCountRef.current = 0
    }

    const loadVar3ForBounds = async () => {
      const bounds = map.getBounds()
      if (!bounds) return

      const southWest = bounds.getSouthWest()
      const northEast = bounds.getNorthEast()
      const requestId = var3RequestRef.current + 1
      var3RequestRef.current = requestId

      const { data, error } = await supabase.rpc('get_flood_var3_display_in_bounds', {
        min_lng: southWest.lng(),
        min_lat: southWest.lat(),
        max_lng: northEast.lng(),
        max_lat: northEast.lat(),
      })

      if (requestId !== var3RequestRef.current) return

      if (error) {
        console.warn('[LIGTAS] NoahFloodLayer skipped Var 3 Supabase bounds load:', error.message)
        clearVar3Layer()
        updateFeatureCount()
        return
      }

      clearVar3Layer()

      const featureCollection = {
        type: 'FeatureCollection',
        features: (data ?? [])
          .map((row: { id: number; geom: unknown }) => {
            const geometry = typeof row.geom === 'string' ? JSON.parse(row.geom) : row.geom
            return geometry
              ? {
                  type: 'Feature',
                  geometry,
                  properties: { id: row.id },
                }
              : null
          })
          .filter(Boolean),
      }

      const added = var3Layer.addGeoJson(featureCollection as object)
      var3FeatureCountRef.current = added.length
      updateFeatureCount()

      if (visible) {
        var3Layer.setMap(map)
      }
    }

    const loadVar2ForBounds = async () => {
      const bounds = map.getBounds()
      if (!bounds) return

      const southWest = bounds.getSouthWest()
      const northEast = bounds.getNorthEast()
      const requestId = var2RequestRef.current + 1
      var2RequestRef.current = requestId

      const { data, error } = await supabase.rpc('get_flood_var2_display_in_bounds', {
        min_lng: southWest.lng(),
        min_lat: southWest.lat(),
        max_lng: northEast.lng(),
        max_lat: northEast.lat(),
      })

      if (requestId !== var2RequestRef.current) return

      if (error) {
        console.warn('[LIGTAS] NoahFloodLayer skipped Var 2 Supabase bounds load:', error.message)
        clearVar2Layer()
        updateFeatureCount()
        return
      }

      clearVar2Layer()

      const featureCollection = {
        type: 'FeatureCollection',
        features: (data ?? [])
          .map((row: { id: number; geom: unknown }) => {
            const geometry = typeof row.geom === 'string' ? JSON.parse(row.geom) : row.geom
            return geometry
              ? {
                  type: 'Feature',
                  geometry,
                  properties: { id: row.id },
                }
              : null
          })
          .filter(Boolean),
      }

      const added = var2Layer.addGeoJson(featureCollection as object)
      var2FeatureCountRef.current = added.length
      updateFeatureCount()

      if (visible) {
        var2Layer.setMap(map)
      }
    }

    const loadVar1ForBounds = async () => {
      const bounds = map.getBounds()
      if (!bounds) return

      const southWest = bounds.getSouthWest()
      const northEast = bounds.getNorthEast()
      const requestId = var1RequestRef.current + 1
      var1RequestRef.current = requestId

      const { data, error } = await supabase.rpc('get_flood_var1_display_in_bounds', {
        min_lng: southWest.lng(),
        min_lat: southWest.lat(),
        max_lng: northEast.lng(),
        max_lat: northEast.lat(),
      })

      if (requestId !== var1RequestRef.current) return

      if (error) {
        console.warn('[LIGTAS] NoahFloodLayer skipped Var 1 Supabase bounds load:', error.message)
        clearVar1Layer()
        updateFeatureCount()
        return
      }

      clearVar1Layer()

      const featureCollection = {
        type: 'FeatureCollection',
        features: (data ?? [])
          .map((row: { id: number; geom: unknown }) => {
            const geometry = typeof row.geom === 'string' ? JSON.parse(row.geom) : row.geom
            return geometry
              ? {
                  type: 'Feature',
                  geometry,
                  properties: { id: row.id },
                }
              : null
          })
          .filter(Boolean),
      }

      const added = var1Layer.addGeoJson(featureCollection as object)
      var1FeatureCountRef.current = added.length
      updateFeatureCount()

      if (visible) {
        var1Layer.setMap(map)
      }
    }

    if (visible) {
      onStatusChange?.('loading')
      void Promise.all([
        loadVar3ForBounds(),
        loadVar2ForBounds(),
        loadVar1ForBounds(),
      ]).then(() => {
        onStatusChange?.('ready')
      })

      var3Layer.setMap(map)
      var2Layer.setMap(map)
      var1Layer.setMap(map)

      const idleListener = map.addListener('idle', () => {
        void loadVar3ForBounds()
        void loadVar2ForBounds()
        void loadVar1ForBounds()
      })

      return () => {
        google.maps.event.removeListener(idleListener)
        var3Layer.setMap(null)
        var2Layer.setMap(null)
        var1Layer.setMap(null)
      }
    } else {
      var3Layer.setMap(null)
      var2Layer.setMap(null)
      var1Layer.setMap(null)
      onStatusChange?.('idle')
    }

    return () => {
      var3Layer.setMap(null)
      var2Layer.setMap(null)
      var1Layer.setMap(null)
    }
  }, [map, onFeatureCountChange, onStatusChange, visible])

  useEffect(() => {
    return () => {
      var3LayerRef.current?.setMap(null)
      var2LayerRef.current?.setMap(null)
      var1LayerRef.current?.setMap(null)
    }
  }, [])

  return null
}
