import fs from 'fs'
import path from 'path'
import os from 'os'
import YAML from 'yaml'

export interface TokenburnConfig {
  mode: 'subscription' | 'api'
  planPrice: number
}

const DEFAULT_CONFIG: TokenburnConfig = {
  mode: 'subscription',
  planPrice: 200,
}

export function getConfigPath(): string {
  return path.join(os.homedir(), '.tokenburn', 'config.yaml')
}

export function loadConfig(): TokenburnConfig {
  try {
    const content = fs.readFileSync(getConfigPath(), 'utf8')
    const parsed = YAML.parse(content) as Partial<TokenburnConfig>
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveConfig(config: TokenburnConfig): void {
  const dir = path.dirname(getConfigPath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getConfigPath(), YAML.stringify(config))
}
