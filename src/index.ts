#!/usr/bin/env node

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  apiPost,
  apiRequest,
  errorResult,
  jsonResult,
  loadPublications,
  resolvePublication,
  runTool,
  writeToolsEnabled,
} from "./substack.js";
import {
  BODY_FORMATS,
  DEFAULT_BODY_FORMAT,
  formatPostBody,
} from "./post-body.js";
import {
  COMP_DEFAULT_DAYS,
  IMPORT_MAX_EMAILS,
  LIFETIME,
  SECTION_EMAIL_SETTINGS,
  compRequestBody,
} from "./subscribers.js";

const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

const publications = loadPublications();

const server = new McpServer({
  name: "substack-publisher-mcp",
  version,
});

// Read tools are GETs against an external API.
const readOnlyAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: true,
};

// Write tools add or extend subscriptions and can send email. They remove
// nothing, but repeating a call can extend a comp or resend a welcome email.
const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

// --- Shared input schemas ---

const publicationParam = z
  .string()
  .optional()
  .describe(
    "Publication name (e.g., 'ny', 'la'). Required if multiple publications are configured."
  );

// Calendar-checked, so 2026-13-45 is rejected before it reaches the API.
const dateParam = (description: string) =>
  z.iso
    .date({ error: "Use a real date in YYYY-MM-DD format" })
    .optional()
    .describe(description);

// "." and ".." survive encodeURIComponent and would resolve to other routes.
const urlSlugParam = z
  .string()
  .min(1)
  .refine((slug) => slug !== "." && slug !== "..", "Invalid URL slug")
  .describe(
    "The URL slug of the post (from list_posts results or the post URL)."
  );

// Upper bound documented in the Publisher API spec for /posts/search.
const SEARCH_MAX_RESULTS = 100;
const SEARCH_MAX_QUERY_CHARS = 512;

// Section IDs are int32 in the Publisher API spec.
const MAX_SECTION_ID = 2_147_483_647;
const sectionIdSchema = z.number().int().min(1).max(MAX_SECTION_ID);

const emailSchema = z.string().email();

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
      "List posts published by a Substack publication. Returns { posts, next }: each post has post_id, title, subtitle, audience, postDate, urlSlug, coverImage, and section ({ id, name, slug }, or null for the main publication). `next` is a cursor for the following page, or null on the last page. Use urlSlug with get_post or get_post_stats.",
    annotations: readOnlyAnnotations,
    inputSchema: {
      publication: publicationParam,
      startDate: dateParam(
        "Filter posts published on or after this date (YYYY-MM-DD)."
      ),
      endDate: dateParam(
        "Filter posts published before this date (YYYY-MM-DD, exclusive). For a single day D, use startDate D and endDate D+1."
      ),
      sortBy: z
        .enum(["newest", "oldest"])
        .optional()
        .describe("Sort order. Defaults to newest."),
      type: z
        .enum(["newsletter", "podcast", "video"])
        .optional()
        .describe("Filter by post type."),
      sectionId: sectionIdSchema
        .optional()
        .describe(
          "Only return posts published in this section. Section IDs come from each post's `section.id`."
        ),
      maxResults: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe(
          "Maximum number of posts per page. Default 100. Prefer paginating with `next` over large values."
        ),
      next: z
        .string()
        .optional()
        .describe(
          "Pagination cursor from a previous list_posts response. Pass this to get the next page of results."
        ),
    },
  },
  async (
    {
      publication,
      startDate,
      endDate,
      sortBy,
      type,
      sectionId,
      maxResults,
      next,
    },
    { signal }
  ) =>
    runTool(async () => {
      const pub = resolvePublication(publications, publication);
      return apiRequest(
        "/posts",
        pub.apiKey,
        {
          startDate,
          endDate,
          sortBy,
          type,
          sectionId: sectionId?.toString(),
          maxResults: maxResults?.toString(),
          next,
        },
        signal
      );
    })
);

