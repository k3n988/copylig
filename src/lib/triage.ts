// src/lib/triage.ts

import type { TriageResult, Vulnerability } from '@/types'

export function assessTriage(vulnArr: Vulnerability[]): TriageResult {
  const has = (v: Vulnerability) => vulnArr.includes(v)

  if (has('Bedridden') || has('Oxygen') || has('Dialysis')) {
    return { level: 'CRITICAL', hex: '#ff4d4d', colorName: 'red' }
  }
  if (has('Wheelchair') || has('Senior')) {
    return { level: 'HIGH', hex: '#ff8000', colorName: 'orange' }
  }
  if (has('Pregnant') || has('Infant') || has('PWD')) {
    return { level: 'ELEVATED', hex: '#f1c40f', colorName: 'yellow' }
  }
  return { level: 'STABLE', hex: '#58a6ff', colorName: 'blue' }
}

export const TRIAGE_ORDER: Record<string, number> = {
  CRITICAL: 1,
  HIGH: 2,
  ELEVATED: 3,
  STABLE: 4,
}
