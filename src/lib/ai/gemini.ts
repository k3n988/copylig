import 'server-only'

const RAILWAY_URL = process.env.RAILWAY_URL ?? 'https://ligtas-production.up.railway.app'

export async function maybeGenerateGeminiJson<T>(input: {
  prompt: string
  schema: object
}): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(`${RAILWAY_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: `${input.prompt}\n\nRespond ONLY with a valid JSON object matching this structure: ${JSON.stringify(input.schema)}. No explanation, no markdown, just the raw JSON.`,
          },
        ],
      }),
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) return null

    const data = (await response.json()) as { reply?: string }
    const raw = data?.reply?.trim()
    if (!raw) return null

    // Strip markdown code fences if the model wraps the JSON
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    try {
      return JSON.parse(cleaned) as T
    } catch {
      return null
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
