# OASIS IDE

AI-powered code editor with deep **OASIS Web4–Web10 integration**, 243 MCP tools, FAHRN multi-agent AI, streaming completions, STAR CLI terminals, Git panel, workspace search, and OAPP scaffolding wizard. Built with Electron, React, and TypeScript.

**Repo:** [github.com/NextGenSoftwareUK/IDE](https://github.com/NextGenSoftwareUK/IDE)

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/NextGenSoftwareUK/IDE.git
cd IDE
npm install
```

> **Important — terminal native module:** After `npm install`, rebuild node-pty for your Electron version or the built-in terminals won’t start:
> ```bash
> npm run rebuild:terminal
> ```
> If this fails with a Python `distutils` error (Python 3.12+):
> ```bash
> python3 -m pip install setuptools && npm run rebuild:terminal
> ```

### 2. Configure OASIS services

Copy `.env.example` to `.env` and fill in your values, **or** open the IDE and click the ⚙ gear icon at the bottom-left of the Explorer panel to edit settings in-app.

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

The IDE auto-detects the Web6 .NET MCP server at `C:\Source\OASIS2\WEB6\NextGenSoftware.OASIS.MCP.Server` and the STAR CLI at the monorepo’s build output. All URLs can be overridden via Settings without restarting.

### 3. Run the IDE

```bash
npm run dev
```

A yellow warning banner appears at startup if Web4 or Web6 are unreachable.

---

## Features

| Panel | How to open |
|-------|-------------|
| **Chat (Web6 AI)** | Right panel — top slot. Streaming completions, FAHRN mode, provider/model selector |
| **Inbox (A2A)** | Right panel — second slot |
| **MCP Tools (243 tools)** | Right panel — third slot. Select tool → fill args → Execute |
| **OASIS Network** | Right panel — fourth slot. Live health for all 6 layers |
| **Explorer** | Left sidebar → ⬛ icon |
| **Search** | Left sidebar → 🔍 icon, or **Ctrl+Shift+F** |
| **Git** | Left sidebar → ± icon. Changes, diff, log, commit |
| **STAR Wizard** | Left sidebar → ✦ icon. Scaffold a new OAPP |
| **Terminal** | Bottom panel. Default OS shell + STAR CLI tabs; **+** for more |
| **Settings** | ⚙ gear icon at the bottom of the Explorer panel |

---

## MCP tools

The IDE auto-starts the **Web6 .NET MCP server** (243 tools across Web4–Web10). If you have the server at a custom path, set `OASIS_MCP_SERVER_PATH`:

- `.js` file → started with `node`
- directory → started with `dotnet run --project`
- `.exe` → run directly

---

## STAR CLI terminals

The bottom panel always opens with two default tabs: an OS shell and a STAR CLI session. Press **+** to spawn additional OS shells or STAR CLI sessions. STAR CLI requires either building the STAR ODK (`net10.0/star.exe`) or setting `OASIS_STAR_CLI_PATH`.

---

## Project structure

```
├── src/
│   ├── main/           # Electron main process (MCP, API client, auth, IPC)
│   ├── renderer/       # React UI (editor, chat, panels, terminal)
│   └── preload/        # Preload script
├── package.json
├── SETUP.md            # Detailed setup and troubleshooting
└── README.md           # This file
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
