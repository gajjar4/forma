# Contributing to Forma

Thank you for wanting to help. Forma is small on purpose, made by one
designer, and it should keep looking like one person designed it. These are
the few rules that keep it that way. Everyone here follows the
[code of conduct](CODE_OF_CONDUCT.md).

## Where to start

Issues marked `good first issue` are small and self-contained, and `help
wanted` marks the bigger pieces. You don't need to write code to help: a
clear bug report, a recipe for SKILL.md or a board you made with your AI all
make Forma better.

## Running it

```bash
pnpm install
pnpm dev            # the interface in a browser at http://localhost:1420, on a sample board
pnpm tauri dev      # the Mac app, reloading as you edit (needs Rust: rustup)
pnpm test           # the logic tests
```

The sample board's pictures are drawn by the repo itself, so a fresh clone
opens on a full board. Questions go to
[Discussions](https://github.com/Pukhaan/forma-board/discussions).

## Before you start

- **Open an issue first** for anything bigger than a fix: what you want to
  change and why, from the designer's side. Agreeing before you build saves
  you a pull request that can't be taken.
- **Look at [ROADMAP.md](ROADMAP.md)** for what's wanted, and say in its
  issue that you're on it.
- **Read [DESIGN.md](DESIGN.md)** before building anything you can see: the
  tokens, no borders, no colour of its own, icons, motion and copy.

## Smooth is a requirement

The board holds 60 fps on a realistic, full board, in WebKit (the engine the
Mac app runs on).

- Every new animation or visual effect, and any change to how the board
  draws, must pass `pnpm bench` before it's committed. If your change adds a
  new kind of motion, add a run for it to `scripts/bench-pan.mjs`, so it's
  measured from then on.
- **Measure it.** Slowdowns in WebKit often come from painting: panning over
  a card once fell to 7 fps because the dot layer repainted every image
  underneath it, while our own code took under a millisecond a frame. Only a
  frame-timed run on a full board shows that.
- Check your change in the Mac app (`pnpm tauri dev`) as well as in a
  browser: Chromium paints differently.

## The code

- React 19 with the React Compiler: never read or write `ref.current`
  during render, and never call `setState` synchronously inside an effect.
- Files stay under about 300 lines. Pure logic goes in its own module with a
  test beside it (`src/focus/elevation.ts` and `elevation.test.ts` are the
  pattern).
- Comments say why, briefly. Copy is short and plain, and never uses em
  dashes.
- The board format is a promise to everyone's files: a change to
  `board.json` must read every board written before it, and FORMAT.md must
  say what changed.
- AIs edit boards too: if your change affects how a board should be edited,
  update `skills/forma/SKILL.md`.

## Pull requests

1. Fork, branch from `main`, keep the change to one thing.
2. Run `pnpm test`, `npx tsc --noEmit -p tsconfig.json` and, for anything
   visual, `pnpm bench`. The checks on GitHub run the first two.
3. Describe what changed for the designer using Forma and why, with a short
   video for anything that moves.

Pull requests are read at least once a week, usually at the weekend. If a
change doesn't fit Forma, you'll get a clear reason why.

## Reporting a bug

Say what you did, what you expected and what happened, with your macOS
version and, if you can, a screen recording. If it's about a board, a copy
of its `board.json` helps (take out anything private first).

## Releasing

For maintainers: a version tag (`git tag v0.2.0 && git push --tags`) builds
Forma.app on GitHub and attaches it to a release, which is what
`npx forma-board` installs. The installer itself lives in `installer/` and is
published to npm by hand.

## Licence

By contributing you agree that your work is released under the same licence
as what you changed: AGPL-3.0 for the app, MIT for FORMAT.md and `skills/forma`.
