import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import { getDb, closeDb } from '../../src/db/db.js'
import { buildAgentTree, getTreeSessions } from '../../src/logs/tree-builder.js'

const TEST_DB = path.join(import.meta.dirname, 'tree-builder-test.db')

function insertTreeNode(
  uuid: string,
  sessionId: string,
  parentUuid: string | null,
  inputTokens: number,
  outputTokens: number,
  costUSD: number,
  toolUse: string[] = [],
) {
  const db = getDb()
  db.prepare(`INSERT INTO agent_tree (uuid, sessionId, parentUuid, role, timestamp, inputTokens, outputTokens, costUSD, toolUse)
    VALUES (?, ?, ?, 'assistant', ?, ?, ?, ?, ?)`).run(uuid, sessionId, parentUuid, Date.now(), inputTokens, outputTokens, costUSD, JSON.stringify(toolUse))
}

beforeEach(() => {
  closeDb()
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
  getDb(TEST_DB)
})

afterEach(() => {
  closeDb()
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
})

describe('buildAgentTree', () => {
  it('builds a tree from 3 linked nodes and sums cost correctly', () => {
    insertTreeNode('a1', 'sess-1', null, 1000, 200, 0.05, ['Read'])
    insertTreeNode('a2', 'sess-1', 'a1', 800, 150, 0.03, ['Edit'])
    insertTreeNode('a3', 'sess-1', 'a2', 500, 100, 0.02, ['Bash'])

    const tree = buildAgentTree('sess-1')
    expect(tree).not.toBeNull()
    expect(tree!.sessionId).toBe('sess-1')
    expect(tree!.totalCost).toBeCloseTo(0.10, 5)
    expect(tree!.nodeCount).toBe(3)

    // a1 is the root
    expect(tree!.roots).toHaveLength(1)
    expect(tree!.roots[0].uuid).toBe('a1')

    // a1 -> a2 -> a3
    expect(tree!.roots[0].children).toHaveLength(1)
    expect(tree!.roots[0].children[0].uuid).toBe('a2')
    expect(tree!.roots[0].children[0].children).toHaveLength(1)
    expect(tree!.roots[0].children[0].children[0].uuid).toBe('a3')
    expect(tree!.roots[0].children[0].children[0].children).toHaveLength(0)
  })

  it('returns null for a nonexistent session', () => {
    const tree = buildAgentTree('nonexistent-session')
    expect(tree).toBeNull()
  })

  it('groups tool calls correctly in toolSummary', () => {
    insertTreeNode('b1', 'sess-2', null, 500, 100, 0.01, ['Read', 'Read', 'Bash'])
    insertTreeNode('b2', 'sess-2', 'b1', 300, 50, 0.005, ['Read', 'Edit'])

    const tree = buildAgentTree('sess-2')
    expect(tree).not.toBeNull()
    // Read appears 3 times, Bash once, Edit once
    // toolSummary should be sorted by count descending
    expect(tree!.toolSummary).toContain('Read \xd73')
    expect(tree!.toolSummary).toContain('Bash \xd71')
    expect(tree!.toolSummary).toContain('Edit \xd71')
    // Read should come first
    expect(tree!.toolSummary.indexOf('Read')).toBeLessThan(tree!.toolSummary.indexOf('Bash'))
    expect(tree!.toolSummary.indexOf('Read')).toBeLessThan(tree!.toolSummary.indexOf('Edit'))
  })

  it('handles multiple root nodes (parallel subagents)', () => {
    // c1 and c2 are both roots (no parent), c3 is child of c1
    insertTreeNode('c1', 'sess-3', null, 1000, 200, 0.05, [])
    insertTreeNode('c2', 'sess-3', null, 800, 150, 0.04, [])
    insertTreeNode('c3', 'sess-3', 'c1', 500, 100, 0.02, [])

    const tree = buildAgentTree('sess-3')
    expect(tree).not.toBeNull()
    expect(tree!.roots).toHaveLength(2)
    expect(tree!.nodeCount).toBe(3)
    expect(tree!.totalCost).toBeCloseTo(0.11, 5)

    const root1 = tree!.roots.find(r => r.uuid === 'c1')
    const root2 = tree!.roots.find(r => r.uuid === 'c2')
    expect(root1).toBeDefined()
    expect(root2).toBeDefined()
    expect(root1!.children).toHaveLength(1)
    expect(root1!.children[0].uuid).toBe('c3')
    expect(root2!.children).toHaveLength(0)
  })
})

describe('getTreeSessions', () => {
  it('returns distinct session IDs', () => {
    insertTreeNode('d1', 'sess-A', null, 100, 50, 0.01)
    insertTreeNode('d2', 'sess-A', 'd1', 100, 50, 0.01)
    insertTreeNode('d3', 'sess-B', null, 100, 50, 0.01)

    const sessions = getTreeSessions(10)
    expect(sessions).toContain('sess-A')
    expect(sessions).toContain('sess-B')
    expect(sessions.filter(s => s === 'sess-A')).toHaveLength(1)
  })

  it('respects the limit parameter', () => {
    insertTreeNode('e1', 'sess-X', null, 100, 50, 0.01)
    insertTreeNode('e2', 'sess-Y', null, 100, 50, 0.01)
    insertTreeNode('e3', 'sess-Z', null, 100, 50, 0.01)

    const sessions = getTreeSessions(2)
    expect(sessions.length).toBeLessThanOrEqual(2)
  })
})
