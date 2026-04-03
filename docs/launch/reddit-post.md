# Reddit Post (r/programming)

**Title:**

I built a free CLI to analyze where your AI coding tool money actually goes. Found $3,197 of API usage on a $200/mo plan in one week.

**Body:**

I've been using Claude Code heavily and wanted to understand what my Max plan was actually worth in API terms. So I built tokenburn -- a CLI that sits as a local proxy between your AI tool and the API, records everything in SQLite, and runs waste detection on your usage.

Some things I found in my own data:

- My $200/mo plan consumed $3,197 in API-equivalent compute in 7 days
- 8,231 responses were short enough that the cheapest model would have worked, but they all used the most expensive one
- 2,189 requests happened between 1-5am from agent runs I forgot to stop
- My cache hit rate was 6% -- most of my input tokens were being sent fresh every time

tokenburn has 30 waste-detection rules that flag stuff like this automatically. It supports Claude Code (reads logs directly, no proxy needed), Cursor, aider, Continue, and anything using standard API base URLs.

Everything runs locally. No accounts, no telemetry, no data leaves your machine.

    npm install -g tokenburn-cli
    tokenburn

MIT licensed, 206 tests: https://github.com/SilasSolivagus/tokenburn

Happy to answer questions about the implementation or the waste patterns.
