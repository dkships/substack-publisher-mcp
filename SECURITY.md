# Security Policy

## Supported versions

Only the latest `1.x` release receives security fixes. Older releases are not patched.

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a vulnerability

Please report security issues privately to **security@dmkthinks.org** (or open a [GitHub security advisory](https://github.com/dkships/substack-publisher-mcp/security/advisories/new) if you have access). Do not open a public issue for security reports.

Expected response: acknowledgement within 5 business days. If the report is valid, a fix targets release within 30 days. We will credit reporters in the changelog unless asked otherwise.

## What's in scope

- The MCP server itself (`src/`, `dist/`)
- API key handling and publication resolution (`src/index.ts`)
- npm package supply chain (`package.json`, `package-lock.json`)

## What's out of scope

- The Substack Publisher API itself — report issues with the upstream API to Substack.
- Issues in upstream dependencies — report those to the upstream project. We monitor `npm audit` and patch transitive vulns on release.
- Misconfigured deployments (e.g., committing your own `.env`). The repo ships `.gitignore` rules for the obvious files; you are responsible for not bypassing them.
- Vulnerabilities that require an attacker to already control your local machine or your Substack API key.

## Data handling

This is a read-only server. It forwards your Substack API key in the `authorization` header and returns whatever the Publisher API sends back. Tool responses can include subscriber-level data such as email addresses and subscriber counts (`get_subscriber`, `get_subscriber_counts`). Treat tool output as sensitive:

- The server does not store, cache, or transmit your data anywhere other than between your MCP client and the Substack Publisher API.
- The API key is read from environment variables only (`SUBSTACK_API_KEY` / `SUBSTACK_API_KEY_<NAME>`). It is never written to disk or logged.
- The base URL is hardcoded to `https://publisher-api.substack.com/v1`; user input cannot redirect requests to another host.
- URL path parameters (`urlSlug`, `email`) are `encodeURIComponent`-escaped before they reach the API.

## Hardening notes for operators

- Treat `.env` as a credential file. Do not commit it. Do not paste its contents into chat logs or issue trackers.
- Use a separate Substack API key per publication, scoped to the publications you actually need.
- The server only speaks stdio (`StdioServerTransport`); it does not bind a network port. If you wrap it in a network-exposed transport, you are responsible for authentication.
