import { Command } from 'commander'
import { startMcpServer } from '../mcp/server.js'

export const mcpCommand = new Command('mcp')
  .description('Start MCP server (stdio) for AI agent integration')
  .action(() => { startMcpServer() })
