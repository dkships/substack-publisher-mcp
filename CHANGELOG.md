# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [Unreleased]

## [1.2.0] - 2026-09-22

### Added

- `search_posts` tool wrapping the Publisher API's full-text search (`/posts/search`, 1-100 results).
- `get_post` `bodyFormat` option: `markdown` (default), `prosemirror` (raw API string), or `none` (metadata only).
- Tool calls cancelled by the client now abort the in-flight API request instead of running to the 30-second timeout.

### Changed

- **Breaking:** `get_post` returns the body as Markdown by default. Substack sends a JSON-encoded ProseMirror document; on sampled posts the Markdown is 40-60% of the size. Pass `bodyFormat: "prosemirror"` for the previous output.
- **Breaking:** requires Node.js 22 or later (Node 18 and 20 are end-of-life). CI tests Node 22 and 24.
- Tool results are compact JSON, roughly halving output tokens.
- Error messages drop the `Error:` class prefix.
- Tool descriptions match live API responses: `list_posts` does not return `type`, its `endDate` is exclusive, `next` is `null` on the last page, and subscriber counts have no separate free field (free = total minus paid).
- Bumped `@modelcontextprotocol/sdk` to 1.30.0 and zod to 4.6.5; `npm audit` reports zero runtime vulnerabilities.

### Fixed

- Network failures report the underlying cause (for example DNS or connection refused) instead of `fetch failed`.
- API keys are redacted from error messages, and keys containing control characters are rejected at startup.
- Env vars that map to the same publication name (`SUBSTACK_API_KEY_MAIN` and `SUBSTACK_API_KEY_main`, or `SUBSTACK_API_KEY` and `SUBSTACK_API_KEY_DEFAULT`) no longer register twice; the first wins and a warning goes to stderr. Empty names and whitespace-only keys are skipped, and key values are trimmed.
- Dates are calendar-checked (`2026-13-45` is rejected), and the URL slugs `.`, `..`, and empty are rejected instead of hitting other endpoints.
- Empty (204) responses return `null`, and non-JSON responses produce a clear error.
- README troubleshooting no longer lists a warning the server never emitted.

## [1.1.0] - 2026-07-09

### Security

- Patched 5 transitive dependency advisories via `npm audit fix` (`ip-address`, `express-rate-limit`, `qs`). `npm audit` now reports zero vulnerabilities.
- Patched the `hono` transitive dependency advisory via `npm audit fix`; `npm audit` again reports zero vulnerabilities.

### Added

- `SECURITY.md` with the private vulnerability disclosure path and data-handling notes.
- `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1).
- This `CHANGELOG.md`.
- `.github/` directory: CI workflow (build + audit on PRs to `main`), Dependabot config (weekly npm + Actions bumps), issue templates, and a pull request template.
- Unit tests (`node:test` via `tsx`) covering key loading, publication resolution, API error mapping, and the tool result envelope; CI runs them on Node 20 and 22.
- Tool annotations (`readOnlyHint`, `idempotentHint`, `openWorldHint`) on all six tools so MCP clients can treat them as safe reads.
- 30-second timeout on Substack API requests.
- npm publish prep: `files`, `prepublishOnly`, and `mcpName` fields in package.json (not yet published).

### Changed

- Upgraded zod from 3 to 4. Validation errors for bad tool inputs use zod 4's message wording, so the text differs from 1.0.0.
- `tsconfig.json` sets `"types": ["node"]` explicitly, which TypeScript 6 and later require (this release ships 7.0.2).
- README links the LLM-client install guide (`llms-install.md`).
- Extracted env key loading, the API client, and result helpers into `src/substack.ts`; deduplicated the per-tool error envelope. No protocol-visible changes.
- Server version is read from package.json instead of a hard-coded string.
- API error messages truncate response bodies at 500 characters.
- Tightened input validation: dates must be `YYYY-MM-DD`, `maxResults` must be at least 1, `email` must be a valid address.
- CI: the blocking `npm audit` now covers runtime dependencies only; a full-tree audit runs as informational.
- README: clearer prerequisites, example prompts for all six tools, and expanded troubleshooting.

### Fixed

- `list_publications` now returns `isError: true` when no API keys are configured.
- Removed stale dotenv/`.env` references from contributor docs (the server reads env vars directly and never loaded `.env`); deleted `.env.example`.

## [1.0.0] — 2026-02-18

Initial public release. Server exposes six read-only tools (`list_publications`, `list_posts`, `get_post`, `get_post_stats`, `get_subscriber_counts`, `get_subscriber`) over stdio, wrapping Substack's official Publisher API. Supports multiple publications via `SUBSTACK_API_KEY_<NAME>` environment variables. Input validation with Zod; API key read from the environment only.
