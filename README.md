# substack-publisher-mcp

**MCP server for Substack's official Publisher API**

[![npm version](https://img.shields.io/npm/v/substack-publisher-mcp)](https://www.npmjs.com/package/substack-publisher-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple)](https://modelcontextprotocol.io)

> **Note:** This is an unofficial, community-developed tool and is not affiliated with, endorsed by, or supported by Substack, Inc.

The first MCP server for Substack's official [Publisher API](https://publisher-api.substack.com/v1/docs/). Query post analytics, subscriber counts, and publication data directly from Claude, Cursor, or any MCP client.

## Why this server?

| | substack-publisher-mcp | Other Substack MCP servers |
|---|---|---|
| **API** | Official Publisher API | Unofficial internal API |
| **Auth** | API key (stable) | Browser cookies (fragile) |
| **Stability** | Supported by Substack | Breaks when Substack changes internals |
| **Multi-publication** | Built-in support | Not available |

## Quick Start

### 1. Get your API key

Go to your Substack publisher dashboard and generate a Publisher API key.

### 2. Add to your MCP client

#### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

#### Claude Code

Add to `.mcp.json` in your project directory:

```json
{
  "mcpServers": {
    "substack": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/substack-publisher-mcp/dist/index.js"],
      "env": {
        "SUBSTACK_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

#### Cursor

Add to `.cursor/mcp.json`:

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

### 3. Start using it

Ask Claude: *"Show me my recent posts"* or *"What are my subscriber counts for the last 30 days?"*

## Tools

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_publications` | List configured publications | None |
| `list_posts` | List published posts | `startDate`, `endDate`, `sortBy`, `type`, `maxResults`, `next` |
| `get_post` | Get a specific post by URL slug | `urlSlug` (required) |
| `get_post_stats` | Get engagement stats for a post | `urlSlug` (required) |
| `get_subscriber_counts` | Get daily subscriber counts by type | `startDate`, `endDate` |
| `get_subscriber` | Look up a subscriber by email | `email` (required) |

All tools accept an optional `publication` parameter when multiple publications are configured.

### Example responses

#### `get_subscriber_counts`

```json
[
  {
    "date": "2026-02-18",
    "total_email_subscribers": 57305,
    "paid_subscribers": 1163,
    "free_trial_subscribers": 2,
    "comp_subscribers": 144,
    "gift_subscribers": 5,
    "lifetime_subscribers": 0,
    "founding_subscribers": 10
  }
]
```

#### `get_post_stats`

```json
{
  "clicks": 142,
  "opens": 8453,
  "post_id": 188286338,
  "recipients": 12500,
  "views": 9200,
  "new_free_subscriptions": 45,
  "new_paid_subscriptions": 3,
  "estimated_revenue_increase": 240
}
```

#### `list_posts`

```json
{
  "posts": [
    {
      "title": "Example Post",
      "audience": "only_paid",
      "subtitle": "A great subtitle",
      "postDate": "2026-02-17T17:17:07.430Z",
      "urlSlug": "example-post",
      "coverImage": "https://..."
    }
  ],
  "next": "cursor-for-next-page"
}
```

## Multiple publications

If you manage multiple Substack publications, configure a separate API key for each using the `SUBSTACK_API_KEY_<NAME>` pattern:

```json
{
  "mcpServers": {
    "substack": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/substack-publisher-mcp/dist/index.js"],
      "env": {
        "SUBSTACK_API_KEY_NY": "your-ny-key",
        "SUBSTACK_API_KEY_LA": "your-la-key",
        "SUBSTACK_API_KEY_SF": "your-sf-key"
      }
    }
  }
}
```

Then specify which publication to query:

> *"Show me subscriber counts for NY"*
> *"List recent posts from the LA publication"*

Use `list_publications` to see all configured publication names.

## Development

```bash
git clone https://github.com/yourusername/substack-publisher-mcp.git
cd substack-publisher-mcp
npm install
npm run build
```

## API Reference

This server wraps the [Substack Publisher API](https://publisher-api.substack.com/v1/docs/). See Substack's documentation for details on available data and rate limits.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License. See [LICENSE](LICENSE) for details.

---

Substack is a trademark of Substack, Inc. This project is not affiliated with Substack, Inc. Use of the Substack name is for descriptive purposes only.
