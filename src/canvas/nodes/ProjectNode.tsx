import { useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import type { ProjectData } from "../../model/types";
import { addWorkingFile, workingFileName } from "../../model/workfiles";
import { useCanvasUi } from "../context";
import { openLink } from "../openLink";
import { useZoomVar } from "../zoom";
import { Favicon } from "./Faces";
import { Ports } from "./Ports";

type ProjectNodeType = Node<ProjectData, "project">;

/** What an empty brief says, until there is one. */
export const BRIEF_PROMPT = "What is this project? Double-click to write it.";

/** The centre of the board. Everything else connects back to it. Double-click to write its brief. */
export function ProjectNode({ id, data, selected }: NodeProps<ProjectNodeType>) {
  const [writing, setWriting] = useState(false);
  useZoomVar();
  return (
    <div className="project" data-selected={selected || undefined} onDoubleClick={() => setWriting(true)}>
      <div className="project-kicker">Project</div>
      {/* Grows when zoomed out; the hidden copy keeps the block's size. */}
      <div className="project-title">{data.title}</div>
      <div className="project-title-size" aria-hidden>
        {data.title}
      </div>
      {writing ? (
        <BriefEditor id={id} brief={data.brief} onLeave={() => setWriting(false)} />
      ) : (
        <p className="project-brief" data-empty={data.brief.trim() ? undefined : true}>
          {data.brief.trim() || BRIEF_PROMPT}
        </p>
      )}
      <WorkingFiles id={id} links={data.links ?? []} />
      <Ports />
    </div>
  );
}

/** Grows with what's typed, so the brief never scrolls inside itself. */
const fit = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

/** The brief as a field: Return or clicking away keeps it, Escape leaves it as it was. */
function BriefEditor({ id, brief, onLeave }: { id: string; brief: string; onLeave: () => void }) {
  const { updateNodeData } = useReactFlow();
  const { commit } = useCanvasUi();
  const keep = (text: string) => {
    const next = text.trim();
    if (next !== brief.trim()) {
      commit();
      updateNodeData(id, { brief: next });
    }
    onLeave();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      keep(e.currentTarget.value);
    } else if (e.key === "Escape") onLeave();
  };
  return (
    <textarea
      className="project-brief project-brief-edit nodrag nopan nowheel"
      defaultValue={brief}
      placeholder={BRIEF_PROMPT}
      rows={1}
      autoFocus
      ref={fit}
      onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => fit(e.currentTarget)}
      onKeyDown={onKeyDown}
      onBlur={(e) => keep(e.currentTarget.value)}
    />
  );
}

/**
 * The links you work in, on the project itself: the Figma file, the repo, the
 * site. Each opens with a click. Hover the project to add one (paste a link)
 * or take one off.
 */
function WorkingFiles({ id, links }: { id: string; links: string[] }) {
  const { updateNodeData } = useReactFlow();
  const { commit } = useCanvasUi();
  const [adding, setAdding] = useState(false);

  const save = (next: string[]) => {
    if (next === links) return;
    commit();
    updateNodeData(id, { links: next.length ? next : undefined });
  };
  const add = (text: string) => {
    save(addWorkingFile(links, text));
    setAdding(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") add(e.currentTarget.value);
    else if (e.key === "Escape") setAdding(false);
  };

  return (
    <div className="project-files nodrag" data-empty={links.length || adding ? undefined : true} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      {links.map((url) => (
        <span key={url} className="project-file">
          <button className="project-file-open" title={url} onClick={() => openLink(url)}>
            <Favicon url={url} />
            <span className="project-file-name">{workingFileName(url)}</span>
          </button>
          <button
            className="project-file-remove"
            aria-label={`Take ${workingFileName(url)} off the project`}
            onClick={() => save(links.filter((l) => l !== url))}
          >
            {/* 16 by 16, the button itself: a 5px cross on its centre. */}
            <svg viewBox="0 0 16 16" aria-hidden>
              <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
            </svg>
          </button>
        </span>
      ))}
      {adding ? (
        <input
          className="project-file-input"
          autoFocus
          placeholder="Paste a Figma, GitHub or site link"
          onKeyDown={onKeyDown}
          onBlur={(e) => add(e.currentTarget.value)}
        />
      ) : (
        <button className="project-file-add" aria-label="Add a working file" onClick={() => setAdding(true)}>
          {/* 28 by 28, the button itself: a 10px plus on its centre. */}
          <svg viewBox="0 0 28 28" aria-hidden>
            <path d="M14 9v10M9 14h10" />
          </svg>
        </button>
      )}
    </div>
  );
}
