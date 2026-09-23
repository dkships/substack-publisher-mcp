import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatPostBody } from "./post-body.js";

const text = (value: string, marks?: object[]) => ({
  type: "text",
  text: value,
  ...(marks ? { marks } : {}),
});

// Mirrors the node types observed in live Publisher API post bodies.
const doc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [text("Intro")] },
    {
      type: "paragraph",
      content: [
        text("Hello "),
        text("bold", [{ type: "strong" }]),
        text(" and "),
        text("site", [{ type: "link", attrs: { href: "https://x.test" } }]),
        { type: "hard_break" },
        text("next line", [{ type: "em" }]),
      ],
    },
    {
      type: "bullet_list",
      content: [
        {
          type: "list_item",
          content: [{ type: "paragraph", content: [text("one")] }],
        },
        {
          type: "list_item",
          content: [{ type: "paragraph", content: [text("two")] }],
        },
      ],
    },
    {
      type: "captionedImage",
      content: [
        { type: "image2", attrs: { src: "https://img.test/a.png", alt: "A" } },
      ],
    },
    { type: "horizontal_rule" },
    { type: "paywall" },
    {
      type: "button",
      attrs: { url: "https://x.test/sub", text: "Subscribe" },
    },
    {
      type: "subscribeWidget",
      content: [{ type: "ctaCaption", content: [text("Thanks for reading")] }],
    },
  ],
};

// Converts a ProseMirror doc through the public entry point.
const toMarkdown = (doc: object) =>
  (formatPostBody({ body: JSON.stringify(doc) }, "markdown") as { body: string })
    .body;

const paragraph = (...content: object[]) => ({
  type: "doc",
  content: [{ type: "paragraph", content }],
});

describe("markdown conversion", () => {
  test("renders the node types Substack uses", () => {
    assert.equal(
      toMarkdown(doc),
      [
        "## Intro",
        "Hello **bold** and [site](https://x.test)\n_next line_",
        "- one\n- two",
        "![A](https://img.test/a.png)",
        "---",
        "<!-- paywall -->",
        "[Subscribe](https://x.test/sub)",
        "Thanks for reading",
      ].join("\n\n")
    );
  });

  test("numbers ordered lists from their start attribute", () => {
    const list = {
      type: "ordered_list",
      attrs: { order: 5 },
      content: ["a", "b"].map((value) => ({
        type: "list_item",
        content: [{ type: "paragraph", content: [text(value)] }],
      })),
    };
    assert.equal(toMarkdown({ type: "doc", content: [list] }), "5. a\n6. b");
  });

  test("keeps whitespace outside emphasis delimiters", () => {
    assert.equal(
      toMarkdown(paragraph(text("bold ", [{ type: "strong" }]), text("word"))),
      "**bold** word"
    );
  });

  test("clamps heading levels to Markdown's six", () => {
    const heading = { type: "heading", attrs: { level: 9 }, content: [text("h")] };
    assert.equal(toMarkdown({ type: "doc", content: [heading] }), "###### h");
  });
});

describe("formatPostBody", () => {
  const post = { title: "T", body: JSON.stringify(doc) };

  test("converts the body to markdown by default", () => {
    const result = formatPostBody(post, "markdown") as { body: string };
    assert.match(result.body, /^## Intro/);
  });

  test("leaves the raw ProseMirror string untouched", () => {
    assert.deepEqual(formatPostBody(post, "prosemirror"), post);
  });

  test("drops the body when asked", () => {
    assert.deepEqual(formatPostBody(post, "none"), { title: "T" });
  });

  test("falls back to the raw body when the document is malformed", () => {
    const broken = {
      title: "T",
      body: JSON.stringify({ type: "doc", content: [null] }),
    };
    assert.deepEqual(formatPostBody(broken, "markdown"), broken);
  });

  test("passes through a body that is not ProseMirror JSON", () => {
    const plain = { title: "T", body: "Body of the article" };
    assert.deepEqual(formatPostBody(plain, "markdown"), plain);
  });
});
