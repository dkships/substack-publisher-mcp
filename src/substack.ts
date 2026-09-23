// --- Publication key resolution ---

export interface Publication {
  name: string;
  apiKey: string;
}

const SINGLE_KEY_VAR = "SUBSTACK_API_KEY";
const NAMED_KEY_PREFIX = "SUBSTACK_API_KEY_";
const DEFAULT_PUBLICATION = "default";

// Control characters would make fetch reject the header and echo the key.
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

export function loadPublications(
  env: NodeJS.ProcessEnv = process.env,
  warn: (message: string) => void = console.error
): Publication[] {
  const pubs: Publication[] = [];

  // Single-key config (SUBSTACK_API_KEY) first, so it wins name collisions.
  const entries: [string, string | undefined][] = [
    [SINGLE_KEY_VAR, env[SINGLE_KEY_VAR]],
    ...Object.entries(env).filter(([key]) => key.startsWith(NAMED_KEY_PREFIX)),
  ];

  for (const [variable, rawValue] of entries) {
    const apiKey = rawValue?.trim();
    if (!apiKey) {
      continue;
    }

    const name =
      variable === SINGLE_KEY_VAR
        ? DEFAULT_PUBLICATION
        : variable.slice(NAMED_KEY_PREFIX.length).trim().toLowerCase();

    if (!name) {
      warn(`${variable} has no publication name after the prefix; ignoring it.`);
      continue;
    }

    if (CONTROL_CHARS.test(apiKey)) {
      warn(`${variable} contains invalid characters; ignoring it.`);
      continue;
    }

    if (pubs.some((p) => p.name === name)) {
      warn(`${variable} duplicates publication "${name}"; ignoring it.`);
      continue;
    }

    pubs.push({ name, apiKey });
  }

  return pubs;
}

export function resolvePublication(
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
    (p) => p.name === requested.trim().toLowerCase()
  );
  if (!match) {
    throw new Error(
      `Publication "${requested}" not found. Available: ${pubs.map((p) => p.name).join(", ")}`
    );
  }
  return match;
}

// --- API client ---

export const BASE_URL = "https://publisher-api.substack.com/v1";

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ERROR_BODY_CHARS = 500;
const MAX_SNIPPET_CHARS = 200;

const REDACTED = "[REDACTED]";

export async function apiRequest(
  path: string,
  apiKey: string,
  params?: Record<string, string | undefined>,
  signal?: AbortSignal
): Promise<unknown> {
  // Keys must never reach the model, even if an error body echoes them.
  try {
    return await sendRequest(path, apiKey, params, signal);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.replaceAll(apiKey, REDACTED));
  }
}

async function sendRequest(
  path: string,
  apiKey: string,
  params?: Record<string, string | undefined>,
  signal?: AbortSignal
): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        authorization: apiKey,
        accept: "application/json",
      },
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    });
  } catch (error) {
    throw describeFetchError(error, path);
  }

  if (!response.ok) {
    const status = response.status;
    let body: string;
    try {
      body = await response.text();
    } catch {
      body = "(no response body)";
    }

    // Redact before truncating, or a key cut at the boundary slips through.
    body = body.replaceAll(apiKey, REDACTED);
    if (body.length > MAX_ERROR_BODY_CHARS) {
      body = `${body.slice(0, MAX_ERROR_BODY_CHARS)}... (truncated)`;
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

  // An empty body (e.g. 204) is valid; a non-JSON one is an upstream fault.
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    throw describeFetchError(error, path);
  }

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const contentType = response.headers.get("content-type") ?? "unknown";
    throw new Error(
      `Expected JSON from ${path} but got ${contentType}: ${text.replaceAll(apiKey, REDACTED).slice(0, MAX_SNIPPET_CHARS)}`
    );
  }
}

// fetch hides the real reason (DNS, refused, TLS) in error.cause.
function describeFetchError(error: unknown, path: string): Error {
  const name = (error as { name?: string } | null)?.name;
  if (name === "TimeoutError") {
    return new Error(
      `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s: ${path}`
    );
  }
  if (name === "AbortError") {
    return new Error(`Request cancelled: ${path}`);
  }

  const cause = (error as { cause?: unknown } | null)?.cause;
  if (cause instanceof Error) {
    return new Error(`Network error calling Substack (${path}): ${cause.message}`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

// --- Tool result helpers ---

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: true;
};

export function jsonResult(data: unknown): ToolResult {
  return {
    // Compact JSON: indentation roughly doubles the tokens a client reads.
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

export function errorResult(message: string): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

export async function runTool(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return jsonResult(await fn());
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}
