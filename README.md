# OASIS IDE

AI-powered code editor with deep **OASIS Web4–Web10 integration**, 243 MCP tools, FAHRN multi-agent AI, streaming completions, STAR CLI terminals, Git panel, workspace search, LSP (TypeScript/JavaScript), and OAPP scaffolding wizard. Built with Electron, React, and TypeScript.

**Repo:** [github.com/NextGenSoftwareUK/IDE](https://github.com/NextGenSoftwareUK/IDE)

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/NextGenSoftwareUK/IDE.git
cd IDE
npm install
```

> **Important — terminal native module:** After `npm install`, rebuild node-pty for your Electron version or the built-in terminals won't start:
> ```bash
> npm run rebuild:terminal
> ```
> If this fails with a Python `distutils` error (Python 3.12+):
> ```bash
> python3 -m pip install setuptools && npm run rebuild:terminal
> ```

### 2. Configure OASIS services

Copy `.env.example` to `.env` and fill in your values, **or** open the IDE and click the ⚙ gear icon at the bottom of the Explorer panel to edit settings in-app.

| Service | Default port | Variable |
|---------|-------------|----------|
| Web4 (ONODE) – avatar, holon, NFT, wallet | 7777 | `OASIS_API_URL` |
| Web6 – AI completions, FAHRN, A2A agents | 64596 | `OASIS_WEB6_URL` / `OASIS_WEB6_API_KEY` |
| Web7 – collective consciousness | 62798 | `OASIS_WEB7_URL` |
| Web8 – mesh routing | 65332 | `OASIS_WEB8_URL` |
| Web9 – singularity aggregation | 65342 | `OASIS_WEB9_URL` |
| Web10 – The Source | 57483 | `OASIS_WEB10_URL` |
| MCP server (.NET) | auto-detected | `OASIS_MCP_SERVER_PATH` |
| STAR CLI | auto-detected | `OASIS_STAR_CLI_PATH` |

The IDE auto-detects the Web6 .NET MCP server at `C:\Source\OASIS2\WEB6\NextGenSoftware.OASIS.MCP.Server` and the STAR CLI at the monorepo's build output. All URLs can be overridden via Settings without restarting.

### 3. Run the IDE

```bash
npm run dev
```

A yellow warning banner appears at startup if Web4 or Web6 are unreachable.

---

## Features

### Editor

- **Monaco editor** (same engine as VS Code) with syntax highlighting for TypeScript, JavaScript, C#, JSON, Markdown, HTML, CSS, Python, Shell, YAML, and more
- **TypeScript/JavaScript LSP** — completions, hover docs, go-to-definition (F12), inline diagnostics via `typescript-language-server`
- **Split pane** — click ⊟ in the editor toolbar to open a second read-view pane side-by-side
- **Tab bar** with dirty indicators (●), close buttons, and overflow scroll
- **OASIS code snippets** — type a prefix and press Tab to expand (see Snippets section below)
- **Auto-save** — configurable in Settings (off or after a delay)
- **Persistent tabs** — open tabs and the active workspace are restored automatically on restart
- **Editor theme** — choose from OASIS Dark (default), VS Dark, VS Light, High Contrast, Monokai, or One Dark in Settings
- **Zoom** — Ctrl+= / Ctrl+- / Ctrl+0

### Navigation

| Shortcut | Action |
|----------|--------|
| **Ctrl+P** | Go to File — fuzzy-search all workspace files |
| **Ctrl+Shift+P** | Command Palette — run any IDE action by name |
| **Ctrl+Shift+O** | Go to Symbol — search functions, classes, and variables across the workspace (LSP-backed) |
| **F12** | Go to definition (LSP) |
| **Ctrl+H** | Find & replace in file |
| **Ctrl+S** | Save current file |
| **Ctrl+Shift+F** | Search panel (full-text workspace search) |
| **?** | Show all keyboard shortcuts |
| **Esc** | Close any open modal or palette |

### Panels

| Panel | How to open |
|-------|-------------|
| **Explorer** | Left sidebar → file-tree icon |
| **Search** | Left sidebar → search icon, or **Ctrl+Shift+F** |
| **Git** | Left sidebar → Git icon |
| **STAR Wizard** | Left sidebar → ✦ icon. Scaffold a new OAPP |
| **Chat (Web6 AI)** | Right panel — streaming completions, FAHRN mode, provider/model selector |
| **Inbox (A2A)** | Right panel — A2A message inbox |
| **MCP Tools (243 tools)** | Right panel — select tool → fill args → Execute |
| **OASIS Network** | Right panel — live health status for all 6 platform layers |
| **Terminal** | Bottom panel — default OS shell + STAR CLI tabs; **+** for more sessions |
| **Problems** | Bottom panel tab — tsc / ESLint diagnostics with run buttons |
| **Settings** | ⚙ gear icon at the bottom of the Explorer panel, or Command Palette → "Preferences: Open Settings" |

### Status bar

The 24 px bar at the bottom of the window shows:
- **Git branch** (current branch; auto-refreshes every 10 seconds)
- **LSP status** — yellow pulsing dot while the language server initialises, green once ready
- **File language** — detected from file extension
- **Cursor position** — line and column, updated live as you type

### File Explorer

- Right-click any file or folder for a context menu: New File, New Folder, Rename, Delete
- **+f** / **+d** buttons in the header create a file or folder at the workspace root
- File watcher auto-refreshes the tree on external changes

### Git panel

- **Changes** tab — lists modified/added/deleted files; click a file to see its diff; stage files individually or all at once; enter a commit message and commit
- **Log** tab — last 30 commits with hash, author, and date
- **Diff** tab — raw diff output for the selected file
- **Branch bar** — dropdown shows all local branches; select to checkout; **+** opens an inline input to create a new branch
- Toast notifications on commit success/failure and branch operations

### MCP tools

The IDE auto-starts the **Web6 .NET MCP server** (243 tools spanning Web4–Web10). If you have the server at a custom path, set `OASIS_MCP_SERVER_PATH`:

- `.js` file → started with `node`
- directory → started with `dotnet run --project`
- `.exe` → run directly

### STAR CLI terminals

The bottom panel opens with two default tabs: an OS shell and a STAR CLI session. Press **+** to spawn additional sessions. STAR CLI requires either building the STAR ODK (`net10.0/star.exe`) or setting `OASIS_STAR_CLI_PATH`.

---

## OASIS code snippets

Type the prefix and press **Tab** (or select from the autocomplete list) to expand.

| Prefix | Expands to |
|--------|-----------|
| `oasis-avatar` | Load and use an OASIS Avatar |
| `oasis-holon` | Create and save a Holon |
| `oasis-provider` | Activate a Provider |
| `oasis-oapp` | OAPP entry point class |
| `oasis-web6-complete` | Web6 AI completion call |
| `oasis-mcp-tool` | Execute an MCP tool |
| `oasis-search` | Search Holons |
| `oasis-nft-mint` | Mint an NFT |

Snippets are registered for TypeScript and C# and sorted above LSP completions.

---

## Settings

Open with **⚙** in the Explorer panel or via the Command Palette.

| Setting | Description |
|---------|-------------|
| **Auto Save** | Off (default) or After Delay |
| **Auto Save Delay** | Milliseconds before auto-save fires (default 1500 ms) |
| **Editor Theme** | OASIS Dark, VS Dark, VS Light, High Contrast, Monokai, One Dark |
| **Web4–Web10 URLs** | Endpoints for each OASIS layer |
| **Web6 API Key** | Key for the Web6 AI service |
| **MCP Server Path** | Path to the .NET MCP server (auto-detected if omitted) |
| **STAR CLI Path** | Path to the STAR CLI executable (auto-detected if omitted) |
| **OpenServ / OpenAI API keys** | For agent and AI features |

Settings are persisted to `%APPDATA%\oasis-ide\oasis-ide-settings.json` and take effect immediately (except MCP/STAR paths, which require a restart).

---

## Project structure

```
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # IPC handlers
│   │   ├── preload.ts        # contextBridge API
│   │   └── services/
│   │       ├── FileSystemService.ts
│   │       ├── GitService.ts
│   │       ├── LspService.ts
│   │       ├── SettingsService.ts
│   │       └── ...
│   └── renderer/             # React UI
│       ├── App.tsx           # Root — providers, keyboard shortcuts, modals
│       ├── components/
│       │   ├── Editor/       # Monaco editor, split pane, snippets
│       │   ├── ActionPalette/  # Ctrl+Shift+P command palette
│       │   ├── CommandPalette/ # Ctrl+P file picker
│       │   ├── SymbolSearch/   # Ctrl+Shift+O workspace symbol search
│       │   ├── StatusBar/    # Bottom status bar
│       │   ├── Git/          # Git panel (changes, log, diff, branches)
│       │   ├── FileExplorer/ # File tree with context menu
│       │   ├── Chat/         # Web6 AI chat
│       │   ├── Terminal/     # OS and STAR CLI terminals
│       │   ├── Settings/     # Settings panel + modal
│       │   ├── Problems/     # tsc / ESLint problems panel
│       │   └── ...
│       └── contexts/
│           ├── WorkspaceContext.tsx  # Tab model, file I/O, tab persistence
│           ├── StatusBarContext.tsx  # Cursor position, LSP status
│           ├── ToastContext.tsx      # Toast notifications
│           └── ...
├── package.json
├── SETUP.md
└── README.md
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run IDE in development (watch + hot reload) |
| `npm run build` | Build main + renderer for production |
| `npm start` | Run built app (after `npm run build`) |
| `npm run package` | Package for current OS (mac/win/linux) |
| `npm run rebuild:terminal` | Rebuild node-pty for Electron (fix terminal issues) |

---

## Docs and links

- **Detailed setup:** [SETUP.md](./SETUP.md) (env vars, external repo, troubleshooting)
- **OASIS platform:** https://oasisplatform.world

---

## License

MIT
