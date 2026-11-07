# Forma's design rules

Read this before building anything in Forma, by hand or with an AI. Forma
should look like one person designed it. Each rule has its reason under it.

## Use the tokens, and only the tokens

Every radius, shadow, type size, ink tint and duration comes from
`src/styles/tokens.css` (its top comment lists the scale). Never type a new
value; if nothing fits, the design is probably wrong, so ask first.
*Why: small drift (a 9px corner beside an 8px one, a 13.5px label beside a
13px one) is what makes an app look assembled.*

- **Radius.** `--r-xs` icons inside chips. `--r-sm` marks, thumbnails, keys,
  halos. `--r-control` buttons, rows, fields, pictures and pile cards.
  `--r-card` white cards (notes, links, live cards). `--r-panel` chrome panels
  and anything lifted. `--r-block` the project. `--r-area` areas.
  `--r-round` pills.
- **Shadow.** `--shadow-rest` things on the board. `--shadow-lift` selected or
  dragged. `--shadow-high` lifted toward you or held. `--shadow-chrome` big
  floating chrome (toolbar, zoom, search, menus, dials). `--shadow-control`
  every small control (pills, chips, round buttons, small fields).
  `--shadow-mark` marks on a picture and swatches. `--paper-shadow` the
  paper corner. `--shadow-drop` something held over a target. `--halo` the
  board-coloured backing behind a title.
- **Type.** Geist. `--text-2xs` mono capitals only, `--text-xs` meta and counts,
  `--text-sm` secondary, `--text-md` the body, `--text-lg` a note's heading,
  `--text-xl` headings, `--text-2xl` an image's note, `--text-display` the
  project. Weights 400, 500 for names, 600 for headings. Numbers and paths
  are mono. The one exception is the project pill, which keeps its
  own approved size, weight and corners.
- **Ink tints.** `--fill-1` a resting band, `--fill-2` under the pointer,
  `--fill-3` pressed. On the dark project, the `--on-ink-*` set.

## No borders, no outlines

Edges are soft shadows. Chrome's edge is the 0.5px ring inside
`--shadow-chrome` and `--shadow-control`. Groups are set apart by space or a
faint band. No focus rings on the board.
*Why: shadows let things sit on the board the way paper sits on a desk.*

## No colour of its own

Forma is ink, the warm off-white (`--canvas`), white and greys made of ink.
Colour only ever comes from the research: pictures, palettes, a site's icon,
a live component. Not for states, errors, AI, or decoration.
*Why: a designer's research has to be the only colour on the board.*

The single, deliberate exception is the "new since you last looked" dot: one
small blue dot (#2f6bff, with a thin ring of the canvas colour, in
`src/styles/changes.css`). It is the one accent Forma allows itself, David's
choice, so what's new is seen at a glance. That blue is used nowhere else, and
doesn't spread to anything else unless David asks.

## The dot grid is Forma's own material

The dots, and the five-dot plus (the app icon's mark), are what Forma is
made of. Ports are a "+" the grid gathers out of its own dots, wires are thin
lines that fade into what they join, new boards show the plus, and what your
AI changed ripples through the dots. New effects come from the dots too;
glows, gradients and colour are never used.
*Why: one material reads as one product.*

## Icons

- None that restate what's visible: no kind icons on notes, links or images.
  Source marks (a site's own icon) are the exception, because they tell you
  something you can't see.
- On board content, control icons are drawn by hand like the wire's add-note
  button: an SVG in the button's own coordinates, stroke 1.6, round caps.
  Lucide is for chrome only (toolbar, zoom, menus).
- Every icon button has padding 0 and its icon exactly centred. Measure it
  in WebKit; don't trust a glyph or a text character to centre.
*Why: icons that decorate become noise; off-centre icons look broken.*

## Calm motion

Animate opacity and transform only (`scale`, `translate`, `rotate`), never
layout, and never an animated blur. CSS uses `--t-fast` (hover colour),
`--t-base` (state, shadow), `--t-slow` (fades and glides with the zoom) and
`--t-glide`, with `--ease-out` for movement, `--spring` for a small pop and
plain `ease` for colour. Springs in JS come from `src/focus/motion.ts`.
Respect `prefers-reduced-motion`.
*Why: Forma is a calm place to think, and only compositor work stays smooth.*

## 60 fps in WebKit is a hard rule

The Mac app runs on WebKit. Every change to how the board draws must pass
`pnpm bench` before it is committed, and new motion gets its own run in
`scripts/bench-pan.mjs`. Check by eye in WebKit as well as Chromium.
*Why: a board that stutters isn't a place you want to think in.*

## Copy

Short and plain, in the user's words. No em dashes. Never "X, not Y" lines.
*Why: Forma speaks like a person, quietly.*

## When David says something is off

Fix exactly that, and keep the rest of the design as it is. Don't rearrange,
restyle or "improve" what he didn't mention. Approved: the board, stacks,
wires, the project card and its working-file chips, the focus view, image
detail, the home, the project pill, the dot ripple and the unseen dot.
*Why: the design is decided, so a change is a correction.*
