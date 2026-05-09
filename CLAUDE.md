# Substack Publisher MCP

@AGENTS.md

## Development

```bash
npm run build     # Compile TypeScript
npm run dev       # Watch mode
npm start         # Run the server
```

## Project Structure

```
src/
  index.ts        # MCP server entry point, tool registration
```

## Environment Variables
- Loaded from `.env` via dotenv
- Never commit `.env` (gitignored)

## Conventions

- Run `npm run build` after source changes — Codex's `found-substack` MCP server points at `dist/index.js`.
- Return raw structured data from tools; let the caller synthesize.
- Errors return `isError: true` with the message.

Hallucination prevention: see `~/.agents/AGENTS.md`.
