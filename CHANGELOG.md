# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [Unreleased]

### Security

- Patched 5 transitive dependency advisories via `npm audit fix` (`ip-address`, `express-rate-limit`, `qs`). `npm audit` now reports zero vulnerabilities.

### Added

- `SECURITY.md` with the private vulnerability disclosure path and data-handling notes.
- `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1).
- This `CHANGELOG.md`.
- `.github/` directory: CI workflow (build + audit on PRs to `main`), Dependabot config (weekly npm + Actions bumps), issue templates, and a pull request template.

### Changed

- README links the LLM-client install guide (`llms-install.md`).

## [1.0.0] — 2026-02-18

Initial public release. Server exposes six read-only tools (`list_publications`, `list_posts`, `get_post`, `get_post_stats`, `get_subscriber_counts`, `get_subscriber`) over stdio, wrapping Substack's official Publisher API. Supports multiple publications via `SUBSTACK_API_KEY_<NAME>` environment variables. Input validation with Zod; API key read from the environment only.
