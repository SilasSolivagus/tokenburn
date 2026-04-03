# Show HN Post

**Title:**

Show HN: Tokenburn -- htop for your AI coding spend (free CLI, 30 waste-detection rules)

**Body:**

I built tokenburn because I wanted to know what my Claude Max Pro plan was actually worth. Turns out: a lot. In 7 days, I used $3,197 of API-equivalent compute on a $200/month plan. That's 14.9x value. But the interesting part was *where* the money went.

tokenburn is a CLI that intercepts your AI coding tool traffic through a local proxy, stores everything in SQLite, and runs 30 waste-detection rules against your usage. It found that 8,231 of my responses were short enough that haiku would have been fine, but they all hit opus. It found 2,189 requests between 1-5am from overnight agent runs I forgot to kill.

How it works: a transparent local proxy sits between your tool and the API. Zero data leaves your machine -- everything stays in a local SQLite db. For Claude Code, it can also read the local logs directly with no proxy needed.

    npm install -g tokenburn-cli
    tokenburn              # auto-imports Claude Code logs
    tokenburn proxy start  # for Cursor, aider, etc.
    tokenburn scan         # run waste detection

Supports Claude Code, Cursor, aider, Continue, OpenClaw, and anything that uses ANTHROPIC_BASE_URL or OPENAI_BASE_URL. Also has an MCP server so your agent can monitor its own spending mid-session.

Built in a day, 206 tests, MIT licensed. There's a paid tool (BurnRate) that does something similar for $12/mo -- tokenburn does more and costs nothing.

GitHub: https://github.com/SilasSolivagus/tokenburn
npm: tokenburn-cli
