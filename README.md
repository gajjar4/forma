# Forma

A local-first visual memory and spatial research board for projects, designers, and AI-assisted research.

Research lives directly on an infinite canvas as files in local folders—images, videos, PDFs, notes, markdown documents, and interactive HTML micro-prototypes—gathered into stacks and linked with semantic wires.

---

## Highlights

* **Spatial Canvas**: Infinite pan, zoom, and spatial arrangement powered by `@xyflow/react` and `motion`.
* **Card Stacks**: Group related references, inspiration, and research into tactile card decks that fan out on click.
* **Semantic Wires**: Connect cards and stacks with directed bezier wires that store the exact rationale for why they relate.
* **Live Micro-Components**: Embed interactive sandboxed HTML/JS widgets directly on the board with customizable real-time dials.
* **Local-First & Offline**: Every board is backed by plain local files (`board.json`, media assets, components)—zero cloud lock-in.
* **AI-Agent Ready**: Agents (Claude, Cursor, Copilot) can directly inspect, add, organize, and wire nodes across your research board.

---

## Tech Stack

* **Frontend**: React 19, TypeScript, Vite
* **Canvas Engine**: React Flow (`@xyflow/react`), Framer Motion (`motion`)
* **Document Engine**: PDF.js (`pdfjs-dist`)
* **Icons & Typography**: Lucide React, Geist Variable Fonts
* **Desktop Runtime**: Tauri v2 (Rust)

---

## Quick Start

### Prerequisites
* **Node.js** (v18 or later)
* **pnpm** (or npm)

### 1. Clone the repository
```bash
git clone https://github.com/gajjar4/forma.git
cd forma
```

### 2. Install dependencies
```bash
pnpm install
```

### 3. Start development server
```bash
pnpm dev
```
Open **`http://localhost:1420`** in your browser.

### 4. Build for production
```bash
pnpm build
```

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `V` | Select / Pointer tool |
| `H` | Hand / Pan tool |
| `N` | Create new Note |
| `I` | Insert / Add images |
| `F` | Fit entire board in view |
| `Ctrl + K` / `/` | Quick Search across board |
| `Ctrl + Z` / `Ctrl + Shift + Z` | Undo / Redo |
| `Esc` | Zoom back out / Close detail view |

---

## Project Structure

```
├── src/
│   ├── app/         # App shell, haptics, project routing
│   ├── canvas/      # React Flow canvas, node renderers, wires
│   ├── chrome/      # Floating dock, toolbar, zoom controls
│   ├── focus/       # Detail inspection sheets (Markdown, PDF, Image)
│   ├── home/        # Board switcher & preview piles
│   ├── model/       # Board graph data schema and layout geometry
│   ├── store/       # State management and file synchronization
│   └── styles/      # Design tokens and modular stylesheets
├── src-tauri/       # Tauri v2 desktop application backend (Rust)
├── public/          # Sample boards, assets, and live component sandboxes
└── skills/          # AI agent skills for interacting with Forma boards
```

---

## License

AGPL-3.0 License.
