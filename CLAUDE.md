# Substack Publisher MCP

@AGENTS.md

## Development

```bash
npm run build     # Compile TypeScript
npm test          # Run unit tests (node:test via tsx)
npm start         # Run the server
```

## Project Structure

```
src/
  index.ts          # MCP server entry point, tool registration
  substack.ts       # Env key loading, Substack API client, result helpers
  substack.test.ts  # Unit tests
```

## Environment Variables
- Read directly from `process.env`: set them in the MCP client config, or in your shell for `npm start`. The server does not load `.env` files.
- Never commit API keys.

## Conventions

- Run `npm run build` after source changes — Codex's `found-substack` MCP server points at `dist/index.js`.
- Return raw structured data from tools; let the caller synthesize.
- Errors return `isError: true` with the message.

Hallucination prevention: see `~/.agents/AGENTS.md`.
