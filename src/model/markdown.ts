// A small, safe reading of Markdown: headings, paragraphs, lists, quotes,
// code and links. Enough to read a brief or a set of notes comfortably. It
// only ever makes plain data, never HTML, so nothing in a file can run.
// Pure, so it can be tested.

export type Span =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "para"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string }
  | { kind: "rule" };

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const FENCE = /^\s*(```|~~~)/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;

/** The YAML block some files open with (between two lines of ---): not part of what you read. */
function withoutFrontMatter(lines: string[]) {
  if (lines[0]?.trim() !== "---") return lines;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  return end > 0 ? lines.slice(end + 1) : lines;
}

/** A list item's checkbox, as it reads: "[x] Done" stays "[x] Done", "[ ]" reads plainly. */
const item = (text: string) => text.replace(/^\[ \]\s+/, "").trim();

export function parseMarkdown(text: string): Block[] {
  const lines = withoutFrontMatter(text.replace(/\r\n?/g, "\n").split("\n"));
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (FENCE.test(line)) {
      const fence = FENCE.exec(line)![1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) body.push(lines[i++]);
      i++;
      out.push({ kind: "code", text: body.join("\n") });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      out.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    if (RULE.test(line)) {
      out.push({ kind: "rule" });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) body.push(QUOTE.exec(lines[i++])![1]);
      out.push({ kind: "quote", text: body.join(" ").trim() });
      continue;
    }
    const ordered = NUMBERED.test(line);
    if (ordered || BULLET.test(line)) {
      const marker = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (i < lines.length && lines[i].trim()) {
        const m = marker.exec(lines[i]) ?? (ordered ? BULLET : NUMBERED).exec(lines[i]);
        if (m) items.push(item(m[1]));
        // A line that runs on belongs to the item before it.
        else if (items.length) items[items.length - 1] += ` ${lines[i].trim()}`;
        i++;
      }
      out.push({ kind: "list", ordered, items });
      continue;
    }
    const body: string[] = [];
    while (i < lines.length && lines[i].trim() && !HEADING.test(lines[i]) && !FENCE.test(lines[i]) && !BULLET.test(lines[i]) && !QUOTE.test(lines[i])) {
      body.push(lines[i++].trim());
    }
    out.push({ kind: "para", text: body.join(" ") });
  }
  return out;
}

/** Only addresses that go somewhere outside: the web and mail. Anything else stays text. */
export function safeHref(href: string): string | null {
  const h = href.trim();
  return /^(https?:\/\/|mailto:)/i.test(h) ? h : null;
}

const INLINE = /(`+)([^`]+?)\1|!?\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|<(https?:\/\/[^>\s]+)>|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|(?<![\p{L}\p{N}])_([^_\s][^_]*)_(?![\p{L}\p{N}])/gu;

/** A line's emphasis, code and links, as spans of plain text. */
export function parseInline(text: string): Span[] {
  const out: Span[] = [];
  let at = 0;
  const push = (span: Span) => {
    const last = out[out.length - 1];
    if (span.kind === "text" && last?.kind === "text") last.text += span.text;
    else if (span.text) out.push(span);
  };
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > at) push({ kind: "text", text: text.slice(at, start) });
    at = start + m[0].length;
    if (m[2] !== undefined) push({ kind: "code", text: m[2] });
    else if (m[4] !== undefined) {
      const href = safeHref(m[4]);
      // A picture can't be shown here: its words stand in for it.
      if (m[0].startsWith("!")) push({ kind: "text", text: m[3] });
      else push(href ? { kind: "link", text: m[3] || href, href } : { kind: "text", text: m[3] });
    } else if (m[5] !== undefined) push({ kind: "link", text: m[5], href: m[5] });
    else if (m[6] !== undefined || m[7] !== undefined) push({ kind: "strong", text: m[6] ?? m[7] });
    else push({ kind: "em", text: m[8] ?? m[9] });
  }
  if (at < text.length) push({ kind: "text", text: text.slice(at) });
  return out;
}

/** A line with its markup taken out, as plain words. */
export const plainInline = (text: string) =>
  parseInline(text)
    .map((s) => s.text)
    .join("");

/** How much of a file its face reads: more than the top of the sheet ever shows. */
export const FACE_CHARS = 4000;

/**
 * The start of a document, as much as its face needs: at most `most`
 * characters, cut at the end of a line. The face on the board and the lifted
 * sheet both start from this, so they read the same from the top; the whole
 * file only comes in once the sheet has landed, and only below the fold.
 */
export function faceText(text: string, most = FACE_CHARS) {
  if (text.length <= most) return text;
  const cut = text.lastIndexOf("\n", most);
  return text.slice(0, cut > 0 ? cut : most);
}

/** A Markdown file's words as plain text, its markup taken out: what search reads. */
export function markdownWords(text: string) {
  return parseMarkdown(text)
    .map((b) => (b.kind === "list" ? b.items.map(plainInline).join(" ") : b.kind === "code" ? b.text : b.kind === "rule" ? "" : plainInline(b.text)))
    .filter(Boolean)
    .join(" ");
}
