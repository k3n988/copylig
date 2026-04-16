import 'server-only'

export interface SendTextBeeSmsParams {
  to: string
  message: string
}

export interface SendTextBeeSmsResult {
  success: boolean
  normalizedTo: string
  providerResponse: unknown
}

function getRequiredEnv(name: 'TEXTBEE_API_KEY' | 'TEXTBEE_DEVICE_ID' | 'TEXTBEE_BASE_URL'): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`[LIGTAS][TextBee] Missing required environment variable: ${name}`)
  }
  return value
}

export function normalizePhMobileNumber(input: string): string {
  const digits = input.replace(/[^\d+]/g, '')

  if (/^09\d{9}$/.test(digits)) {
    return `+63${digits.slice(1)}`
  }

  if (/^\+639\d{9}$/.test(digits)) {
    return digits
  }

  throw new Error('[LIGTAS][TextBee] Invalid PH mobile number format.')
}

export async function sendTextBeeSms({ to, message }: SendTextBeeSmsParams): Promise<SendTextBeeSmsResult> {
  const apiKey = getRequiredEnv('TEXTBEE_API_KEY')
  const deviceId = getRequiredEnv('TEXTBEE_DEVICE_ID')
  const baseUrl = getRequiredEnv('TEXTBEE_BASE_URL').replace(/\/+$/, '')
  const normalizedTo = normalizePhMobileNumber(to)

  const response = await fetch(`${baseUrl}/gateway/devices/${deviceId}/send-sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      recipients: [normalizedTo],
      message,
    }),
    cache: 'no-store',
  })

  const rawText = await response.text()
  let providerResponse: unknown = rawText

  if (rawText) {
    try {
      providerResponse = JSON.parse(rawText)
    } catch {
      providerResponse = rawText
    }
  }

  if (!response.ok) {
    throw new Error(
      `[LIGTAS][TextBee] SMS request failed with status ${response.status}: ${typeof providerResponse === 'string' ? providerResponse : JSON.stringify(providerResponse)}`,
    )
  }

  return {
    success: true,
    normalizedTo,
    providerResponse,
  }
}
