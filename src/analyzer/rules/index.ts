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
  fix?: string
}

export type RuleFn = (filter: QueryFilter) => WasteDetection | null

export interface RuleEntry {
  name: string
  description: string
  fn: RuleFn
}

const ALL_RULES: RuleEntry[] = [
  { name: 'duplicate-requests', description: 'Detect repeated identical prompts', fn: duplicateRequests },
  { name: 'model-overuse', description: 'Expensive models for short outputs', fn: modelOveruse },
  { name: 'context-explosion', description: 'Too many requests with >100k input tokens', fn: contextExplosion },
  { name: 'low-cache-hit', description: 'Cache hit rate below 10%', fn: lowCacheHit },
  { name: 'truncation-waste', description: 'Responses truncated by max_tokens', fn: truncationWaste },
  { name: 'idle-chat', description: '3+ turns without tool use', fn: idleChat },
  { name: 'late-night', description: 'Requests between 1-5am', fn: lateNight },
  { name: 'retry-storm', description: 'Rapid retries within 5 seconds', fn: retryStorm },
]

export function listRules(): RuleEntry[] {
  return ALL_RULES
}

const SEVERITY_ORDER: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2,
  info: 3,
}

export function runAllRules(filter: QueryFilter, disabledRules: string[] = []): WasteDetection[] {
  const results: WasteDetection[] = []
  for (const entry of ALL_RULES) {
    if (disabledRules.includes(entry.name)) continue
    const detection = entry.fn(filter)
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
