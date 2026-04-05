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

## Accuracy Guardrails
- If uncertain about MCP protocol details or Substack API behavior, say "I don't know" rather than guessing
- Read the relevant source file before making claims about its implementation
- Verify functions and types exist in the codebase before referencing them
- After generating claims or recommendations, self-verify each against the source material; retract any claim that lacks a supporting code reference
- When source documents or API docs are provided, base analysis strictly on those sources — explicitly flag when drawing on general knowledge instead
