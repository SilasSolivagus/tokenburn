import { Command } from 'commander'
import { getDb } from '../db/db.js'
import { buildAgentTree, getTreeSessions } from '../logs/tree-builder.js'
import { renderTree, renderTreeList } from '../reporter/tree.js'

export const treeCommand = new Command('tree')
  .description('Show agent cost tree for a session')
  .option('--session <id>', 'Specific session ID')
  .option('--last <n>', 'Show last N sessions', '1')
  .option('--json', 'Output as JSON', false)
  .action((opts) => {
    getDb()
    if (opts.session) {
      const tree = buildAgentTree(opts.session)
      if (!tree) { console.log(`\n  No data for session: ${opts.session}\n`); return }
      if (opts.json) { console.log(JSON.stringify(tree, null, 2)); return }
      process.stdout.write(renderTree(tree))
      return
    }
    const limit = parseInt(opts.last, 10) || 1
    const sessions = getTreeSessions(limit)
    if (sessions.length === 0) { process.stdout.write(renderTreeList([])); return }
    if (opts.json) { console.log(JSON.stringify(sessions.map(id => buildAgentTree(id)).filter(Boolean), null, 2)); return }
    for (const id of sessions) { const tree = buildAgentTree(id); if (tree) process.stdout.write(renderTree(tree)) }
  })