// Tool 3: search_posts
server.registerTool(
  "search_posts",
  {
    title: "Search Posts",
    description:
      "Full-text search across a publication's published posts, ordered by relevance. Returns { posts } with the same fields as list_posts (no pagination).",
    annotations: readOnlyAnnotations,
    inputSchema: {
      publication: publicationParam,
      query: z
        .string()
        .min(1)
        .max(SEARCH_MAX_QUERY_CHARS)
        .describe("Search terms."),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(SEARCH_MAX_RESULTS)
        .optional()
        .describe(`Maximum number of posts to return (1-${SEARCH_MAX_RESULTS}). Default 20.`),
    },
  },
  async ({ publication, query, maxResults }, { signal }) =>
    runTool(async () => {
      const pub = resolvePublication(publications, publication);
      return apiRequest(
        "/posts/search",
        pub.apiKey,
        { query, maxResults: maxResults?.toString() },
        signal
      );
    })
);

// Tool 4: get_post
server.registerTool(
  "get_post",
  {
    title: "Get Post",
    description:
      "Get a post by its URL slug, including its full body. Returns post_id, title, subtitle, audience, postDate, urlSlug, coverImage, authors, section, and body (Markdown by default).",
    annotations: readOnlyAnnotations,
    inputSchema: {
      publication: publicationParam,
      urlSlug: urlSlugParam,
      bodyFormat: z
        .enum(BODY_FORMATS)
        .optional()
        .describe(
          "How to return the body: 'markdown' (default), 'prosemirror' (the raw JSON string from the API), or 'none' to omit it and return metadata only."
        ),
    },
  },
  async ({ publication, urlSlug, bodyFormat }, { signal }) =>
    runTool(async () => {
      const pub = resolvePublication(publications, publication);
      const post = await apiRequest(
        `/posts/${encodeURIComponent(urlSlug)}`,
        pub.apiKey,
        undefined,
        signal
      );
      return formatPostBody(post, bodyFormat ?? DEFAULT_BODY_FORMAT);
    })
);

// Tool 5: get_post_stats
server.registerTool(
  "get_post_stats",
  {
    title: "Get Post Stats",
    description:
      "Get engagement statistics for a post by its URL slug: recipients, opens, clicks, views, new free and paid subscriptions, and estimated revenue increase. Podcast and video posts add podcast downloads, Apple Podcasts and Spotify downloads, video plays, and minutes watched when available.",
    annotations: readOnlyAnnotations,
    inputSchema: {
      publication: publicationParam,
      urlSlug: urlSlugParam,
    },
  },
  async ({ publication, urlSlug }, { signal }) =>
    runTool(async () => {
      const pub = resolvePublication(publications, publication);
      return apiRequest(
        `/posts/${encodeURIComponent(urlSlug)}/stats`,
        pub.apiKey,
        undefined,
        signal
      );
    })
);

// Tool 6: get_subscriber_counts
server.registerTool(
  "get_subscriber_counts",
  {
    title: "Get Subscriber Counts",
    description:
      "Get daily subscriber counts, newest first. Each row has date, total_email_subscribers (free + paid), paid_subscribers, and free_trial, comp, gift, lifetime, and founding counts. Free subscribers = total minus paid. Without dates, returns roughly the last year.",
    annotations: readOnlyAnnotations,
    inputSchema: {
      publication: publicationParam,
      startDate: dateParam("Start of date range (YYYY-MM-DD, inclusive)."),
      endDate: dateParam("End of date range (YYYY-MM-DD, inclusive)."),
    },
  },
  async ({ publication, startDate, endDate }, { signal }) =>
    runTool(async () => {
      const pub = resolvePublication(publications, publication);
      return apiRequest(
        "/subscribers/counts",
        pub.apiKey,
        { startDate, endDate },
        signal
      );
    })
);

// Tool 7: get_subscriber
server.registerTool(
  "get_subscriber",
  {
    title: "Get Subscriber",
    description:
      "Look up a subscriber by email address. Returns user_id, subscription_id, membershipType (paying, comp, free, gift), expiry, firstPaymentAt, nextChargeDate, subscription plan details, stripe_customer_id, hasBounce, and social handles. Errors with 404 if the address is not a subscriber.",
    annotations: readOnlyAnnotations,
    inputSchema: {
      publication: publicationParam,
      email: emailSchema.describe("The subscriber's email address."),
    },
  },
  async ({ publication, email }, { signal }) =>
    runTool(async () => {
      const pub = resolvePublication(publications, publication);
      return apiRequest(
        `/subscribers/${encodeURIComponent(email)}`,
        pub.apiKey,
        undefined,
        signal
      );
    })
);

