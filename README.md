# OASIS IDE

AI-powered code editor with native **OASIS MCP** (100+ tools) and **agent integration**. Built with Electron, React, and TypeScript.

**Repo:** [github.com/NextGenSoftwareUK/IDE](https://github.com/NextGenSoftwareUK/IDE)

---

##  Getting started

### 1. Clone and install

```bash
git clone https://github.com/NextGenSoftwareUK/IDE.git
cd IDE
npm install
```

### 2. Connect to OASIS

The IDE talks to OASIS over HTTP and (optionally) runs the OASIS MCP server locally. Set these **environment variables** before running:

| Variable | What it does | Example |
|----------|----------------|---------|
| **OASIS_API_URL** | Base URL of the OASIS API (auth, chat, agents, health). | `http://127.0.0.1:5003` (local) or a staging/production URL |
| **OASIS_MCP_SERVER_PATH** | *(Optional)* Full path to the OASIS MCP server entry file. Only needed if you want the 100+ MCP tools in the IDE. See [MCP setup](#mcp-tools-optional) below. | `/path/to/MCP/dist/src/index.js` |

Example (macOS/Linux):

```bash
export OASIS_API_URL=http://127.0.0.1:5003
# Optional, for MCP tools (see below):
# export OASIS_MCP_SERVER_PATH=/absolute/path/to/MCP/dist/src/index.js
```

### 3. Run the IDE

```bash
npm run dev
```

This opens the Electron window. You can log in with your OASIS avatar (username/password) if the API is running; the AI chat uses the OASIS IDE Assistant agent.

### 4. Embedded terminal (if you use it)

The in-app terminal uses **node-pty**. If you see "posix_spawnp failed" or similar:

```bash
npm run rebuild:terminal
```

Then restart the app. If rebuild fails with a Python `distutils` error (e.g. on Python 3.12+):

```bash
python3 -m pip install setuptools
npm run rebuild:terminal
```

### 5. Collaborating (workflow)

- Work on a **branch** for your feature: `git checkout -b your-feature`
- Push and open a **Pull Request** when ready.
- Keep `main` runnable; we’ll merge via PRs.

If something’s unclear or you’re blocked, reach out to Max (or the team) — we can add more docs or pair on setup.

---

## MCP tools (optional)

The IDE can start the **OASIS Unified MCP Server** so you get 100+ tools (create wallet, mint NFT, health check, etc.) from the chat and panels. This repo does **not** include the MCP server; you point to it with **OASIS_MCP_SERVER_PATH**.

**Option A — You have the OASIS monorepo (or just the MCP folder):**

1. In that repo: `cd MCP && npm install && npm run build`
2. Set the path to the built file, e.g.  
   `export OASIS_MCP_SERVER_PATH=/path/to/OASIS/MCP/dist/src/index.js`

**Option B — MCP is published as a package:**

1. Install it in this repo (e.g. `npm install @oasis-unified/mcp-server` if/when published).
2. Set `OASIS_MCP_SERVER_PATH` to the package’s entry, e.g.  
   `node_modules/@oasis-unified/mcp-server/dist/index.js` (full absolute path).

If **OASIS_MCP_SERVER_PATH** is not set, the IDE still runs; only the MCP tools won’t be available until you configure it.

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
