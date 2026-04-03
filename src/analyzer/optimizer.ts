import { type QueryFilter, queryRequests } from '../db/db.js'
import { calculateCost } from '../pricing/cost.js'
import { summarize } from './analyzer.js'
import { runAllRules } from './rules/index.js'

export interface OptimizationPlan {
  name: string
  description: string
  savingsUSD: number
  savingsPercent: number
  fix?: string
}

export interface SimulationResult {
  targetModel: string
  currentCost: number
  simulatedCost: number
  savings: number
  savingsPercent: number
  requestCount: number
  warning?: string
}

export function generateOptimizations(filter: QueryFilter): OptimizationPlan[] {
  const detections = runAllRules(filter)
  const summary = summarize(filter)
  const plans: OptimizationPlan[] = []
  for (const d of detections) {
    if (d.savableUSD > 0) {
      plans.push({
        name: d.rule, description: d.message,
        savingsUSD: d.savableUSD,
        savingsPercent: summary.totalCost > 0 ? (d.savableUSD / summary.totalCost) * 100 : 0,
        fix: d.fix,
      })
    }
  }
  return plans.sort((a, b) => b.savingsUSD - a.savingsUSD)
}

export function simulateModel(filter: QueryFilter, targetModel: string): SimulationResult {
  const records = queryRequests(filter)
  let currentCost = 0, simulatedCost = 0, highOutputCount = 0
  for (const r of records) {
    currentCost += r.costUSD
    simulatedCost += calculateCost(targetModel, {
      inputTokens: r.inputTokens, outputTokens: r.outputTokens,
      cacheReadTokens: r.cacheReadTokens, cacheWriteTokens: r.cacheWriteTokens,
    })
    if (r.outputTokens > 2000) highOutputCount++
  }
  const savings = Math.max(0, currentCost - simulatedCost)
  return {
    targetModel, currentCost, simulatedCost,
    savings, savingsPercent: currentCost > 0 ? (savings / currentCost) * 100 : 0,
    requestCount: records.length,
    warning: highOutputCount > 0 ? `${highOutputCount} complex requests may degrade with ${targetModel}` : undefined,
  }
}
