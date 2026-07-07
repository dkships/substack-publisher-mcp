# Substack Publisher MCP

MCP server for Substack's official Publisher API. TypeScript, ES modules, `@modelcontextprotocol/sdk` with stdio transport, native `fetch` (no HTTP framework). Setup and tool docs: README.md.

## Commands

```bash
npm run build     # Compile TypeScript to dist/
npm test          # Unit tests (node:test via tsx)
npm start         # Run the server
```

Run `npm run build` after source changes — MCP clients execute `dist/index.js`, not the TypeScript source.

## Environment variables

- Read directly from `process.env`; the server never loads `.env` files. Set vars in the MCP client config, or in your shell for `npm start`.
- Keys: `SUBSTACK_API_KEY` (single publication) or `SUBSTACK_API_KEY_<NAME>` (multi-publication).
- Never commit API key values.

## Conventions

- Use `registerTool` / `registerResource` for MCP registration (not deprecated `.tool()`)
- API clients live in their own module under `src/` (e.g., `substack.ts`)
- Return raw structured data from tools; let the caller synthesize
- Errors return `isError: true` with the message
- When documenting API behavior, verify against the code and live Substack API responses — do not assume

## Definition of done

- `npm run build` compiles, `npm test` passes, `npm start` boots without errors
