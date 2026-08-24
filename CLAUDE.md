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
