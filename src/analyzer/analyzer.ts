import { getDb, type QueryFilter } from '../db/db.js'

export interface WhereClause {
  sql: string
  params: Record<string, unknown>
}

export function buildWhere(filter: QueryFilter): WhereClause {
  const conditions: string[] = []
  const params: Record<string, unknown> = {}

  if (filter.since !== undefined) {
    conditions.push('timestamp >= @since')
    params.since = filter.since
  }
  if (filter.until !== undefined) {
    conditions.push('timestamp <= @until')
    params.until = filter.until
  }
  if (filter.provider !== undefined) {
    conditions.push('provider = @provider')
    params.provider = filter.provider
  }
  if (filter.model !== undefined) {
    conditions.push('model = @model')
    params.model = filter.model
  }
  if (filter.source !== undefined) {
    conditions.push('source = @source')
    params.source = filter.source
  }

  const sql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  return { sql, params }
}

export interface ModelAgg {
  model: string
  totalCost: number
  totalInput: number
  totalOutput: number
  requestCount: number
}

export function aggregateByModel(filter: QueryFilter): ModelAgg[] {
  const db = getDb()
  const { sql, params } = buildWhere(filter)
  const query = `
    SELECT
      model,
      SUM(costUSD) AS totalCost,
      SUM(inputTokens) AS totalInput,
      SUM(outputTokens) AS totalOutput,
      COUNT(*) AS requestCount
    FROM requests
    ${sql}
    GROUP BY model
    ORDER BY totalCost DESC
  `
  return db.prepare(query).all(params) as ModelAgg[]
}

export interface SourceAgg {
  source: string
  totalCost: number
  totalInput: number
  totalOutput: number
  requestCount: number
}

export function aggregateBySource(filter: QueryFilter): SourceAgg[] {
  const db = getDb()
  const { sql, params } = buildWhere(filter)
  const query = `
    SELECT
      source,
      SUM(costUSD) AS totalCost,
      SUM(inputTokens) AS totalInput,
      SUM(outputTokens) AS totalOutput,
      COUNT(*) AS requestCount
    FROM requests
    ${sql}
    GROUP BY source
    ORDER BY totalCost DESC
  `
  return db.prepare(query).all(params) as SourceAgg[]
}

export interface DayAgg {
  day: string
  totalCost: number
  totalInput: number
  totalOutput: number
  requestCount: number
}

export function aggregateByDay(filter: QueryFilter): DayAgg[] {
  const db = getDb()
  const { sql, params } = buildWhere(filter)
  const query = `
    SELECT
      date(timestamp / 1000, 'unixepoch', 'localtime') AS day,
      SUM(costUSD) AS totalCost,
      SUM(inputTokens) AS totalInput,
      SUM(outputTokens) AS totalOutput,
      COUNT(*) AS requestCount
    FROM requests
    ${sql}
    GROUP BY day
    ORDER BY day ASC
  `
  return db.prepare(query).all(params) as DayAgg[]
}

export interface HourAgg {
  hour: string
  totalCost: number
  totalInput: number
  totalOutput: number
  requestCount: number
}

export function aggregateByHour(filter: QueryFilter): HourAgg[] {
  const db = getDb()
  const { sql, params } = buildWhere(filter)
  const query = `
    SELECT
      strftime('%H', timestamp / 1000, 'unixepoch', 'localtime') AS hour,
      SUM(costUSD) AS totalCost,
      SUM(inputTokens) AS totalInput,
      SUM(outputTokens) AS totalOutput,
      COUNT(*) AS requestCount
    FROM requests
    ${sql}
    GROUP BY hour
    ORDER BY hour ASC
  `
  return db.prepare(query).all(params) as HourAgg[]
}

export interface SessionAgg {
  sessionId: string
  totalCost: number
  totalInput: number
  totalOutput: number
  requestCount: number
  startTime: number
  endTime: number
  durationMs: number
}

