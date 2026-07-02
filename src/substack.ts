// --- Publication key resolution ---

export interface Publication {
  name: string;
  apiKey: string;
}

export function loadPublications(
  env: NodeJS.ProcessEnv = process.env
): Publication[] {
  const pubs: Publication[] = [];

  // Check for single-key config: SUBSTACK_API_KEY
  const singleKey = env.SUBSTACK_API_KEY;
  if (singleKey) {
    pubs.push({ name: "default", apiKey: singleKey });
  }

  // Check for multi-key config: SUBSTACK_API_KEY_<NAME>
  const prefix = "SUBSTACK_API_KEY_";
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith(prefix) && key !== "SUBSTACK_API_KEY" && value) {
      const name = key.slice(prefix.length).toLowerCase();
      pubs.push({ name, apiKey: value });
    }
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

export const BASE_URL = "https://publisher-api.substack.com/v1";

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ERROR_BODY_CHARS = 500;

export async function apiRequest(
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

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        authorization: apiKey,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if ((error as { name?: string } | null)?.name === "TimeoutError") {
      throw new Error(
        `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s: ${path}`
      );
    }
    throw error;
  }

  if (!response.ok) {
    const status = response.status;
    let body: string;
    try {
      body = await response.text();
    } catch {
      body = "(no response body)";
    }
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

  return response.json();
}

// --- Tool result helpers ---

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: true;
};

export function jsonResult(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function errorResult(message: string): ToolResult {
  return {
    content: [
      { type: "text", text: JSON.stringify({ error: message }, null, 2) },
    ],
    isError: true,
  };
}

export async function runTool(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return jsonResult(await fn());
  } catch (error) {
    return errorResult(String(error));
  }
}
