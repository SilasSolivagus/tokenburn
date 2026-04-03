export interface RequestRecord {
  id: string
  timestamp: number
  provider: 'anthropic' | 'openai'
  model: string
  source: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUSD: number
  durationMs: number
  promptHash: string
  toolUse: string  // JSON stringified string[]
  stopReason: string
  sessionId: string
  projectPath: string
}

export const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'unknown',
    inputTokens INTEGER NOT NULL DEFAULT 0,
    outputTokens INTEGER NOT NULL DEFAULT 0,
    cacheReadTokens INTEGER NOT NULL DEFAULT 0,
    cacheWriteTokens INTEGER NOT NULL DEFAULT 0,
    costUSD REAL NOT NULL DEFAULT 0,
    durationMs INTEGER NOT NULL DEFAULT 0,
    promptHash TEXT NOT NULL DEFAULT '',
    toolUse TEXT NOT NULL DEFAULT '[]',
    stopReason TEXT NOT NULL DEFAULT '',
    sessionId TEXT NOT NULL DEFAULT '',
    projectPath TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp);
  CREATE INDEX IF NOT EXISTS idx_requests_provider ON requests(provider);
  CREATE INDEX IF NOT EXISTS idx_requests_model ON requests(model);
  CREATE INDEX IF NOT EXISTS idx_requests_promptHash ON requests(promptHash);
  CREATE INDEX IF NOT EXISTS idx_requests_sessionId ON requests(sessionId);
`

export const MIGRATION_V2_SQL = `
CREATE TABLE IF NOT EXISTS import_state (
  filePath TEXT PRIMARY KEY,
  lastOffset INTEGER NOT NULL DEFAULT 0,
  lastTimestamp INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agent_tree (
  uuid TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  parentUuid TEXT,
  role TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  inputTokens INTEGER NOT NULL DEFAULT 0,
  outputTokens INTEGER NOT NULL DEFAULT 0,
  costUSD REAL NOT NULL DEFAULT 0,
  toolUse TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_agent_tree_session ON agent_tree(sessionId);
CREATE INDEX IF NOT EXISTS idx_agent_tree_parent ON agent_tree(parentUuid);
`
