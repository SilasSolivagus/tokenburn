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
