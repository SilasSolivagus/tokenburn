import fs from 'fs'
import path from 'path'
import os from 'os'
import YAML from 'yaml'
import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { WasteDetection, Severity } from './index.js'

export interface CustomRuleConfig {
  name: string; condition: string; severity: Severity; message: string; suggestion: string
}

export function getDefaultRulesPath(): string {
  return path.join(os.homedir(), '.tokenburn', 'rules.yaml')
}

export function loadCustomRules(filePath?: string): CustomRuleConfig[] {
  try {
    const content = fs.readFileSync(filePath ?? getDefaultRulesPath(), 'utf8')
    const doc = YAML.parse(content) as { rules?: CustomRuleConfig[] }
    return doc?.rules ?? []
  } catch { return [] }
}

export function runCustomRules(rules: CustomRuleConfig[], filter: QueryFilter): WasteDetection[] {
  if (!rules.length) return []
  const db = getDb()
  const { sql, params } = buildWhere(filter)
  const detections: WasteDetection[] = []
  for (const rule of rules) {
    try {
      const extra = sql ? `AND (${rule.condition})` : `WHERE (${rule.condition})`
      const row = db.prepare(`SELECT COUNT(*) as cnt, COALESCE(SUM(costUSD), 0) as totalCost FROM requests ${sql} ${extra}`).get(params) as { cnt: number; totalCost: number }
      if (row.cnt > 0) {
        detections.push({
          rule: `custom:${rule.name}`, severity: rule.severity,
          wastedUSD: row.totalCost, savableUSD: 0,
          message: `${rule.message} (${row.cnt} match${row.cnt > 1 ? 'es' : ''})`,
          detail: `Custom rule "${rule.name}" matched ${row.cnt} request(s) totaling $${row.totalCost.toFixed(2)}`,
          suggestion: rule.suggestion,
        })
      }
    } catch { /* invalid SQL — skip */ }
  }
  return detections
}
