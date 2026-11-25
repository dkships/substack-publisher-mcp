# substack-publisher-mcp

**MCP server for Substack's official Publisher API**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple)](https://modelcontextprotocol.io)

> **Note:** This is an unofficial, community-developed tool and is not affiliated with, endorsed by, or supported by Substack, Inc.

An MCP server for Substack's official [Publisher API](https://publisher-api.substack.com/v1/docs/). Search and read posts, pull post analytics and subscriber counts, and look up subscribers from Claude, Cursor, or any MCP client. The server is read-only by default; tools that import subscribers and comp subscriptions are [opt-in](#write-tools-opt-in).

![Demo of substack-publisher-mcp in Claude Code](demo.gif)

## Why this server?

| | substack-publisher-mcp | Other Substack MCP servers |
|---|---|---|
| **API** | Official Publisher API | Unofficial internal API |
| **Auth** | API key (stable) | Browser cookies (fragile) |
| **Stability** | Official, documented API | Breaks when Substack changes internals |
| **Multi-publication** | Built-in support | Not available |

## Prerequisites

- **Node.js 22+.** Check with `node --version`; install from [nodejs.org](https://nodejs.org) if missing.
- **Substack Publisher API key.** Generate one from your publication's Substack dashboard. If you don't see a Publisher API option there, it may not be enabled for your publication yet; see the [Publisher API docs](https://publisher-api.substack.com/v1/docs/) for availability.

## Quick Start

### 1. Install

```bash
git clone https://github.com/dkships/substack-publisher-mcp.git
cd substack-publisher-mcp
npm install && npm run build
```

### 2. Configure your MCP client

Add to your client's MCP config file (create the file if it doesn't exist):

| Client | Config file |
|--------|-------------|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Code | `.mcp.json` in your project directory |
| Cursor | `.cursor/mcp.json` |

```json
{
  "mcpServers": {
    "substack": {
      "command": "node",
      "args": ["/path/to/substack-publisher-mcp/dist/index.js"],
      "env": {
        "SUBSTACK_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

> **Claude Code users:** Add `"type": "stdio"` to the server config.

Restart your MCP client after editing the config — servers load at startup.

### 3. Start using it

Ask Claude (or your MCP client):

- *"Which Substack publications do I have configured?"*
- *"Show me my posts from the last month"*
- *"Find my posts about pricing"*
- *"Pull up my post with the slug my-latest-post"*
- *"How many opens and clicks did my latest post get?"*
- *"What are my subscriber counts for the last 30 days?"*
- *"Look up subscriber jane@example.com"*

> Installing through an AI agent or registry? See [llms-install.md](llms-install.md) for a condensed, machine-readable setup guide.

## Tools

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_publications` | List configured publications | None |
| `list_posts` | List published posts | `startDate`, `endDate`, `sortBy`, `type`, `sectionId`, `maxResults`, `next` |
| `search_posts` | Full-text search across published posts | `query` (required), `maxResults` (1-100) |
| `get_post` | Get a post and its body by URL slug | `urlSlug` (required), `bodyFormat` |
| `get_post_stats` | Get engagement stats for a post | `urlSlug` (required) |
| `get_subscriber_counts` | Get daily subscriber counts by type | `startDate`, `endDate` |
| `get_subscriber` | Look up a subscriber by email | `email` (required) |

All tools except `list_publications` accept an optional `publication` parameter when multiple publications are configured.

`get_post` returns the post body as Markdown by default. Substack sends it as a JSON-encoded ProseMirror document, typically about twice the size. Pass `bodyFormat: "prosemirror"` for the raw document or `"none"` for metadata only.

Date filters take `YYYY-MM-DD`. In `list_posts`, `endDate` is exclusive; in `get_subscriber_counts`, it is inclusive.

Each post carries a `section` (`{ id, name, slug }`, or `null` for the main publication). Pass a section's `id` as `sectionId` to `list_posts` to list only that section.

### Write tools (opt-in)

Two tools change subscriber data. They are not registered unless you set `SUBSTACK_ENABLE_WRITE_TOOLS` to `true` in the server's `env`:

```json
"env": {
  "SUBSTACK_API_KEY": "your-api-key-here",
  "SUBSTACK_ENABLE_WRITE_TOOLS": "true"
}
```

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `import_subscribers` | Add up to 100 email addresses as subscribers | `emailAddresses` (required), `sendWelcomeEmails`, `source` |
| `comp_subscription` | Grant an email address free access to a paid subscription | `email` (required), `subscriptionLength` (days or `"lifetime"`) or `expirationDate`, `sendWelcomeEmails`, `sectionEmailSettings` |

Both act on your live publication and neither can be undone through this server:

- `import_subscribers` emails every address a welcome message unless `sendWelcomeEmails` is `false`. Substack queues the import, so the tool returns `{ "status": "accepted", "submitted": <count> }` before the subscribers appear.
- `comp_subscription` creates a subscription if the address has none and extends an existing paid one. With neither `subscriptionLength` nor `expirationDate` it comps 30 days; passing both is an error. It returns the new `expirationDate`.

Keep your MCP client's approval prompt on for these tools. Post bodies and subscriber data are untrusted text, and an agent that reads them with auto-approved write tools could be talked into comping an address you never chose.

### Example responses

<details>
<summary><code>get_subscriber_counts</code></summary>

```json
[
  {
    "date": "2025-01-15",
    "total_email_subscribers": 25000,
    "paid_subscribers": 500,
    "free_trial_subscribers": 10,
    "comp_subscribers": 50,
    "gift_subscribers": 15,
    "lifetime_subscribers": 0,
    "founding_subscribers": 25
  }
]
```
</details>

<details>
<summary><code>get_post_stats</code></summary>

```json
{
  "clicks": 320,
  "opens": 5400,
  "post_id": 12345678,
  "recipients": 10000,
  "views": 6100,
  "new_free_subscriptions": 80,
  "new_paid_subscriptions": 5,
  "estimated_revenue_increase": 400
}
```

Podcast and video posts add `podcast_downloads`, `podcast_preview_downloads`, `apple_podcasts_downloads`, `apple_podcasts_downloads_day30`, `spotify_downloads`, `spotify_preview_downloads`, `video_plays`, and `video_minutes_watched` when Substack has them.
</details>

<details>
<summary><code>list_posts</code></summary>

```json
{
  "posts": [
    {
      "post_id": 12345678,
      "title": "My Latest Post",
      "audience": "only_paid",
      "subtitle": "A deep dive into the topic",
      "postDate": "2025-01-15T12:00:00.000Z",
      "urlSlug": "my-latest-post",
      "coverImage": "https://substackcdn.com/image/...",
      "section": { "id": 4821, "name": "Deep Dives", "slug": "deep-dives" }
    }
  ],
  "next": "abc123cursor"
}
```

`next` is `null` on the last page. `section` is `null` for posts in the main publication.
</details>

## Multiple publications

If you manage multiple Substack publications, configure a separate API key for each using the `SUBSTACK_API_KEY_<NAME>` pattern:

```json
{
  "mcpServers": {
    "substack": {
      "command": "node",
      "args": ["/path/to/substack-publisher-mcp/dist/index.js"],
      "env": {
        "SUBSTACK_API_KEY_MAIN": "your-main-blog-key",
        "SUBSTACK_API_KEY_TECH": "your-tech-newsletter-key",
        "SUBSTACK_API_KEY_COMPANY": "your-company-updates-key"
      }
    }
  }
}
```

Then specify which publication to query:

> *"Show me subscriber counts for main"*
> *"List recent posts from the tech publication"*

Use `list_publications` to see all configured publication names.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Unauthorized` error | Verify your API key is correct. The key goes directly in the `authorization` header with no `Bearer` prefix. |
| `... duplicates publication ...` or `... ignoring it` on startup | Two env vars map to the same publication name (names are case-insensitive, and `SUBSTACK_API_KEY` is `default`), or a key is malformed. Rename or remove the extra variable. |
| Server won't start | Make sure you ran `npm run build` after cloning. The server runs from `dist/`, not `src/`. |
| `No API keys configured` | Set `SUBSTACK_API_KEY` or `SUBSTACK_API_KEY_<NAME>` in your MCP client config. |
| `import_subscribers` / `comp_subscription` missing | Write tools are off by default. Set `SUBSTACK_ENABLE_WRITE_TOOLS` to `true` and restart the client. |
| Server doesn't appear in your client | Check the config file is valid JSON (no trailing commas), then restart the client. |
| `command not found` / `spawn node ENOENT` | Node.js isn't installed or isn't on your PATH. Check `node --version`. |
| Still stuck | Check your client's MCP logs. Claude Desktop on macOS: `~/Library/Logs/Claude/mcp*.log`. |

## API Reference

This server wraps the [Substack Publisher API](https://publisher-api.substack.com/v1/docs/). See Substack's documentation for details on available data and rate limits.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License. See [LICENSE](LICENSE) for details.

---

Substack is a trademark of Substack, Inc. This project is not affiliated with Substack, Inc. Use of the Substack name is for descriptive purposes only.
