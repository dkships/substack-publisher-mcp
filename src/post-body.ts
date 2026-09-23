// --- Post body formatting ---
//
// The Publisher API returns a post's `body` as a JSON-encoded ProseMirror
// document: tens of KB of nested nodes for a typical post. Markdown keeps
// the structure a reader needs at a fraction of the tokens.
//
//   body: '{"type":"doc","content":[{"type":"heading",...}]}'
//     -> "## Intro\n\nHello **bold** and [site](https://...)"

export const BODY_FORMATS = ["markdown", "prosemirror", "none"] as const;
export type BodyFormat = (typeof BODY_FORMATS)[number];
export const DEFAULT_BODY_FORMAT: BodyFormat = "markdown";

interface PmMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface PmNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: PmMark[];
  content?: PmNode[];
}

const BLOCK_SEPARATOR = "\n\n";
const MAX_HEADING_LEVEL = 6;
const PAYWALL_MARKER = "<!-- paywall -->";

export function formatPostBody(post: unknown, format: BodyFormat): unknown {
  if (format === "prosemirror" || !isRecord(post) || !("body" in post)) {
    return post;
  }

  if (format === "none") {
    const { body: _body, ...rest } = post;
    return rest;
  }

  const doc = parseDoc(post.body);
  if (!doc) {
    return post;
  }

  // A document shape we don't expect should not cost the caller the post.
  try {
    return { ...post, body: renderBlocks(doc.content ?? []) };
  } catch {
    return post;
  }
}

function parseDoc(body: unknown): PmNode | undefined {
  if (typeof body !== "string") {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(body);
    return isRecord(parsed) && parsed.type === "doc"
      ? (parsed as unknown as PmNode)
      : undefined;
  } catch {
    return undefined;
  }
}

function renderBlocks(nodes: PmNode[]): string {
  return nodes
    .map(renderBlock)
    .filter((block) => block !== "")
    .join(BLOCK_SEPARATOR);
}

function renderBlock(node: PmNode): string {
  const children = node.content ?? [];

  switch (node.type) {
    case "paragraph":
      return renderInline(children);
    case "heading":
      return `${"#".repeat(headingLevel(node))} ${renderInline(children)}`;
    case "bullet_list":
      return renderList(children, () => "- ");
    case "ordered_list":
      return renderList(children, (index) => `${listStart(node) + index}. `);
    case "blockquote":
      return prefixLines(renderBlocks(children), "> ");
    case "code_block":
      return "```\n" + renderInline(children) + "\n```";
    case "horizontal_rule":
      return "---";
    case "paywall":
      return PAYWALL_MARKER;
    case "image2":
      return `![${attr(node, "alt")}](${attr(node, "src")})`;
    case "button":
      return `[${attr(node, "text")}](${attr(node, "url")})`;
    default:
      // Wrappers (captionedImage, subscribeWidget, ...) and unknown nodes:
      // keep whatever content they hold.
      return children.some((child) => child.type === "text")
        ? renderInline(children)
        : renderBlocks(children);
  }
}

function renderList(
  items: PmNode[],
  bullet: (index: number) => string
): string {
  return items
    .map((item, index) => {
      const marker = bullet(index);
      const indent = " ".repeat(marker.length);
      const body = renderBlocks(item.content ?? []);
      return marker + body.split("\n").join(`\n${indent}`);
    })
    .join("\n");
}

function renderInline(nodes: PmNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "hard_break") {
        return "\n";
      }
      if (node.type !== "text") {
        return renderBlock(node);
      }
      return applyMarks(node.text ?? "", node.marks ?? []);
    })
    .join("");
}

// Delimiters must hug the text: "**bold **word" is not bold in Markdown.
function applyMarks(text: string, marks: PmMark[]): string {
  const [, lead, core, trail] = text.match(/^(\s*)(.*?)(\s*)$/s) ?? ["", "", text, ""];
  if (!core) {
    return text;
  }

  let result = core;
  for (const mark of marks) {
    if (mark.type === "strong") {
      result = `**${result}**`;
    } else if (mark.type === "em") {
      result = `_${result}_`;
    } else if (mark.type === "code") {
      result = `\`${result}\``;
    } else if (mark.type === "link") {
      result = `[${result}](${String(mark.attrs?.href ?? "")})`;
    }
  }
  return lead + result + trail;
}

function headingLevel(node: PmNode): number {
  const level = Number(node.attrs?.level) || 1;
  return Math.min(Math.max(level, 1), MAX_HEADING_LEVEL);
}

function listStart(node: PmNode): number {
  const order = Number(node.attrs?.order);
  return Number.isInteger(order) ? order : 1;
}

function prefixLines(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}

function attr(node: PmNode, key: string): string {
  const value = node.attrs?.[key];
  return value === undefined || value === null ? "" : String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
