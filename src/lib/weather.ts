export interface WeatherCoords {
  lat: number
  lon: number
}

export interface WeatherForecastStep {
  time: string
  temperatureC: number | null
  condition: string
  description: string
  icon: string | null
  rainMm: number
  cloudiness: number | null
  precipitationChance: number | null
}

export type FloodRiskLevel = 'normal' | 'guarded' | 'elevated'

export interface WeatherResponse {
  coords: WeatherCoords
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
  cloudiness: number | null
  visibilityM: number | null
  updatedAt: string | null
  next3hRainMm: number
  next6hRainMm: number
  next12hRainMm: number
  forecast: WeatherForecastStep[]
  floodRiskLevel: FloodRiskLevel
  floodRiskTitle: string
  floodRiskMessage: string
  shouldSurfaceFloodRisk: boolean
}

export const DEFAULT_WEATHER_COORDS: WeatherCoords = {
  lat: 10.6765,
  lon: 122.9509,
}

export function normalizeWeatherCoords(coords: WeatherCoords): WeatherCoords {
  return {
    lat: Number(coords.lat.toFixed(3)),
    lon: Number(coords.lon.toFixed(3)),
  }
}

export function buildWeatherQuery(coords: WeatherCoords) {
  const normalized = normalizeWeatherCoords(coords)
  const query = new URLSearchParams({
    lat: String(normalized.lat),
    lon: String(normalized.lon),
  })

  return {
    coords: normalized,
    query: query.toString(),
  }
}

export function formatWeatherMetric(value: number | null, suffix: string) {
  if (value == null) return '--'
  return `${Math.round(value)}${suffix}`
}
