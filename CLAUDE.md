# tokenburn — Development Guidelines

## Model Selection

Use the cheapest model that can handle the task:

- **opus**: Architecture decisions, complex debugging, multi-file refactors, design reviews
- **sonnet**: Normal coding, writing tests, implementing features, code review
- **haiku**: Git operations, npm commands, file reads, simple edits, formatting, mechanical tasks

When dispatching subagents, always set `model: "haiku"` for mechanical tasks (scaffolding, single-file changes with clear specs).

## Efficiency Rules

- Be concise. Act, don't explain. Skip preamble and summaries.
- When using tools, keep text response minimal. Let tool results speak.
- Do not re-read files you have already read in this session.
- Use targeted line-range reads for large files instead of reading the whole file.
- Break complex tasks into smaller steps rather than giant single prompts.

## Session Management

- Start a new session every 1-2 hours to keep context fresh.
- Use /clear when switching between unrelated subtasks.
- Avoid trial-and-error Bash loops — plan the command before running it.

## Code Style

- TypeScript strict mode
- Each rule/adapter is a single focused file
- No unnecessary abstractions — three similar lines beat a premature helper
- Tests follow TDD: write test, verify fail, implement, verify pass