export function aggregateBySession(filter: QueryFilter): SessionAgg[] {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  // Named sessions (from log import)
  const named = db.prepare(`
    SELECT sessionId, SUM(costUSD) AS totalCost, SUM(inputTokens) AS totalInput,
           SUM(outputTokens) AS totalOutput, COUNT(*) AS requestCount,
           MIN(timestamp) AS startTime, MAX(timestamp) AS endTime
    FROM requests ${sql} ${sql ? 'AND' : 'WHERE'} sessionId != ''
    GROUP BY sessionId
  `).all(params) as Array<SessionAgg>

  // Proxy data without sessionId — group by 5min time gaps
  const orphans = db.prepare(`
    SELECT timestamp, costUSD, inputTokens, outputTokens
    FROM requests ${sql} ${sql ? 'AND' : 'WHERE'} sessionId = ''
    ORDER BY timestamp ASC
  `).all(params) as Array<{ timestamp: number; costUSD: number; inputTokens: number; outputTokens: number }>

  const auto: SessionAgg[] = []
  if (orphans.length > 0) {
    let cur = { start: orphans[0].timestamp, end: orphans[0].timestamp, cost: orphans[0].costUSD, input: orphans[0].inputTokens, output: orphans[0].outputTokens, count: 1 }
    for (let i = 1; i < orphans.length; i++) {
      const row = orphans[i]
      if (row.timestamp - cur.end > 300000) {
        auto.push({ sessionId: `auto-${cur.start}`, totalCost: cur.cost, totalInput: cur.input, totalOutput: cur.output, requestCount: cur.count, startTime: cur.start, endTime: cur.end, durationMs: cur.end - cur.start })
        cur = { start: row.timestamp, end: row.timestamp, cost: row.costUSD, input: row.inputTokens, output: row.outputTokens, count: 1 }
      } else {
        cur.end = row.timestamp; cur.cost += row.costUSD; cur.input += row.inputTokens; cur.output += row.outputTokens; cur.count++
      }
    }
    auto.push({ sessionId: `auto-${cur.start}`, totalCost: cur.cost, totalInput: cur.input, totalOutput: cur.output, requestCount: cur.count, startTime: cur.start, endTime: cur.end, durationMs: cur.end - cur.start })
  }

  return [...named.map(s => ({ ...s, durationMs: s.endTime - s.startTime })), ...auto].sort((a, b) => b.totalCost - a.totalCost)
}

export interface Summary {
  totalCost: number
  totalRequests: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  avgCostPerRequest: number
}

export function summarize(filter: QueryFilter): Summary {
  const db = getDb()
  const { sql, params } = buildWhere(filter)
  const query = `
    SELECT
      COALESCE(SUM(costUSD), 0) AS totalCost,
      COUNT(*) AS totalRequests,
      COALESCE(SUM(inputTokens), 0) AS totalInputTokens,
      COALESCE(SUM(outputTokens), 0) AS totalOutputTokens,
      COALESCE(SUM(cacheReadTokens), 0) AS totalCacheReadTokens
    FROM requests
    ${sql}
  `
  const row = db.prepare(query).get(params) as {
    totalCost: number
    totalRequests: number
    totalInputTokens: number
    totalOutputTokens: number
    totalCacheReadTokens: number
  }

  return {
    totalCost: row.totalCost,
    totalRequests: row.totalRequests,
    totalInputTokens: row.totalInputTokens,
    totalOutputTokens: row.totalOutputTokens,
    totalCacheReadTokens: row.totalCacheReadTokens,
    avgCostPerRequest: row.totalRequests > 0 ? row.totalCost / row.totalRequests : 0,
  }
}

export interface PlanValue {
  planPriceUSD: number
  apiEquivalentUSD: number
  multiplier: number
  verdict: string
}

export function calculatePlanValue(filter: QueryFilter, planPriceUSD: number): PlanValue {
  const summary = summarize(filter)
  const apiEquivalentUSD = summary.totalCost
  const multiplier = planPriceUSD > 0 ? apiEquivalentUSD / planPriceUSD : 0
  let verdict: string
  if (multiplier >= 2) verdict = `Great value! You'd pay ${multiplier.toFixed(1)}x more on API pricing.`
  else if (multiplier >= 1) verdict = `Fair value. API equivalent is ${multiplier.toFixed(1)}x your plan price.`
  else if (multiplier > 0) verdict = `Underusing your plan. Consider a lower tier to save $${(planPriceUSD - apiEquivalentUSD).toFixed(0)}/month.`
  else verdict = 'No usage data to evaluate.'
  return { planPriceUSD, apiEquivalentUSD, multiplier, verdict }
}
