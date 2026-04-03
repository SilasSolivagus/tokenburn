# tokenburn

**Stop guessing where your AI coding budget goes.** tokenburn is a free, open-source CLI that analyzes spending across every major AI coding tool, detects waste with 30 rules, and tells you exactly how to fix it.

[![npm version](https://img.shields.io/npm/v/tokenburn-cli)](https://www.npmjs.com/package/tokenburn-cli)
[![license](https://img.shields.io/github/license/SilasSolivagus/tokenburn)](./LICENSE)
[![tests](https://img.shields.io/badge/tests-206%20passed-brightgreen)]()

<p align="center">
  <img src="docs/demo-hero.gif" alt="tokenburn demo" width="800">
</p>

## Why tokenburn

- **Your $200/mo plan might be hiding $3,197 in API-equivalent usage** -- and most of it is waste you can eliminate with config changes.
- **30 detection rules** find duplicate requests, model overuse, retry storms, context drift, and 26 other patterns that silently drain your budget.
- **One command fixes it.** `tokenburn scan --fix` writes optimizations directly into your CLAUDE.md.

## Quick Start

```bash
npm install -g tokenburn-cli
tokenburn            # auto-detects your tools, runs first-time setup wizard
tokenburn scan       # find waste
```

## Zero Config

tokenburn auto-detects installed tools and reads their local logs directly. No proxy, no API keys, no setup for:

| Auto-detected | Via Proxy (catches everything else) |
|---|---|
| Claude Code, Cline, Pi, Codex CLI, Gemini CLI, Roo Code, OpenCode | Cursor, aider, Windsurf, Copilot, Continue, any tool |

First run triggers a setup wizard that detects your tools, asks if you're on a subscription or API billing, and configures everything.

## What It Detects

Real output from a Max Plan subscriber ($200/mo). Seven days of Claude Code usage:

```
$ tokenburn scan --last 7d

  tokenburn waste scan — 7 days, 1,847 requests

  API-equivalent cost: $3,197.40   (14.9x plan value)
  Waste detected:     $1,082.16   (33.8%)

  CRITICAL
  ┌─────────────────────────────────────────────────────────┐
  │ duplicate-requests        217 hits     $428.60 wasted   │
  │ Same file read 2-11x per session. Agent re-reads files  │
  │ it already has in context.                              │
  │ → tokenburn scan --fix to patch CLAUDE.md               │
  ├─────────────────────────────────────────────────────────┤
  │ model-overuse             183 hits     $312.40 savable  │
  │ Short tasks (<200 tokens output) routed to Opus.        │
  │ → Switch to Haiku for trivial completions               │
  ├─────────────────────────────────────────────────────────┤
  │ retry-storm                14 hits      $89.20 wasted   │
  │ Same failing request retried 3-8x without changes.      │
  │ → Add error-handling instructions to CLAUDE.md          │
  └─────────────────────────────────────────────────────────┘

  WARNING
  ┌─────────────────────────────────────────────────────────┐
  │ low-cache-hit             cache rate: 6.2%    -$118.30  │
  │ context-drift             38 sessions          -$67.40  │
  │ write-rewrite             29 cycles            -$41.80  │
  │ read-heavy                12 sessions          -$24.46  │
  └─────────────────────────────────────────────────────────┘

  Potential savings: $1,082.16/week
  Run: tokenburn scan --fix     (interactive — patches CLAUDE.md)
  Run: tokenburn optimize --simulate   (model what-if analysis)
```

## vs Alternatives

| | tokenburn | ccusage | BurnRate | Tokscale |
|---|---|---|---|---|
| **Price** | Free / MIT | Free / MIT | $12/mo | Contact sales |
| **Shows spending** | Yes | Yes | Yes | Yes |
| **Detects waste** | 30 rules | -- | 3 rules | Custom |
| **Fix suggestions** | Yes + auto-apply | -- | -- | Manual |
| **Tools supported** | 14+ (adapter + proxy) | Claude Code only | Claude Code only | API only |
| **Runs locally** | Yes | Yes | Cloud | Cloud |
| **MCP server** | Yes | -- | -- | -- |

ccusage tells you how much you spent. tokenburn tells you how much you wasted and how to stop.

## Commands

| Command | What it does |
|---|---|
| `tokenburn` | Auto-detect tools, import logs, show today's report |
| `tokenburn scan` | Run 30 waste detection rules |
| `tokenburn scan --fix` | Interactive mode -- apply fixes to CLAUDE.md |
| `tokenburn optimize` | Generate optimization plan |
| `tokenburn optimize --simulate` | Model cost savings with different configs |
| `tokenburn report` | Cost breakdown (today, `--last 7d`, `--by model`) |
| `tokenburn live` | Real-time spending dashboard |
| `tokenburn tree` | Visualize agent cost tree |
| `tokenburn proxy start -d` | Start local proxy for universal tool support |
| `tokenburn dashboard` | Open web dashboard at localhost:10812 |

## Supported Tools

### Native log adapters (zero config)

| Tool | Log format | Status |
|---|---|---|
| Claude Code | JSONL | Stable |
| Cline | JSONL | Stable |
| Codex CLI | JSONL | Stable |
| Gemini CLI | JSONL | Stable |
| Roo Code | JSONL | Stable |
| OpenCode | JSONL | Stable |
| Pi | JSONL | Stable |

### Proxy (catches everything else)

Start the proxy once, and any tool that supports `ANTHROPIC_BASE_URL` or `OPENAI_BASE_URL` is tracked automatically:

```bash
tokenburn proxy start -d
eval $(tokenburn proxy env)
```

Works with Cursor, aider, Windsurf, Copilot, Continue, and any custom agent using Anthropic/OpenAI SDKs.

```
Your tool → localhost:10811 → tokenburn (record) → api.anthropic.com
                                   ↓
                            ~/.tokenburn/tokenburn.db
```

All data stays on your machine. Nothing is sent anywhere.

## MCP Server

Let your AI agent monitor its own spending mid-session:

```bash
tokenburn mcp   # stdio transport
```

```json
{ "mcpServers": { "tokenburn": { "command": "tokenburn", "args": ["mcp"] } } }
```

Exposes `get_spending`, `get_waste`, `get_suggestion`, and `get_tree` tools.

## License

MIT -- see [LICENSE](./LICENSE).

"tokenburn" is a trademark of its author. The MIT license grants rights to the code, not the name.
