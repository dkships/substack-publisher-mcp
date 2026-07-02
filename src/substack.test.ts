import { afterEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import {
  BASE_URL,
  apiRequest,
  loadPublications,
  resolvePublication,
  runTool,
} from "./substack.js";

describe("loadPublications", () => {
  test("single key becomes the 'default' publication", () => {
    const pubs = loadPublications({ SUBSTACK_API_KEY: "key-1" });
    assert.deepEqual(pubs, [{ name: "default", apiKey: "key-1" }]);
  });

  test("named keys are parsed and lowercased", () => {
    const pubs = loadPublications({
      SUBSTACK_API_KEY_MAIN: "key-main",
      SUBSTACK_API_KEY_TECH: "key-tech",
    });
    assert.deepEqual(pubs, [
      { name: "main", apiKey: "key-main" },
      { name: "tech", apiKey: "key-tech" },
    ]);
  });

  test("single and named keys can coexist", () => {
    const pubs = loadPublications({
      SUBSTACK_API_KEY: "key-1",
      SUBSTACK_API_KEY_MAIN: "key-main",
    });
    assert.deepEqual(
      pubs.map((p) => p.name),
      ["default", "main"]
    );
  });

  test("empty env and empty values yield no publications", () => {
    assert.deepEqual(loadPublications({}), []);
    assert.deepEqual(loadPublications({ SUBSTACK_API_KEY_MAIN: "" }), []);
  });
});

describe("resolvePublication", () => {
  const main = { name: "main", apiKey: "a" };
  const tech = { name: "tech", apiKey: "b" };

  test("throws when no keys are configured", () => {
    assert.throws(() => resolvePublication([]), /No API keys configured/);
  });

  test("returns the only publication when none is requested", () => {
    assert.equal(resolvePublication([main]), main);
  });

  test("throws when multiple are configured and none is requested", () => {
    assert.throws(
      () => resolvePublication([main, tech]),
      /Multiple publications configured \(main, tech\)/
    );
  });

  test("matches case-insensitively", () => {
    assert.equal(resolvePublication([main, tech], "TECH"), tech);
  });

  test("throws for an unknown name, listing available ones", () => {
    assert.throws(
      () => resolvePublication([main, tech], "nope"),
      /Publication "nope" not found\. Available: main, tech/
    );
  });
});

describe("apiRequest", () => {
  afterEach(() => mock.restoreAll());

  const mockFetch = (response: Response) =>
    mock.method(globalThis, "fetch", async () => response);

  test("sets the auth header and skips undefined/empty params", async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const data = await apiRequest("/posts", "key-123", {
      startDate: "2026-01-01",
      endDate: undefined,
      next: "",
    });

    assert.deepEqual(data, { ok: true });
    const [url, init] = fetchMock.mock.calls[0].arguments;
    assert.equal(url, `${BASE_URL}/posts?startDate=2026-01-01`);
    assert.equal(
      (init?.headers as Record<string, string>).authorization,
      "key-123"
    );
  });

  test("maps 401 to an invalid-key error", async () => {
    mockFetch(new Response("nope", { status: 401 }));
    await assert.rejects(
      () => apiRequest("/posts", "bad-key"),
      /Unauthorized \(401\): Invalid API key\. nope/
    );
  });

  test("maps 404 to a not-found error", async () => {
    mockFetch(new Response("missing", { status: 404 }));
    await assert.rejects(
      () => apiRequest("/posts/xyz", "key"),
      /Not found \(404\): missing/
    );
  });

  test("maps 429 to a rate-limit error", async () => {
    mockFetch(new Response("slow down", { status: 429 }));
    await assert.rejects(
      () => apiRequest("/posts", "key"),
      /Rate limited \(429\): slow down/
    );
  });

  test("maps other statuses to a generic API error", async () => {
    mockFetch(new Response("boom", { status: 500 }));
    await assert.rejects(
      () => apiRequest("/posts", "key"),
      /API error \(500\): boom/
    );
  });

  test("truncates long error bodies", async () => {
    mockFetch(new Response("x".repeat(2000), { status: 500 }));
    await assert.rejects(
      () => apiRequest("/posts", "key"),
      (error: Error) => {
        assert.match(error.message, /\.\.\. \(truncated\)$/);
        assert.ok(error.message.length < 600);
        return true;
      }
    );
  });
});

describe("runTool", () => {
  test("wraps successful results in a JSON text block", async () => {
    const result = await runTool(async () => ({ a: 1 }));
    assert.deepEqual(result, {
      content: [{ type: "text", text: JSON.stringify({ a: 1 }, null, 2) }],
    });
  });

  test("wraps thrown errors in an isError envelope", async () => {
    const result = await runTool(async () => {
      throw new Error("boom");
    });
    assert.equal(result.isError, true);
    assert.equal(
      result.content[0].text,
      JSON.stringify({ error: "Error: boom" }, null, 2)
    );
  });
});
