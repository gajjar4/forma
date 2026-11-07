---
name: forma
description: Read and edit Forma boards, the designer's research boards that live as plain folders (board.json + media/ + components/). Use whenever the user asks to add, sort, connect, find or change anything on a Forma board, to bring research in (images, videos, links, notes, meetings, Mobbin screens, emails), or mentions a folder in ~/Documents/Forma.
---

# Working on a Forma board

Forma is a research board for designers. Each board is a normal folder that the
Forma Mac app draws as a board: a project in the middle, research around it in
stacks, notes and cards, and wires between things with a note on each saying
why they connect. You and the user edit the same files. The app watches the
folder and shows every change you make straight away: the grid dots ripple out
from what you changed, and anything new waits with a small dot until the user
has seen it. The user can undo your change with ⌘Z.

## The one rule: the board is the user's

The board is the user's thinking. Treat everything already on it as theirs.

- **Add freely.** New notes, new cards, new stacks, new wires, new items in a
  stack: fine, when they help with what the user asked.
- **Ask before you change or delete anything the user made.** Moving it,
  rewording it, retitling it, taking it out of a stack, deleting it, merging
  stacks, rearranging the board: ask first. Say what you want to change and
  why, and ask why they made it that way if it isn't clear. They may have a
  reason you can't see. Only go ahead on a clear yes.
- **Things you added in this conversation** you may adjust without asking.
- **Never rearrange or tidy the board,** never add areas, and never move things
  to make room unless asked. Leave positions out of new things instead:
  Forma finds them a place (see "The shape of a board").
- **The user's words stay the user's.** Don't rewrite their notes or wire notes.
  A note on an image (`note`) says why *they* saved it: never write one for
  them. You may write facts with their source, like what was said in a meeting
  or written in an email.
- **Keep your change small.** Change only what the request needs. Leave every
  other field, id and position exactly as it is, including fields you don't
  recognise.

## Where things are

- Boards: `~/Documents/Forma/<Board name>/`. Boards stored elsewhere are
  folders the user opened; ask for the path if you don't have it. The project
  menu in the app copies a board's full path.
- In a board folder:

```
board.json     the board
media/         images, videos and documents (and their stills)
components/    live cards: small coded components, one HTML file each
SKILL.md       these rules (the app adds it; leave it be)
```

- The full format reference is `FORMAT.md` in Forma's repository
  (github.com/Pukhaan/forma-board). The essentials are below.

## board.json in short

```json
{
  "forma": 1,
  "nodes": [
    { "id": "project", "type": "project", "x": -170, "y": -80,
      "title": "Northwind", "brief": "AI shopping assistant for small brands.",
      "links": ["https://www.figma.com/design/KEY/Northwind-Brand"] },
    { "id": "note-call", "type": "note", "x": -760, "y": -300,
      "text": "Founders call, 20 Oct\n\nThey want it calm and trustworthy.",
      "source": "https://notes.granola.ai/d/MEETING-ID" },
    { "id": "stack-blue", "type": "stack", "x": 480, "y": -400,
      "title": "Blue and white", "description": "What they keep pointing at",
      "items": [
        { "id": "i1", "kind": "image", "file": "media/i1.jpg", "w": 1200, "h": 900,
          "title": "Blue triangle", "source": "https://www.are.na/block/2931", "added": "2026-11-02" }
      ] },
    { "id": "card-site", "type": "card", "x": 940, "y": 470,
      "item": { "id": "l1", "kind": "link", "url": "https://havn.studio/", "title": "HAVN studio" } }
  ],
  "wires": [
    { "id": "w1", "from": "note-call", "to": "stack-blue", "note": "They like blue and white" }
  ]
}
```

- **Nodes:** `project` (the centre; `links` are its working files: the Figma
  file, the repo, the live site), `note` (`text`; the first paragraph is its
  heading; optional `source`), `stack` (`title`, `items`, optional
  `description`; the last item is the cover), `card` (one loose `item`),
  `area` (only if the user asks).
- **Items** (in a stack's `items` or a card's `item`): `image` (`file`, `w`,
  `h`, optional `title`, `note`, `source`, `added`), `video` (`file`,
  `poster`, `w`, `h`, the same optional fields), `link` (`url`, `title`),
  `note` (`text`, optional `source`), `live` (`file` in `components/`,
  `title`, `w`, `h`), `doc` (`file`: a PDF, Markdown, text or any other
  file; optional `title`, `note`, `source`, `added`).
- **Wires:** `from`, `to` (node ids) and an optional `note`: why they connect.
- Positions are board units, y grows downward, on a 32-unit grid. Leave `x`
  and `y` out of anything you add (see below). Ids are unique across the
  whole board.

## The shape of a board

A board is a map you read at a glance, and the wires give it its shape.

**Leave `x` and `y` out of everything you add.** Forma places each new thing
itself: it grows out from what it's wired to, heading away from the project,
in free space, with no crossed wires and nothing lined up in rows. It writes
the positions back into board.json. Things that already have a position never
move. So the wires decide the shape: get them right and the board comes out
right. Write `x` and `y` only when the user tells you where something goes
("top left, by the call notes").

What Forma builds from your wires:

- **The project stays in the middle.** Four to six things wire straight to it,
  each heading off in its own direction, about 450 units away.
- **Branches grow outward.** What comes from a thing sits further out in the
  same direction, 320 to 500 units along its wire, as a chain or a small fan.
  Each branch keeps to its own side, so wires don't cross.
- **Wire each thing to what it grew from.** Most things connect to a neighbour
  on their branch, and nothing is left floating. Put a few words on a wire when
  the reason isn't obvious.
