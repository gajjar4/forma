import { Group, Hand, ImagePlus, MousePointer2, Orbit, Scan, StickyNote } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export type Tool = "select" | "hand";

type Props = {
  tool: Tool;
  onTool: (t: Tool) => void;
  onNote: () => void;
  onImages: (files: File[]) => void;
  onArea: () => void;
  onTidy: () => void;
  onFit: () => void;
};

function typing(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA");
}

/** One small bar for the few things you do on the board. Each tool has a single-key shortcut. */
export function Toolbar({ tool, onTool, onNote, onImages, onArea, onTidy, onFit }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "v") onTool("select");
      else if (k === "h") onTool("hand");
      else if (k === "n") onNote();
      else if (k === "i") fileInput.current?.click();
      else if (k === "a") {
        // The new area's name field takes focus at once; keep this key out of it.
        e.preventDefault();
        onArea();
      }
      else if (k === "t") onTidy();
      else if (k === "f") onFit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onTool, onNote, onArea, onTidy, onFit]);

  return (
    <div className="toolbar chrome" role="toolbar" aria-label="Board tools">
      <ToolButton label="Select" keyHint="V" active={tool === "select"} onClick={() => onTool("select")}>
        <MousePointer2 />
      </ToolButton>
      <ToolButton label="Move around" keyHint="H" active={tool === "hand"} onClick={() => onTool("hand")}>
        <Hand />
      </ToolButton>
      <span className="toolbar-rule" />
      <ToolButton label="Note" keyHint="N" onClick={onNote}>
        <StickyNote />
      </ToolButton>
      <ToolButton label="Image or file" keyHint="I" onClick={() => fileInput.current?.click()}>
        <ImagePlus />
      </ToolButton>
      <ToolButton label="Area" keyHint="A" onClick={onArea}>
        <Group />
      </ToolButton>
      <span className="toolbar-rule" />
      <ToolButton label="Tidy" keyHint="T" onClick={onTidy}>
        <Orbit />
      </ToolButton>
      <ToolButton label="Fit everything" keyHint="F" onClick={onFit}>
        <Scan />
      </ToolButton>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          e.currentTarget.value = "";
          if (files.length) onImages(files);
        }}
      />
    </div>
  );
}

function ToolButton(props: { label: string; keyHint: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      className="tool"
      data-active={props.active || undefined}
      aria-label={props.label}
      aria-pressed={props.active}
      title={`${props.label}  ${props.keyHint}`}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
