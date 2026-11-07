import { parseInline, parseMarkdown, type Block } from "../model/markdown";
import { openLink } from "../canvas/openLink";

/**
 * Markdown, read: headings, paragraphs, lists, quotes, code and links. Built
 * from plain data (model/markdown.ts), never from HTML, so nothing in a file
 * can run or reach the page. The same markup is a document's face on the
 * board and its lifted sheet; only a lifted one is `live`, where a link opens
 * in the browser. On the board a click belongs to the card.
 */
export function Markdown({ text, live = false }: { text: string; live?: boolean }) {
  return (
    <div className="md">
      {parseMarkdown(text).map((b, i) => (
        <MdBlock key={i} block={b} live={live} />
      ))}
    </div>
  );
}

function MdBlock({ block, live }: { block: Block; live: boolean }) {
  switch (block.kind) {
    case "heading": {
      const Tag = block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3";
      return (
        <Tag className="md-head" data-level={Math.min(block.level, 3)}>
          <Inline text={block.text} live={live} />
        </Tag>
      );
    }
    case "para":
      return (
        <p className="md-p">
          <Inline text={block.text} live={live} />
        </p>
      );
    case "quote":
      return (
        <blockquote className="md-quote">
          <Inline text={block.text} live={live} />
        </blockquote>
      );
    case "code":
      return <pre className="md-code">{block.text}</pre>;
    case "rule":
      return <div className="md-rule" role="separator" />;
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className="md-list">
          {block.items.map((t, i) => (
            <li key={i}>
              <Inline text={t} live={live} />
            </li>
          ))}
        </Tag>
      );
    }
  }
}

function Inline({ text, live }: { text: string; live: boolean }) {
  return (
    <>
      {parseInline(text).map((s, i) => {
        if (s.kind === "strong") return <strong key={i}>{s.text}</strong>;
        if (s.kind === "em") return <em key={i}>{s.text}</em>;
        if (s.kind === "code") return <code key={i}>{s.text}</code>;
        if (s.kind === "link") {
          if (!live) {
            return (
              <span key={i} className="md-link">
                {s.text}
              </span>
            );
          }
          return (
            <a
              key={i}
              className="md-link"
              href={s.href}
              onClick={(e) => {
                e.preventDefault();
                void openLink(s.href);
              }}
            >
              {s.text}
            </a>
          );
        }
        return s.text;
      })}
    </>
  );
}
