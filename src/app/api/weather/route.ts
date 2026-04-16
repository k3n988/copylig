import { NextRequest, NextResponse } from 'next/server'

const OPENWEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather'

export async function GET(request: NextRequest) {
  const apiKey = process.env.WEATHER_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Weather API key is not configured.' },
      { status: 500 },
    )
  }

  const lat = Number(request.nextUrl.searchParams.get('lat'))
  const lon = Number(request.nextUrl.searchParams.get('lon'))

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: 'Valid lat and lon query parameters are required.' },
      { status: 400 },
    )
  }

  const weatherUrl = new URL(OPENWEATHER_URL)
  weatherUrl.searchParams.set('lat', String(lat))
  weatherUrl.searchParams.set('lon', String(lon))
  weatherUrl.searchParams.set('appid', apiKey)
  weatherUrl.searchParams.set('units', 'metric')

  try {
    const response = await fetch(weatherUrl.toString(), {
      next: { revalidate: 600 },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Weather service request failed.' },
        { status: response.status },
      )
    }

    const data = await response.json()

    return NextResponse.json({
      location: data.name ?? 'Unknown location',
      country: data.sys?.country ?? '',
      temperatureC: data.main?.temp ?? null,
      feelsLikeC: data.main?.feels_like ?? null,
      humidity: data.main?.humidity ?? null,
      windSpeedMps: data.wind?.speed ?? null,
      condition: data.weather?.[0]?.main ?? 'Unknown',
      description: data.weather?.[0]?.description ?? '',
      icon: data.weather?.[0]?.icon ?? null,
      rain1h: data.rain?.['1h'] ?? 0,
      updatedAt: data.dt ? new Date(data.dt * 1000).toISOString() : null,
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to reach the weather service.' },
      { status: 502 },
    )
  }
}
