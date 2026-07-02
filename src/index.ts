#!/usr/bin/env node

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  apiRequest,
  errorResult,
  jsonResult,
  loadPublications,
  resolvePublication,
  runTool,
} from "./substack.js";

const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

const publications = loadPublications();

const server = new McpServer({
  name: "substack-publisher-mcp",
  version,
});

// Every tool is a read-only GET against an external API.
const readOnlyAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: true,
};

// --- Shared input schemas ---

const publicationParam = z
  .string()
  .optional()
  .describe(
    "Publication name (e.g., 'ny', 'la'). Required if multiple publications are configured."
  );

const dateParam = (description: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
    .optional()
    .describe(description);

const urlSlugParam = z
  .string()
  .describe(
    "The URL slug of the post (from list_posts results or the post URL)."
  );

// Tool 1: list_publications
server.registerTool(
  "list_publications",
  {
    title: "List Publications",
    description:
      "List all configured Substack publications and their names. Use these names as the 'publication' parameter in other tools.",
    annotations: readOnlyAnnotations,
    inputSchema: {},
  },
  async () => {
    if (publications.length === 0) {
      return errorResult(
        "No publications configured. Set SUBSTACK_API_KEY or SUBSTACK_API_KEY_<NAME> environment variables."
      );
    }

    return jsonResult({
      publications: publications.map((p) => p.name),
      count: publications.length,
      hint:
        publications.length === 1
          ? "Single publication configured — 'publication' parameter is optional."
          : "Multiple publications configured — use the 'publication' parameter to specify which one.",
    });
  }
);

// Tool 2: list_posts
server.registerTool(
  "list_posts",
  {
    title: "List Posts",
    description:
      "List posts published by a Substack publication. Returns post metadata including title, URL slug, audience, publish date, and type. Use the urlSlug from results with get_post or get_post_stats for details.",
    annotations: readOnlyAnnotations,
    inputSchema: {
      publication: publicationParam,
      startDate: dateParam(
        "Filter posts published on or after this date (YYYY-MM-DD)."
      ),
      endDate: dateParam(
        "Filter posts published on or before this date (YYYY-MM-DD)."
      ),
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
        .min(1)
        .optional()
        .describe("Maximum number of posts to return. Default 100."),
      next: z
        .string()
        .optional()
        .describe(
          "Pagination cursor from a previous list_posts response. Pass this to get the next page of results."
        ),
    },
  },
  async ({ publication, startDate, endDate, sortBy, type, maxResults, next }) =>
    runTool(async () => {
      const pub = resolvePublication(publications, publication);
      return apiRequest("/posts", pub.apiKey, {
        startDate,
        endDate,
        sortBy,
        type,
        maxResults: maxResults?.toString(),
        next,
      });
    })
);

// Tool 3: get_post
server.registerTool(
  "get_post",
  {
    title: "Get Post",
    description:
      "Get detailed information about a specific post by its URL slug. Returns full post metadata including title, subtitle, audience, publish date, and content details.",
    annotations: readOnlyAnnotations,
    inputSchema: {
      publication: publicationParam,
      urlSlug: urlSlugParam,
    },
  },
  async ({ publication, urlSlug }) =>
    runTool(async () => {
      const pub = resolvePublication(publications, publication);
      return apiRequest(`/posts/${encodeURIComponent(urlSlug)}`, pub.apiKey);
    })
);

// Tool 4: get_post_stats
server.registerTool(
  "get_post_stats",
  {
    title: "Get Post Stats",
    description:
      "Get engagement statistics for a specific post by its URL slug. Returns metrics like opens, clicks, and other engagement data.",
    annotations: readOnlyAnnotations,
    inputSchema: {
      publication: publicationParam,
      urlSlug: urlSlugParam,
    },
  },
  async ({ publication, urlSlug }) =>
    runTool(async () => {
      const pub = resolvePublication(publications, publication);
      return apiRequest(
        `/posts/${encodeURIComponent(urlSlug)}/stats`,
        pub.apiKey
      );
    })
);

// Tool 5: get_subscriber_counts
server.registerTool(
  "get_subscriber_counts",
  {
    title: "Get Subscriber Counts",
    description:
      "Get daily subscriber counts broken down by subscription type (free, paid, etc.). Useful for tracking growth and churn over time.",
    annotations: readOnlyAnnotations,
    inputSchema: {
      publication: publicationParam,
      startDate: dateParam("Start of date range (YYYY-MM-DD)."),
      endDate: dateParam("End of date range (YYYY-MM-DD)."),
    },
  },
  async ({ publication, startDate, endDate }) =>
    runTool(async () => {
      const pub = resolvePublication(publications, publication);
      return apiRequest("/subscribers/counts", pub.apiKey, {
        startDate,
        endDate,
      });
    })
);

// Tool 6: get_subscriber
server.registerTool(
  "get_subscriber",
  {
    title: "Get Subscriber",
    description:
      "Look up a specific subscriber by email address. Returns their subscription details including type, status, and social handles.",
    annotations: readOnlyAnnotations,
    inputSchema: {
      publication: publicationParam,
      email: z.string().email().describe("The subscriber's email address."),
    },
  },
  async ({ publication, email }) =>
    runTool(async () => {
      const pub = resolvePublication(publications, publication);
      return apiRequest(
        `/subscribers/${encodeURIComponent(email)}`,
        pub.apiKey
      );
    })
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
