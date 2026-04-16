// src/components/triage/TriageBadge.tsx

import type { TriageResult } from '@/types'

interface Props {
  triage: TriageResult
  rescued?: boolean
}

export default function TriageBadge({ triage, rescued }: Props) {
  const color = rescued ? '#238636' : triage.hex
  const label = rescued ? 'RESCUED' : triage.level

  return (
    <span
      style={{
        fontSize: '0.7rem',
        fontWeight: 'bold',
        color,
        letterSpacing: 1,
      }}
    >
      {label}
    </span>
  )
}
