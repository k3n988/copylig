'use client'

import { useEffect, useState } from 'react'

const DEFAULT_COORDS = { lat: 10.6765, lon: 122.9509 }

type WeatherData = {
  location: string
  country: string
  temperatureC: number | null
  feelsLikeC: number | null
  humidity: number | null
  windSpeedMps: number | null
  condition: string
  description: string
  icon: string | null
  rain1h: number
  updatedAt: string | null
}

function formatNumber(value: number | null, suffix: string) {
  if (value == null) return '--'
  return `${Math.round(value)}${suffix}`
}

export default function WeatherStrip() {
  const [coords, setCoords] = useState(DEFAULT_COORDS)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
      },
      () => {
        // Keep default coordinates when location access is denied.
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }, [])

  useEffect(() => {
    let ignore = false

    async function loadWeather() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/weather?lat=${coords.lat}&lon=${coords.lon}`)

        if (!response.ok) {
          throw new Error('Failed to load weather')
        }

        const data: WeatherData = await response.json()
        if (!ignore) setWeather(data)
      } catch {
        if (!ignore) setError('Weather unavailable')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void loadWeather()
    const intervalId = window.setInterval(loadWeather, 10 * 60 * 1000)

    return () => {
      ignore = true
      window.clearInterval(intervalId)
    }
  }, [coords.lat, coords.lon])

  const iconUrl = weather?.icon
    ? `https://openweathermap.org/img/wn/${weather.icon}@2x.png`
    : null

  return (
    <div
      style={{
        padding: '10px 14px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        minHeight: 62,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'var(--bg-inset)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iconUrl} alt={weather?.condition ?? 'Weather'} width={44} height={44} />
          ) : (
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>WX</span>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Live Weather
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--fg-default)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {loading ? 'Loading current conditions...' : error ?? `${weather?.location}, ${weather?.country}`}
          </div>
          {!loading && !error && (
            <div style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', textTransform: 'capitalize' }}>
              {weather?.description}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, flexWrap: 'wrap', marginLeft: 'auto' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.05rem', color: 'var(--fg-success)', fontWeight: 800 }}>
            {loading ? '--' : formatNumber(weather?.temperatureC ?? null, ' C')}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>
            Feels like {loading ? '--' : formatNumber(weather?.feelsLikeC ?? null, ' deg')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, color: 'var(--fg-default)', fontSize: '0.72rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span>Humidity {loading ? '--' : formatNumber(weather?.humidity ?? null, '%')}</span>
          <span>Wind {loading ? '--' : formatNumber(weather?.windSpeedMps ?? null, ' m/s')}</span>
          <span>Rain {loading ? '--' : formatNumber(weather?.rain1h ?? null, ' mm')}</span>
        </div>
      </div>
    </div>
  )
}
