'use client'
// src/components/map/FloodDrawingManager.tsx
// Imperative wrapper around Google Maps DrawingManager for polygon mode.
// Renders nothing — all side effects happen via the Maps API.

import { useEffect, useRef } from 'react'
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps'

interface Props {
  /** When true, drawing mode is active. When false, it is disabled. */
  active: boolean
  /** Called once with the simplified polygon path when the user completes a polygon. */
  onPolygonComplete: (coords: Array<{ lat: number; lng: number }>) => void
}

// ── Douglas-Peucker polygon simplification ────────────────────────────────
// Works in lat/lng space. Tolerance ~0.00015° ≈ 15 m — enough to remove
// click noise while keeping the drawn shape visually accurate.

type Pt = { lat: number; lng: number }

function perpDistance(pt: Pt, a: Pt, b: Pt): number {
  const dx = b.lat - a.lat
  const dy = b.lng - a.lng
  const mag = Math.sqrt(dx * dx + dy * dy)
  if (mag === 0) return Math.sqrt((pt.lat - a.lat) ** 2 + (pt.lng - a.lng) ** 2)
  return Math.abs(dx * (a.lng - pt.lng) - dy * (a.lat - pt.lat)) / mag
}

function douglasPeucker(pts: Pt[], tol: number): Pt[] {
  if (pts.length <= 2) return pts
  let maxDist = 0
  let maxIdx  = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDistance(pts[i], pts[0], pts[pts.length - 1])
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }
  if (maxDist > tol) {
    const left  = douglasPeucker(pts.slice(0, maxIdx + 1), tol)
    const right = douglasPeucker(pts.slice(maxIdx), tol)
    return [...left.slice(0, -1), ...right]
  }
  return [pts[0], pts[pts.length - 1]]
}

function simplifyPolygon(pts: Pt[]): Pt[] {
  const simplified = douglasPeucker(pts, 0.00015)
  // Fall back to original if simplification collapses the polygon below 3 pts
  return simplified.length >= 3 ? simplified : pts
}

// ─────────────────────────────────────────────────────────────────────────────

export default function FloodDrawingManager({ active, onPolygonComplete }: Props) {
  const map         = useMap()
  const drawingLib  = useMapsLibrary('drawing')
  const managerRef  = useRef<google.maps.drawing.DrawingManager | null>(null)
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null)

  useEffect(() => {
    if (!map || !drawingLib) return

    // Create the DrawingManager once
    if (!managerRef.current) {
      managerRef.current = new drawingLib.DrawingManager({
        drawingControl: false,
        polygonOptions: {
          fillColor:     '#58a6ff',
          fillOpacity:   0.12,
          strokeColor:   '#58a6ff',
          strokeOpacity: 0.85,
          strokeWeight:  2,
          clickable:     false,
          editable:      false,
        },
      })
    }

    const manager = managerRef.current

    if (active) {
      manager.setMap(map)
      manager.setDrawingMode(drawingLib.OverlayType.POLYGON)

      if (listenerRef.current) google.maps.event.removeListener(listenerRef.current)

      listenerRef.current = manager.addListener(
        'polygoncomplete',
        (polygon: google.maps.Polygon) => {
          const path   = polygon.getPath()
          const raw    = Array.from({ length: path.getLength() }, (_, i) => {
            const pt = path.getAt(i)
            return { lat: pt.lat(), lng: pt.lng() }
          })

          // Remove the temporary drawn polygon immediately — we re-render via store
          polygon.setMap(null)
          manager.setDrawingMode(null)

          // Simplify before handing off to remove click noise
          onPolygonComplete(simplifyPolygon(raw))
        },
      )
    } else {
      manager.setDrawingMode(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, map, drawingLib])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (listenerRef.current) google.maps.event.removeListener(listenerRef.current)
      if (managerRef.current)  managerRef.current.setMap(null)
    }
  }, [])

  return null
}
