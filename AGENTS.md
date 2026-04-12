# Substack Publisher MCP — Agent Instructions

## What This Is
MCP server providing Substack Publisher API access. Enables agents to interact with Substack publications programmatically.

## Tech Stack
- TypeScript, ES modules, Node 18+
- `@modelcontextprotocol/sdk` with stdio transport
- Hono (HTTP framework)
- Express for MCP transport

## Scope And Boundaries
- This is a self-managed repo (dkships/substack-publisher-mcp)
- Keep secrets out of committed files — use `.env` via dotenv
- Return raw structured data from tools — let the LLM do synthesis

## Working Rules
- All API clients in their own module under `src/`
- Handle errors with `isError: true` responses
- Use `registerTool` / `registerResource` for MCP registration
- Test manually via MCP client after changes

## Hallucination Prevention
See `~/.agents/AGENTS.md`. For this MCP server: sources = code and Substack API responses.

## Definition Of Done
- Changes compile (`npm run build`)
- MCP server starts without errors (`npm start`)

## Maintenance
- Owner: David Kelly
- Last Updated: 2026-03-28
