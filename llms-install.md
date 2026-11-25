# substack-publisher-mcp

MCP server for Substack's official Publisher API. Query posts, analytics, and subscriber data from any MCP client. Read-only by default; subscriber write tools are opt-in.

## Prerequisites

- Node.js >= 22
- A Substack Publisher API key (from your Substack publisher dashboard)

## Installation

```bash
git clone https://github.com/dkships/substack-publisher-mcp.git
cd substack-publisher-mcp
npm install
npm run build
```

## Configuration

Set your API key as an environment variable:

```
SUBSTACK_API_KEY=your-api-key-here
```

For multiple publications, use the naming pattern:

```
SUBSTACK_API_KEY_MAIN=your-main-blog-key
SUBSTACK_API_KEY_TECH=your-tech-newsletter-key
```

Two tools change subscriber data (`import_subscribers`, `comp_subscription`). They are registered only when this is set; leave it unset for a read-only server:

```
SUBSTACK_ENABLE_WRITE_TOOLS=true
```

## MCP Client Configuration

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

## Available Tools

- `list_publications` — List configured publications
- `list_posts` — List published posts with filtering
- `search_posts` — Full-text search across published posts
- `get_post` — Get a post and its body (Markdown by default) by URL slug
- `get_post_stats` — Get engagement stats for a post
- `get_subscriber_counts` — Get daily subscriber counts by type
- `get_subscriber` — Look up a subscriber by email

Only with `SUBSTACK_ENABLE_WRITE_TOOLS=true` (both act on the live publication; confirm with the user before calling):

- `import_subscribers` — Add up to 100 email addresses as subscribers (sends welcome emails by default)
- `comp_subscription` — Grant an email address free access to a paid subscription
