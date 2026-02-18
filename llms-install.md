# substack-publisher-mcp

MCP server for Substack's official Publisher API. Query posts, analytics, and subscriber data from any MCP client.

## Prerequisites

- Node.js >= 18
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
- `get_post` — Get a specific post by URL slug
- `get_post_stats` — Get engagement stats for a post
- `get_subscriber_counts` — Get daily subscriber counts by type
- `get_subscriber` — Look up a subscriber by email
