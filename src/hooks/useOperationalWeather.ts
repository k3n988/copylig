'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  buildWeatherQuery,
  DEFAULT_WEATHER_COORDS,
  normalizeWeatherCoords,
  type WeatherCoords,
  type WeatherResponse,
} from '@/lib/weather'

interface UseOperationalWeatherOptions {
  coords?: WeatherCoords | null
  enabled?: boolean
  debounceMs?: number
  refreshMs?: number
  fallbackCoords?: WeatherCoords
}

interface WeatherErrorPayload {
  error?: string
  debug?: {
    upstreamStatus?: number
    upstreamMessage?: string | null
    upstreamCode?: number | string | null
  }
}

export function useOperationalWeather({
  coords,
  enabled = true,
  debounceMs = 900,
  refreshMs = 10 * 60 * 1000,
  fallbackCoords = DEFAULT_WEATHER_COORDS,
}: UseOperationalWeatherOptions) {
  const effectiveCoords = useMemo(
    () => normalizeWeatherCoords(coords ?? fallbackCoords),
    [coords, fallbackCoords],
  )

  const [debouncedCoords, setDebouncedCoords] = useState(effectiveCoords)
  const [weather, setWeather] = useState<WeatherResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedCoords(effectiveCoords)
    }, debounceMs)

    return () => window.clearTimeout(timeoutId)
  }, [effectiveCoords, debounceMs])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let activeController: AbortController | null = null

    async function loadWeather(refresh = false) {
      activeController?.abort()
      const controller = new AbortController()
      activeController = controller

      try {
        if (refresh) setIsRefreshing(true)
        else setIsLoading(true)

        setError(null)
        const { query } = buildWeatherQuery(debouncedCoords)
        const response = await fetch(`/api/weather?${query}`, {
          signal: controller.signal,
          cache: 'no-store',
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null) as WeatherErrorPayload | null
          const debugMessage = payload?.debug?.upstreamMessage
          const baseMessage = payload?.error ?? 'Failed to load operational weather data.'
          throw new Error(debugMessage ? `${baseMessage} ${debugMessage}` : baseMessage)
        }

        const data: WeatherResponse = await response.json()

        if (!cancelled) {
          setWeather(data)
        }
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Operational weather is temporarily unavailable.')
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    }

    void loadWeather(false)
    const intervalId = window.setInterval(() => {
      void loadWeather(true)
    }, refreshMs)

    return () => {
      cancelled = true
      activeController?.abort()
      window.clearInterval(intervalId)
    }
  }, [debouncedCoords, enabled, refreshMs])

  return {
    weather,
    error,
    isLoading,
    isRefreshing,
    coords: debouncedCoords,
  }
}
