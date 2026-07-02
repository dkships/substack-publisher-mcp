# Substack Publisher MCP — Agent Instructions

## What This Is
MCP server providing Substack Publisher API access. Enables agents to interact with Substack publications programmatically.

## Tech Stack
- TypeScript, ES modules, Node 18+
- `@modelcontextprotocol/sdk` with stdio transport
- `zod` for input validation
- Native `fetch` for Substack Publisher API calls (no HTTP framework)

## Scope And Boundaries
- This is a self-managed repo (dkships/substack-publisher-mcp)
- Keep secrets out of committed files — env vars come from the MCP client config or shell (the server never loads `.env`)
- Return raw structured data from tools — let the LLM do synthesis

## Working Rules
- All API clients in their own module under `src/`
- Handle errors with `isError: true` responses
- Use `registerTool` / `registerResource` for MCP registration
- Test manually via MCP client after changes
- Codex has an enabled `found-substack` MCP server pointing at `dist/index.js`; run `npm run build` after source changes before testing through Codex MCP.
- Use inherited `SUBSTACK_API_KEY_*` env vars; never copy token values into config or docs.

## Hallucination Prevention
See `~/.agents/AGENTS.md`. For this MCP server: sources = code and Substack API responses.

## Definition Of Done
- Changes compile (`npm run build`)
- Tests pass (`npm test`)
- MCP server starts without errors (`npm start`)

## Maintenance
- Owner: David Kelly
- Last Updated: 2026-07-01
