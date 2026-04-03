import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { CREATE_TABLE_SQL, MIGRATION_V2_SQL, type RequestRecord } from './schema.js'

export interface QueryFilter {
  since?: number
  until?: number
  provider?: string
  model?: string
  source?: string
}

let db: Database.Database | null = null

export function getDbPath(): string {
  return path.join(os.homedir(), '.tokenburn', 'tokenburn.db')
}

export function getDb(dbPath?: string): Database.Database {
  if (db) return db

  const resolvedPath = dbPath ?? getDbPath()
  const dir = path.dirname(resolvedPath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(resolvedPath)
  db.pragma('journal_mode = WAL')
  db.exec(CREATE_TABLE_SQL)
  runMigrations(db)

  return db
}

function runMigrations(database: Database.Database): void {
  const columns = database.pragma('table_info(requests)') as Array<{ name: string }>
  const columnNames = new Set(columns.map(c => c.name))

  if (!columnNames.has('sessionId')) {
    database.exec(`ALTER TABLE requests ADD COLUMN sessionId TEXT NOT NULL DEFAULT ''`)
  }
  if (!columnNames.has('projectPath')) {
    database.exec(`ALTER TABLE requests ADD COLUMN projectPath TEXT NOT NULL DEFAULT ''`)
  }

  database.exec(MIGRATION_V2_SQL)
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

export function insertRequest(record: RequestRecord): void {
  const database = getDb()
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO requests (
      id, timestamp, provider, model, source,
      inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens,
      costUSD, durationMs, promptHash, toolUse, stopReason,
      sessionId, projectPath
    ) VALUES (
      @id, @timestamp, @provider, @model, @source,
      @inputTokens, @outputTokens, @cacheReadTokens, @cacheWriteTokens,
      @costUSD, @durationMs, @promptHash, @toolUse, @stopReason,
      @sessionId, @projectPath
    )
  `)
  stmt.run(record)
}

export function queryRequests(filter: QueryFilter): RequestRecord[] {
  const database = getDb()

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

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const sql = `SELECT * FROM requests ${where} ORDER BY timestamp ASC`

  const stmt = database.prepare(sql)
  return stmt.all(params) as RequestRecord[]
}
