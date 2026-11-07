// The project's working files: the few links you work in (the Figma file,
// the repo, the live site), kept on the project itself so they never get lost
// among the research.

import { asUrl, hostOf } from "./items";

const words = (slug: string) => {
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {
    /* keep it as it is */
  }
  return s.replace(/[-_]+/g, " ").trim();
};

/** What a working file is called on the project: a Figma file's name, a repo, or the site. */
export function workingFileName(url: string): string {
  const host = hostOf(url);
  let parts: string[];
  try {
    parts = new URL(url).pathname.split("/").filter(Boolean);
  } catch {
    return host;
  }
  if (host === "figma.com" || host.endsWith(".figma.com")) {
    // figma.com/design/KEY/File-Name (also file, proto, board, slides).
    return (parts[2] && words(parts[2])) || "Figma file";
  }
  if (host === "github.com" && parts[0]) {
    return parts[1] ? `${parts[0]}/${parts[1].replace(/\.git$/, "")}` : parts[0];
  }
  return host;
}

/** The links with one more, made whole; nothing changes if it isn't a link or is already there. */
export function addWorkingFile(links: string[], text: string): string[] {
  const url = asUrl(text);
  if (!url || links.includes(url)) return links;
  return [...links, url];
}

/** Only what is a web address, each once: for links read from board.json. */
export function cleanWorkingFiles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<string[]>((out, v) => (typeof v === "string" ? addWorkingFile(out, v) : out), []);
}