- **Stacks hold the material.** A branch is a few piles and notes, with the
  pictures inside the piles.
- **Keep it loose.** Uneven distances and angles are good: they make each part
  easy to recognise. Boxes, areas, columns, rows and grids look tidy and are
  hard to scan, so never lay a board out that way.

Forma older than 0.1.2 can't place things, and puts anything without a
position in the middle. Check its version with
`defaults read /Applications/Forma.app/Contents/Info.plist CFBundleShortVersionString`
(or `~/Applications/Forma.app`). On an older one, write positions yourself,
roughly like this for a new board:

```
project            -170,  -80   the middle
note "The idea"    -640,   64   left
  stack "How"     -1056,  416   further out, down and left
  stack "Links"    -320,  608   down
stack "Why"        -384, -512   up and left
  stack "Call"     -672, -864   further out the same way
note "Rules"         32, -544   up and right
  stack "Surface"   -64, -896   further up
    stack "Calm"    -64,-1216   further up again
stack "Plan"        416, -320   right
  stack "So far"    320,   64   down and right
```

This never overrides the rule above: things the user already placed stay where
they are, unless they ask you to rearrange them.

## How to edit safely

1. **Read board.json right before you change it,** every time. The user may
   have changed it a second ago.
2. **Change only what you need** and keep everything else byte for byte where
   you can: same ids, same positions, same order, same unknown fields.
3. **Write it the way the app does:** write the whole file to
   `board.json.saving` in the same folder, then rename it over `board.json`.
   Never leave a half-written board. Never create hidden files (names starting
   with a dot) in the folder: the app can't see them.
4. **Write valid JSON** (two-space indent is fine). Re-read it after writing to
   check it parses.
5. **Leave positions out of new things,** and wire each one to what it grew
   from. If you must write a position (the user said where, or Forma is older
   than 0.1.2), keep to the 32-unit grid and free space. Rough sizes in board
   units: a note is 256 wide and about 120 to 260 tall; a stack's pile is 200
   square with its title under it; a card is about 168 to 200 wide; the
   project block is 352 wide. Leave at least 64 between things.

## Recipes

- **A note:** a `note` node with `text` ("Heading\n\nBody"). Short and plain.
- **An image:** copy the file into `media/` with a unique name, read its pixel
  size for `w` and `h`, then add a `card` (or an item in a stack). Set `added`
  to today (`YYYY-MM-DD`) and `source` to where it came from when you know.
  Leave `palette` out: the app works it out.
- **A picture from a link** (Cosmos, Are.na, Pinterest, X or any page): the
  picture is the research, so save the picture itself. Open the page, find
  the picture's own file (its `og:image`, or the largest picture on the page),
  download it into `media/` and add it as an image, with `source` set to the
  page the user gave you. When a site won't show you the picture (X often
  needs a login), say so and ask the user to drop the picture into the chat
  or onto the board. Never save a sign-in page or a blank picture.
- **A video:** copy it into `media/` (`.mp4`, `.mov`, `.webm`), save one frame
  as a picture beside it for `poster` (for example with
  `ffmpeg -ss 0.5 -i in.mp4 -frames:v 1 media/name.jpg`), and set `w`, `h` from
  the video. Without a poster the app shows its first frame.
- **A document** (a PDF, a brief in Markdown, a deck): copy the file into
  `media/` under its own readable name (add " 2" if the name is taken), then
  add a `doc` item with `file` and `added`, in a `card` or a stack. Leave
  `poster` out: the app shows it without one.
- **A link:** a `card` with a `link` item, or a `link` item in a stack.
- **Into a stack:** append to its `items` (the end is the top of the pile).
  Moving the user's things between stacks counts as a change: ask first.
- **A connection:** a wire between two node ids. If you add a `note` on it,
  say the reason in a few plain words.
- **A working file** (the main Figma file, the repo, the site): add its address
  to the project's `links`.
- **Research from somewhere else** (a meeting, an email, Mobbin, a site): one
  stack per source event, named after it ("Call with Bob, 14 Oct"), with short
  items: the decisions and the person's own words, each with `source` pointing
  back to the original. Pictures over links when the picture is the research.
- **A repo as a board** (the user gives you a GitHub link or a code folder):
  read before you draw. Start with the README, then the top-level folders,
  the Markdown docs, the manifest (`package.json`, `Cargo.toml` and the like)
  and the main entry files. Skip what's generated or installed
  (`node_modules`, `dist`, `target`, lockfiles). Make a new board named after
  the repo, unless the user names one. The repo goes in the middle as the
  `project`: its name, a one-line `brief` from the README in plain words, and
  its address in `links`. Around it, four to six notes for the parts that
  matter, each saying what that part does and why it's there, with its key
  files on their own line. Docs worth reading go in a stack called Docs, as
  `doc` items; screenshots, diagrams and films from the repo go in a stack
  called Pictures. Wire each part to the project, and parts that depend on
  each other to each other, with a few words on why. Follow the shape above.
  Only read the repo: never change, commit or push anything in it.
- **A live card:** one self-contained HTML file in `components/`, added like
  an image with `kind: "live"`. It reads `#card` (on the board: quiet, playing
  by itself, no words or controls) or `#open` (opened big) from its address,
  and can ask Forma for dials; see "Live cards" in FORMAT.md.

## How it should read

Forma's words are short and plain. No em dashes. Never write lines shaped like
"X, not Y". Notes are written like a designer's own notes: a heading, then a
line or two.

## Don't

- Don't delete files from `media/` or `components/`: something may still use them.
- Don't rename or move the board folder.
- Don't add styling, colour or layout fields the format doesn't have.
- Don't turn the user's words into your own, and don't decide for them.
  When in doubt, ask.
