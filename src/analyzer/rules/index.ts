import type { QueryFilter } from '../../db/db.js'
import { duplicateRequests } from './duplicate-requests.js'
import { modelOveruse } from './model-overuse.js'
import { contextExplosion } from './context-explosion.js'
import { lowCacheHit } from './low-cache-hit.js'
import { truncationWaste } from './truncation-waste.js'
import { idleChat } from './idle-chat.js'
import { lateNight } from './late-night.js'
import { retryStorm } from './retry-storm.js'
import { giantRequest } from './giant-request.js'
import { wastedOutput } from './wasted-output.js'
import { modelSwitching } from './model-switching.js'
import { longTailSession } from './long-tail-session.js'
import { rejectedGeneration } from './rejected-generation.js'
import { largeFileReread } from './large-file-reread.js'
import { concurrentWaste } from './concurrent-waste.js'
import { lowTokenDensity } from './low-token-density.js'
import { providerPriceGap } from './provider-price-gap.js'

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
  { name: 'giant-request', description: 'Single requests costing >$2', fn: giantRequest },
  { name: 'wasted-output', description: 'Tool calls with redundant long output text', fn: wastedOutput },
  { name: 'model-switching', description: 'Sessions switching between 3+ models', fn: modelSwitching },
  { name: 'long-tail-session', description: 'Sessions lasting >2 hours', fn: longTailSession },
  { name: 'rejected-generation', description: 'Quick re-sends after success', fn: rejectedGeneration },
  { name: 'large-file-reread', description: 'Same large context sent 3+ times', fn: largeFileReread },
  { name: 'concurrent-waste', description: 'Same prompt sent 2+ times in same second', fn: concurrentWaste },
  { name: 'low-token-density', description: 'High output with no tool use', fn: lowTokenDensity },
  { name: 'provider-price-gap', description: 'Provider cost difference >1.5x', fn: providerPriceGap },
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
