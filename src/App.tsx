import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useEffectEvent, useState } from "react";
import { listenForQuit } from "./app/closing";
import { inApp, pickFolder, rememberProject } from "./app/projects";
import { boardToReopen, rememberOpen } from "./app/reopen";
import { Veil } from "./app/Veil";
import { Canvas } from "./canvas/Canvas";
import { ProjectChip } from "./chrome/ProjectChip";
import { devSource } from "./home/dev";
import { Home } from "./home/Home";
import { appSource, type HomeSource, type Opened } from "./home/source";
import { browserStore } from "./store/browser";
import { folderStore } from "./store/folder";

/**
 * Where the boards come from: folders, in the app. In a browser there is
 * only the browser board, unless the address asks for the home (?home) to
 * work on it.
 */
const homeParam = new URLSearchParams(window.location.search).get("home");
const source: HomeSource | null = inApp ? appSource : homeParam !== null ? devSource(homeParam) : null;

/** Set once the board open before a reload has been gone back into. */
let reopened = false;

export default function App() {
  const [opened, setOpened] = useState<Opened | null>(null);
  /** The veil over the board: uncovering it as it arrives, covering it as it leaves. */
  const [veil, setVeil] = useState<"in" | "out" | null>(null);
  /** The board just left, so the home comes back out of its pile. */
  const [from, setFrom] = useState<string | null>(null);
  /** Why a board didn't open, said on the home. */
  const [notice, setNotice] = useState<string | null>(null);
  /** The board being gone back into after a reload (see reopen.ts); nothing shows meanwhile. */
  const [reopening, setReopening] = useState(() => (inApp ? boardToReopen() : null));

  // Quitting or closing the window saves everything first (see closing.ts).
  useEffect(() => listenForQuit(), []);

  // A browser without the home goes straight to its board, as before.
  useEffect(() => {
    if (source) return;
    const store = browserStore();
    void store.load().then((board) => setOpened({ store, board }));
  }, []);

  const enter = (next: Opened) => {
    if (next.store.root) {
      rememberProject(next.store.root);
      rememberOpen(next.store.root);
    }
    setNotice(null);
    setOpened(next);
    setVeil("in");
  };

  /** Another board from the project menu: a recent one, or a folder chosen there. */
  const switchTo = async (root: string | null) => {
    if (!root) return;
    const store = folderStore(root);
    try {
      enter({ store, board: await store.load() });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : `Couldn't open ${store.name}.`);
      setFrom(null);
      setOpened(null);
      rememberOpen(null);
    }
  };

  // After a reload, straight back into the board that was open.
  const back = useEffectEvent((root: string) => void switchTo(root).finally(() => setReopening(null)));
  useEffect(() => {
    // Once per page load, though development runs effects twice.
    if (!reopening || reopened) return;
    reopened = true;
    back(reopening);
  }, []);

  const veilDone = () => {
    if (veil === "out") {
      setFrom(opened?.store.root ?? "browser");
      setOpened(null);
      rememberOpen(null);
    }
    setVeil(null);
  };

  return (
    <ReactFlowProvider>
      {/* The window's title bar is hidden; this strip keeps it draggable. */}
      <div className="titlebar" data-tauri-drag-region />
      {opened ? (
        <>
          {/* Keyed by folder, so switching projects starts a fresh board (and undo history). */}
          <Canvas key={opened.store.root ?? "browser"} store={opened.store} initial={opened.board} />
          {veil && <Veil key={veil} cover={veil === "out"} onDone={veilDone} />}
          <ProjectChip
            name={opened.store.name}
            root={opened.store.root}
            onSwitch={() => void pickFolder("Open a folder as a board").then(switchTo)}
            onOpen={(root) => void switchTo(root)}
            onHome={source ? () => setVeil("out") : undefined}
            store={opened.store}
          />
        </>
      ) : (
        source && !reopening && <Home source={source} from={from} notice={notice} onEnter={enter} />
      )}
    </ReactFlowProvider>
  );
}
