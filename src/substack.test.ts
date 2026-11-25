import { afterEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import {
  BASE_URL,
  apiPost,
  apiRequest,
  loadPublications,
  resolvePublication,
  runTool,
  writeToolsEnabled,
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

  test("trims keys and skips whitespace-only values and empty names", () => {
    const warnings: string[] = [];
    const pubs = loadPublications(
      {
        SUBSTACK_API_KEY_MAIN: "  key-main\n",
        SUBSTACK_API_KEY_TECH: "   ",
        SUBSTACK_API_KEY_: "key-nameless",
      },
      (message) => warnings.push(message)
    );
    assert.deepEqual(pubs, [{ name: "main", apiKey: "key-main" }]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /SUBSTACK_API_KEY_ has no publication name/);
  });

  test("keeps the first key when names collide, and warns", () => {
    const warnings: string[] = [];
    const pubs = loadPublications(
      {
        SUBSTACK_API_KEY: "key-single",
        SUBSTACK_API_KEY_DEFAULT: "key-default",
        SUBSTACK_API_KEY_MAIN: "key-upper",
        SUBSTACK_API_KEY_main: "key-lower",
      },
      (message) => warnings.push(message)
    );
    assert.deepEqual(pubs, [
      { name: "default", apiKey: "key-single" },
      { name: "main", apiKey: "key-upper" },
    ]);
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /SUBSTACK_API_KEY_DEFAULT.*"default"/);
    assert.match(warnings[1], /SUBSTACK_API_KEY_main.*"main"/);
  });

  test("rejects keys with control characters without echoing them", () => {
    const warnings: string[] = [];
    const pubs = loadPublications(
      { SUBSTACK_API_KEY_MAIN: "sk-secret\r\nX-Evil: 1" },
      (message) => warnings.push(message)
    );
    assert.deepEqual(pubs, []);
    assert.match(warnings[0], /SUBSTACK_API_KEY_MAIN contains invalid characters/);
    assert.doesNotMatch(warnings[0], /sk-secret/);
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

  test("ignores surrounding whitespace in the requested name", () => {
    assert.equal(resolvePublication([main, tech], " tech "), tech);
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

  test("surfaces the underlying cause of network failures", async () => {
    mock.method(globalThis, "fetch", async () => {
      throw new TypeError("fetch failed", {
        cause: Object.assign(new Error("getaddrinfo ENOTFOUND host"), {
          code: "ENOTFOUND",
        }),
      });
    });
    await assert.rejects(
      () => apiRequest("/posts", "key"),
      /Network error calling Substack \(\/posts\): getaddrinfo ENOTFOUND host/
    );
  });

  test("redacts the API key from error messages", async () => {
    mockFetch(new Response("invalid key: sk-secret", { status: 400 }));
    await assert.rejects(
      () => apiRequest("/posts", "sk-secret"),
      (error: Error) => {
        assert.doesNotMatch(error.message, /sk-secret/);
        assert.match(error.message, /\[REDACTED\]/);
        return true;
      }
    );
  });

  test("redacts a key that straddles the truncation boundary", async () => {
    const key = "sk-abcdefghijklmnopqrstuvwxyz0123456789";
    mockFetch(new Response("x".repeat(480) + key, { status: 400 }));
    await assert.rejects(
      () => apiRequest("/posts", key),
      (error: Error) => {
        assert.doesNotMatch(error.message, /sk-abc/);
        return true;
      }
    );
  });

  test("returns null for an empty success body", async () => {
    mockFetch(new Response(null, { status: 204 }));
    assert.equal(await apiRequest("/posts", "key"), null);
  });

  test("explains a non-JSON success body", async () => {
    mockFetch(
      new Response("<html>maintenance</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );
    await assert.rejects(
      () => apiRequest("/posts", "key"),
      /Expected JSON from \/posts but got text\/html: <html>maintenance/
    );
  });

  test("aborts when the caller cancels", async () => {
    mock.method(
      globalThis,
      "fetch",
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason)
          );
        })
    );
    const controller = new AbortController();
    const pending = apiRequest("/posts", "key", undefined, controller.signal);
    controller.abort();
    await assert.rejects(pending, /Request cancelled: \/posts/);
  });
});

describe("apiPost", () => {
  afterEach(() => mock.restoreAll());

  test("sends a JSON body with POST", async () => {
    const fetchMock = mock.method(
      globalThis,
      "fetch",
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const data = await apiPost("/subscribers", "key-123", {
      emailAddresses: ["a@example.com"],
    });

    assert.deepEqual(data, { ok: true });
    const [url, init] = fetchMock.mock.calls[0].arguments as [
      string,
      RequestInit,
    ];
    assert.equal(url, `${BASE_URL}/subscribers`);
    assert.equal(init.method, "POST");
    assert.equal(init.body, '{"emailAddresses":["a@example.com"]}');

    const headers = init.headers as Record<string, string>;
    assert.equal(headers.authorization, "key-123");
    assert.equal(headers["content-type"], "application/json");
  });

  test("returns null for a 202 with no body", async () => {
    mock.method(
      globalThis,
      "fetch",
      async () => new Response(null, { status: 202 })
    );
    assert.equal(await apiPost("/subscribers", "key", {}), null);
  });

  test("redacts the API key from error messages", async () => {
    mock.method(
      globalThis,
      "fetch",
      async () => new Response("bad key sk-abc", { status: 400 })
    );
    await assert.rejects(
      () => apiPost("/subscribers", "sk-abc", {}),
      (error: Error) => {
        assert.match(error.message, /API error \(400\)/);
        assert.doesNotMatch(error.message, /sk-abc/);
        return true;
      }
    );
  });
});

describe("writeToolsEnabled", () => {
  test("is off unless explicitly enabled", () => {
    assert.equal(writeToolsEnabled({}), false);
    assert.equal(writeToolsEnabled({ SUBSTACK_ENABLE_WRITE_TOOLS: "" }), false);
    assert.equal(
      writeToolsEnabled({ SUBSTACK_ENABLE_WRITE_TOOLS: "false" }),
      false
    );
  });

  test("accepts true and 1, ignoring case and whitespace", () => {
    assert.equal(
      writeToolsEnabled({ SUBSTACK_ENABLE_WRITE_TOOLS: " TRUE " }),
      true
    );
    assert.equal(writeToolsEnabled({ SUBSTACK_ENABLE_WRITE_TOOLS: "1" }), true);
  });
});

describe("runTool", () => {
  test("wraps successful results in a JSON text block", async () => {
    const result = await runTool(async () => ({ a: 1 }));
    assert.deepEqual(result, {
      content: [{ type: "text", text: JSON.stringify({ a: 1 }) }],
    });
  });

  test("wraps thrown errors in an isError envelope", async () => {
    const result = await runTool(async () => {
      throw new Error("boom");
    });
    assert.equal(result.isError, true);
    assert.equal(
      result.content[0].text,
      JSON.stringify({ error: "boom" })
    );
  });
});
