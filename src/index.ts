#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// --- Publication key resolution ---

interface Publication {
  name: string;
  apiKey: string;
}

function loadPublications(): Publication[] {
  const pubs: Publication[] = [];

  // Check for single-key config: SUBSTACK_API_KEY
  const singleKey = process.env.SUBSTACK_API_KEY;
  if (singleKey) {
    pubs.push({ name: "default", apiKey: singleKey });
  }

  // Check for multi-key config: SUBSTACK_API_KEY_<NAME>
  const prefix = "SUBSTACK_API_KEY_";
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && key !== "SUBSTACK_API_KEY" && value) {
      const name = key.slice(prefix.length).toLowerCase();
      pubs.push({ name, apiKey: value });
    }
  }

  return pubs;
}

function resolvePublication(
  pubs: Publication[],
  requested?: string
): Publication {
  if (pubs.length === 0) {
    throw new Error(
      "No API keys configured. Set SUBSTACK_API_KEY or SUBSTACK_API_KEY_<NAME> environment variables."
    );
  }

  if (!requested) {
    if (pubs.length === 1) {
      return pubs[0];
    }
    throw new Error(
      `Multiple publications configured (${pubs.map((p) => p.name).join(", ")}). Specify the 'publication' parameter.`
    );
  }

  const match = pubs.find(
    (p) => p.name === requested.toLowerCase()
  );
  if (!match) {
    throw new Error(
      `Publication "${requested}" not found. Available: ${pubs.map((p) => p.name).join(", ")}`
    );
  }
  return match;
}

// --- API client ---

const BASE_URL = "https://publisher-api.substack.com/v1";

async function apiRequest(
  path: string,
  apiKey: string,
  params?: Record<string, string | undefined>
): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      authorization: apiKey,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const status = response.status;
    let body: string;
    try {
      body = await response.text();
    } catch {
      body = "(no response body)";
    }

    if (status === 401) {
      throw new Error(`Unauthorized (401): Invalid API key. ${body}`);
    }
    if (status === 404) {
      throw new Error(`Not found (404): ${body}`);
    }
    if (status === 429) {
      throw new Error(`Rate limited (429): ${body}`);
    }
    throw new Error(`API error (${status}): ${body}`);
  }

  return response.json();
}

// --- MCP Server ---

const publications = loadPublications();

const server = new McpServer({
  name: "substack-publisher-mcp",
  version: "1.0.0",
});

// Tool 1: list_publications
server.tool(
  "list_publications",
  "List all configured Substack publications and their names. Use these names as the 'publication' parameter in other tools.",
  {},
  async () => {
    if (publications.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                error:
                  "No publications configured. Set SUBSTACK_API_KEY or SUBSTACK_API_KEY_<NAME> environment variables.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              publications: publications.map((p) => p.name),
              count: publications.length,
              hint:
                publications.length === 1
                  ? "Single publication configured — 'publication' parameter is optional."
                  : "Multiple publications configured — use the 'publication' parameter to specify which one.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// Tool 2: list_posts
server.tool(
  "list_posts",
  "List posts published by a Substack publication. Returns post metadata including title, URL slug, audience, publish date, and type. Use the urlSlug from results with get_post or get_post_stats for details.",
  {
    publication: z
      .string()
      .optional()
      .describe(
        "Publication name (e.g., 'ny', 'la'). Required if multiple publications are configured."
      ),
    startDate: z
      .string()
      .optional()
      .describe("Filter posts published on or after this date (YYYY-MM-DD)."),
    endDate: z
      .string()
      .optional()
      .describe("Filter posts published on or before this date (YYYY-MM-DD)."),
    sortBy: z
      .enum(["newest", "oldest"])
      .optional()
      .describe("Sort order. Defaults to newest."),
    type: z
      .enum(["newsletter", "podcast", "video"])
      .optional()
      .describe("Filter by post type."),
    maxResults: z
      .number()
      .int()
      .optional()
      .describe("Maximum number of posts to return. Default 100."),
    next: z
      .string()
      .optional()
      .describe(
        "Pagination cursor from a previous list_posts response. Pass this to get the next page of results."
      ),
  },
  async ({ publication, startDate, endDate, sortBy, type, maxResults, next }) => {
    try {
      const pub = resolvePublication(publications, publication);
      const data = await apiRequest("/posts", pub.apiKey, {
        startDate,
        endDate,
        sortBy,
        type,
        maxResults: maxResults?.toString(),
        next,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: String(error) }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool 3: get_post
server.tool(
  "get_post",
  "Get detailed information about a specific post by its URL slug. Returns full post metadata including title, subtitle, audience, publish date, and content details.",
  {
    publication: z
      .string()
      .optional()
      .describe(
        "Publication name (e.g., 'ny', 'la'). Required if multiple publications are configured."
      ),
    urlSlug: z
      .string()
      .describe(
        "The URL slug of the post (from list_posts results or the post URL)."
      ),
  },
  async ({ publication, urlSlug }) => {
    try {
      const pub = resolvePublication(publications, publication);
      const data = await apiRequest(`/posts/${encodeURIComponent(urlSlug)}`, pub.apiKey);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: String(error) }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool 4: get_post_stats
server.tool(
  "get_post_stats",
  "Get engagement statistics for a specific post by its URL slug. Returns metrics like opens, clicks, and other engagement data.",
  {
    publication: z
      .string()
      .optional()
      .describe(
        "Publication name (e.g., 'ny', 'la'). Required if multiple publications are configured."
      ),
    urlSlug: z
      .string()
      .describe(
        "The URL slug of the post (from list_posts results or the post URL)."
      ),
  },
  async ({ publication, urlSlug }) => {
    try {
      const pub = resolvePublication(publications, publication);
      const data = await apiRequest(
        `/posts/${encodeURIComponent(urlSlug)}/stats`,
        pub.apiKey
      );
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: String(error) }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool 5: get_subscriber_counts
server.tool(
  "get_subscriber_counts",
  "Get daily subscriber counts broken down by subscription type (free, paid, etc.). Useful for tracking growth and churn over time.",
  {
    publication: z
      .string()
      .optional()
      .describe(
        "Publication name (e.g., 'ny', 'la'). Required if multiple publications are configured."
      ),
    startDate: z
      .string()
      .optional()
      .describe("Start of date range (YYYY-MM-DD)."),
    endDate: z
      .string()
      .optional()
      .describe("End of date range (YYYY-MM-DD)."),
  },
  async ({ publication, startDate, endDate }) => {
    try {
      const pub = resolvePublication(publications, publication);
      const data = await apiRequest("/subscribers/counts", pub.apiKey, {
        startDate,
        endDate,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: String(error) }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool 6: get_subscriber
server.tool(
  "get_subscriber",
  "Look up a specific subscriber by email address. Returns their subscription details including type, status, and social handles.",
  {
    publication: z
      .string()
      .optional()
      .describe(
        "Publication name (e.g., 'ny', 'la'). Required if multiple publications are configured."
      ),
    email: z.string().describe("The subscriber's email address."),
  },
  async ({ publication, email }) => {
    try {
      const pub = resolvePublication(publications, publication);
      const data = await apiRequest(
        `/subscribers/${encodeURIComponent(email)}`,
        pub.apiKey
      );
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: String(error) }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }
);

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `substack-publisher-mcp running (${publications.length} publication(s) configured)`
  );
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
