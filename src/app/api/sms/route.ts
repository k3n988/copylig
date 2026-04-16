import { NextRequest, NextResponse } from 'next/server'
import { sendTextBeeSms } from '@/lib/textbee'

interface SmsRequestBody {
  to?: string
  message?: string
}

export async function POST(request: NextRequest) {
  let body: SmsRequestBody

  try {
    body = (await request.json()) as SmsRequestBody
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body.' },
      { status: 400 },
    )
  }

  const to = body.to?.trim()
  const message = body.message?.trim()

  if (!to || !message) {
    return NextResponse.json(
      { success: false, error: '`to` and `message` are required.' },
      { status: 400 },
    )
  }

  try {
    const result = await sendTextBeeSms({ to, message })

    return NextResponse.json({
      success: true,
      to: result.normalizedTo,
      providerResponse: result.providerResponse,
    })
  } catch (error) {
    console.error('[LIGTAS][SMS API] Failed to send SMS:', error)

    return NextResponse.json(
      {
        success: false,
        warning: 'Save succeeded, but SMS delivery failed.',
      },
      { status: 502 },
    )
  }
}
