# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

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
- `tsconfig.json` sets `"types": ["node"]` explicitly, which TypeScript 6 requires.
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
