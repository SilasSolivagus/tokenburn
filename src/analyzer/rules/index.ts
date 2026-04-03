import type { QueryFilter } from '../../db/db.js'
import { duplicateRequests } from './duplicate-requests.js'
import { modelOveruse } from './model-overuse.js'
import { contextExplosion } from './context-explosion.js'
import { lowCacheHit } from './low-cache-hit.js'
import { truncationWaste } from './truncation-waste.js'
import { idleChat } from './idle-chat.js'
import { lateNight } from './late-night.js'
import { retryStorm } from './retry-storm.js'

export type Severity = 'high' | 'medium' | 'low' | 'info'

export interface WasteDetection {
  rule: string
  severity: Severity
  wastedUSD: number
  savableUSD: number
  message: string
  detail: string
  suggestion: string
}

export type RuleFn = (filter: QueryFilter) => WasteDetection | null

const ALL_RULES: RuleFn[] = [
  duplicateRequests,
  modelOveruse,
  contextExplosion,
  lowCacheHit,
  truncationWaste,
  idleChat,
  lateNight,
  retryStorm,
]

const SEVERITY_ORDER: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2,
  info: 3,
}

export function runAllRules(filter: QueryFilter): WasteDetection[] {
  const results: WasteDetection[] = []
  for (const rule of ALL_RULES) {
    const detection = rule(filter)
    if (detection !== null) {
      results.push(detection)
    }
  }
  return results.sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (severityDiff !== 0) return severityDiff
    return b.wastedUSD - a.wastedUSD
  })
}
