# Contributing to tokenburn

Thanks for your interest in contributing!

## Quick Start

```bash
git clone https://github.com/SilasSolivagus/tokenburn.git
cd tokenburn
npm install
npm run build
npm test
```

## Adding a New Adapter

The easiest way to contribute is adding support for a new AI tool:

1. Create `src/logs/adapters/your-tool.ts` implementing `ImportAdapter`
2. Register it in `src/logs/adapters/index.ts`
3. Add tests in `tests/logs/`
4. Submit a PR

See existing adapters for reference: `src/logs/adapters/claude-code.ts`

## Adding a New Waste Detection Rule

1. Create `src/analyzer/rules/your-rule.ts` implementing `RuleFn`
2. Register it in `src/analyzer/rules/index.ts`
3. Add tests in `tests/analyzer/`
4. Submit a PR

Each rule is a single function that queries the SQLite database and returns a `WasteDetection` or `null`.

## Running Tests

```bash
npm test              # run all tests
npm run test:watch    # watch mode
```

## Code Style

- TypeScript strict mode
- No unnecessary abstractions
- Every rule/adapter is a single focused file
