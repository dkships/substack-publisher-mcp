# Substack Publisher MCP — Agent Instructions

## What This Is
MCP server providing Substack Publisher API access. Enables agents to interact with Substack publications programmatically.

## Tech Stack
- TypeScript, ES modules, Node 22+
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
- MCP clients run `dist/index.js`; run `npm run build` after source changes before testing through a client.
- Use inherited `SUBSTACK_API_KEY_*` env vars; never copy token values into config or docs.

## Hallucination Prevention
Verify API behavior against the code and live Substack API responses; do not assume.

## Definition Of Done
- Changes compile (`npm run build`)
- Tests pass (`npm test`)
- MCP server starts without errors (`npm start`)

## Code style

Adapted from Fabien Sanglard's agent.md (2026-08-21).

- Avoid magic numbers and strings. Extract recurring or meaningful values into named constants or enums; leave self-explanatory one-off values inline. A value defined by a spec (HTTP 200, a protocol byte) gets a constant regardless.
- Reduce indentation. Use early returns and `continue` instead of nesting.
- Keep function names under 30 characters.
- Use an enum or a string-literal union instead of a boolean parameter.
- Put blank lines between logical blocks. Let the reader breathe.
- Comment what a block does and why, briefly. Use an example where it helps; offer an ASCII diagram when explaining a whole system.
- Treat a visibility change as a breaking design shift. Keep things private or unexported unless the design requires external access, and ask before widening one.
- Program to levels of abstraction. Low-level mechanics (raw SQL, socket streams, vendor SDK calls, file parsing) live behind a driver or service layer; callers work in domain concepts.
- Hold the layer boundaries. Each layer talks only to the one directly below it, with no holes punched through: a UI component never calls the database or a raw HTTP client directly.
- Don't touch code unrelated to the feature you're implementing, including adding comments to blocks you didn't write. Minimize changed lines.
- Always use braces, even on a one-line `if`.
- Fixing a bug: write the failing test first, watch it fail, then write the fix and watch it pass.

### Commit messages

- Imperative mood, capitalized subject, no trailing period. Test: "If applied, this commit will <subject>".
- Keep the subject under 72 characters. Blank line before the body.
- The body explains what and why, not how; the code shows the how. Wrap it at 72 characters.

## Maintenance
- Owner: David Kelly
- Last Updated: 2026-09-22
