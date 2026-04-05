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
- When analyzing code or API responses, extract verbatim quotes before drawing conclusions — do not paraphrase from memory
- After generating claims, verify each against source material and remove any that lack supporting evidence
- When source documents are provided, restrict analysis to those sources — explicitly flag any use of general training knowledge
- For complex reasoning, show intermediate steps before final conclusions

## Definition Of Done
- Changes compile (`npm run build`)
- MCP server starts without errors (`npm start`)

## Maintenance
- Owner: David Kelly
- Last Updated: 2026-03-28
