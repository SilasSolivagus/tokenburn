# Twitter/X Launch Thread

---

**Tweet 1 (Hook)**

My $200/mo Claude Max plan used $3,197 of API compute in 7 days.

14.9x value. But when I looked at where the tokens went, I found thousands of dollars in pure waste.

I built a free CLI to find out. Here's what it found:

---

**Tweet 2 (Screenshot: waste scan output)**

[Screenshot: `tokenburn scan --last 7d` terminal output showing 4 waste categories with colored severity indicators, dollar amounts, and fix suggestions]

8,231 short responses hit the most expensive model when a cheap one would have been identical.

tokenburn catches this. 30 rules, all running locally against your usage data.

---

**Tweet 3 (Screenshot: model breakdown report)**

[Screenshot: `tokenburn report --by model` showing a table of models, request counts, token totals, and cost per model -- opus dominating the spend]

This is the model breakdown. Opus handled everything -- including 200-token "yes, that file exists" responses.

That's like taking a helicopter to get coffee.

---

**Tweet 4 (Screenshot: overnight usage)**

[Screenshot: `tokenburn report --by hour` showing a spike of 2,189 requests between 1-5am]

2,189 requests between 1am and 5am. Agent runs I started and forgot about.

Some ran for hours, re-reading the same files in loops. tokenburn flags this automatically.

---

**Tweet 5 (Screenshot: live dashboard)**

[Screenshot: `tokenburn live` TUI dashboard showing real-time cost ticker, requests/min, active model, and running waste alerts]

The live dashboard is my favorite part. It's like watching your money burn in real time.

You can also run it as an MCP server so the agent itself knows how much it's spending mid-session.

---

**Tweet 6 (What it does + link)**

tokenburn is a free, open-source CLI:

- Transparent local proxy -- intercepts API calls, stores in SQLite
- 30 waste detection rules across 4 categories
- Works with Claude Code, Cursor, aider, Continue, and more
- Zero data leaves your machine

npm install -g tokenburn-cli

https://github.com/SilasSolivagus/tokenburn

---

**Tweet 7 (vs alternatives)**

There's a paid tool called BurnRate that does something similar for $12/month.

tokenburn is free, open source, has more rules, supports more tools, and runs entirely locally.

Built it in a day. 206 tests. MIT license.

---

**Tweet 8 (CTA)**

If you're spending real money on AI coding tools, or you're on a Max plan and curious what you're actually using:

npm install -g tokenburn-cli
tokenburn

That's it. Takes 10 seconds.

Star the repo if it's useful: https://github.com/SilasSolivagus/tokenburn