// --- Write tools (opt-in) ---
//
// Registered only when SUBSTACK_ENABLE_WRITE_TOOLS is set, so a default
// install stays read-only.

function registerWriteTools() {
  // Tool 8: import_subscribers
  server.registerTool(
    "import_subscribers",
    {
      title: "Import Subscribers",
      description: `Add up to ${IMPORT_MAX_EMAILS} email addresses as subscribers to a publication. This changes the subscriber list and, unless sendWelcomeEmails is false, emails every address. Substack queues the import, so new subscribers can take a moment to appear. Confirm the list with the user before calling.`,
      annotations: writeAnnotations,
      inputSchema: {
        publication: publicationParam,
        emailAddresses: z
          .array(emailSchema)
          .min(1)
          .max(IMPORT_MAX_EMAILS)
          .describe(
            `Email addresses to subscribe (1-${IMPORT_MAX_EMAILS} per call).`
          ),
        sendWelcomeEmails: z
          .boolean()
          .optional()
          .describe(
            "Whether Substack sends each address a welcome email. Defaults to true."
          ),
        source: z
          .string()
          .min(1)
          .optional()
          .describe("Optional source label passed to Substack with the import."),
      },
    },
    async (
      { publication, emailAddresses, sendWelcomeEmails, source },
      { signal }
    ) =>
      runTool(async () => {
        const pub = resolvePublication(publications, publication);
        const response = await apiPost(
          "/subscribers",
          pub.apiKey,
          { emailAddresses, sendWelcomeEmails, source },
          signal
        );

        // The API answers 202 with no body; report what was submitted.
        return (
          response ?? { status: "accepted", submitted: emailAddresses.length }
        );
      })
  );

  // Tool 9: comp_subscription
  server.registerTool(
    "comp_subscription",
    {
      title: "Comp Subscription",
      description: `Grant an email address free access to a paid subscription. Creates the subscription if the address is not a subscriber, and extends it if the address already has a paid one. Pass subscriptionLength or expirationDate, not both; with neither, the comp runs ${COMP_DEFAULT_DAYS} days. Returns { expirationDate }. This gives away paid access and repeating the call can extend it further, so confirm with the user before calling.`,
      annotations: writeAnnotations,
      inputSchema: {
        publication: publicationParam,
        email: emailSchema.describe("The email address to comp."),
        subscriptionLength: z
          .union([z.number().int().min(1), z.literal(LIFETIME)])
          .optional()
          .describe(
            `Number of days to comp, or '${LIFETIME}'. Defaults to ${COMP_DEFAULT_DAYS} days.`
          ),
        expirationDate: z.iso
          .datetime({ error: "Use an ISO 8601 UTC date-time" })
          .optional()
          .describe(
            "Exact expiry in ISO 8601 UTC (e.g., 2027-12-31T23:59:59Z). Must be after the current expiry."
          ),
        sendWelcomeEmails: z
          .boolean()
          .optional()
          .describe(
            "Whether Substack emails the subscriber about the comp. Defaults to true."
          ),
        sectionEmailSettings: z
          .array(
            z.object({
              sectionId: sectionIdSchema,
              setting: z.enum(SECTION_EMAIL_SETTINGS),
            })
          )
          .optional()
          .describe(
            "Per-section email settings: 'on' sends that section's emails, 'off' does not. Overrides section defaults; the subscriber's own settings still win."
          ),
      },
    },
    async ({ publication, email, ...compRequest }, { signal }) =>
      runTool(async () => {
        const pub = resolvePublication(publications, publication);
        return apiPost(
          `/subscribers/comp/${encodeURIComponent(email)}`,
          pub.apiKey,
          compRequestBody(compRequest),
          signal
        );
      })
  );
}

const writesEnabled = writeToolsEnabled();
if (writesEnabled) {
  registerWriteTools();
}

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `substack-publisher-mcp running (${publications.length} publication(s) configured, write tools ${writesEnabled ? "enabled" : "disabled"})`
  );
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
