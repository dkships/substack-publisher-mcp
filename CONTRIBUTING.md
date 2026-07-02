# Contributing to substack-publisher-mcp

Thanks for your interest in contributing!

## Development Setup

1. Clone the repo and install dependencies:

```bash
git clone https://github.com/dkships/substack-publisher-mcp.git
cd substack-publisher-mcp
npm install
```

2. Export your API key in your shell (the server reads env vars directly; it does not load `.env` files):

```bash
export SUBSTACK_API_KEY=your-key
```

3. Build and test:

```bash
npm run build
npm test
npm start
```

## Guidelines

- Keep changes focused and minimal
- Test with a real Substack Publisher API key before submitting
- This is a read-only MCP server (v1) — write operations will be considered for v2
- Follow existing code patterns and TypeScript strict mode

## Reporting Issues

Open a GitHub issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your Node.js version (`node --version`)

## Pull Requests

1. Fork the repo and create a feature branch
2. Make your changes
3. Ensure `npm run build` and `npm test` pass with zero errors
4. Submit a PR with a clear description of the change
