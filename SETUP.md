# OASIS IDE Setup Guide

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (https://nodejs.org/)
- **npm** or **yarn**
- **Git**

### Installation

1. **Navigate to project directory:**
   ```bash
   cd OASIS-IDE
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build OASIS MCP Server (if not already built):**
   ```bash
   cd ../MCP
   npm install
   npm run build
   cd ../OASIS-IDE
   ```

4. **Start development:**
   ```bash
   npm run dev
   ```

This will:
- Start Electron main process (watching for changes)
- Start Vite dev server on http://localhost:3000
- Open OASIS IDE window

## 📁 Project Structure

```
OASIS-IDE/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # Main entry point
│   │   ├── preload.ts     # Preload script
│   │   └── services/     # Backend services
│   │       ├── MCPServerManager.ts
│   │       ├── OASISAPIClient.ts
│   │       └── AgentRuntime.ts
│   ├── renderer/          # React frontend
│   │   ├── components/    # React components
│   │   ├── contexts/      # React contexts
│   │   ├── styles/       # CSS files
│   │   ├── App.tsx        # Main app component
│   │   └── main.tsx       # React entry point
│   └── shared/            # Shared types/utils (to be added)
├── dist/                  # Build output
└── package.json
```

## 🔧 Development

### Running in Development Mode

```bash
npm run dev
```

- Main process auto-reloads on changes
- Renderer hot-reloads via Vite
- DevTools open automatically

### Building for Production

```bash
npm run build
```

Builds both main and renderer processes to `dist/`.

### Packaging

```bash
# Package for current platform
npm run package

# Package for specific platform
npm run package:mac
npm run package:win
npm run package:linux
```

## 🔗 Integration Points

### OASIS MCP Server

The IDE automatically starts the OASIS MCP server located at:
```
../../MCP/dist/index.js
```

Make sure this path is correct or update `MCPServerManager.ts`.

### OASIS API

Default API URL: `http://127.0.0.1:5003`

Set via environment variable:
```bash
export OASIS_API_URL=http://your-oasis-api-url

# If the IDE is run from outside the OASIS monorepo (e.g. external repo), point to the MCP server:
# export OASIS_MCP_SERVER_PATH=/path/to/MCP/dist/src/index.js
```

**Default IDE Assistant agent:** Chat can use the OASIS IDE Assistant agent (Phase 1 backend). The agent ID defaults to `oasis-ide-assistant`. When the platform registers the agent with a different ID, set:
```bash
export OASIS_IDE_ASSISTANT_AGENT_ID=<your-agent-guid>
```

### Running from an external repo

If the IDE lives in a **separate repo** (e.g. for collaboration), it can still use OASIS:

- **OASIS API**: Set `OASIS_API_URL` to your OASIS API (local `http://127.0.0.1:5003`, staging, or production). All auth, chat, agents, and health go over HTTP.
- **OASIS MCP**: Set `OASIS_MCP_SERVER_PATH` to the **absolute path** of the MCP server entry file (`.../MCP/dist/src/index.js`). Options:
  - Clone the OASIS monorepo (or just the MCP folder) somewhere and build it; point `OASIS_MCP_SERVER_PATH` at `.../MCP/dist/src/index.js`.
  - If `@oasis-unified/mcp-server` is published to npm, install it and set `OASIS_MCP_SERVER_PATH` to `node_modules/@oasis-unified/mcp-server/dist/index.js` (or the path the package uses for its bin).

No other monorepo code is required; the IDE has no workspace package dependencies.

## 🐛 Troubleshooting

### MCP Server Not Starting

1. Check that the MCP entry file exists (monorepo: `../MCP/dist/src/index.js`; or path in `OASIS_MCP_SERVER_PATH`)
2. Verify MCP server is built: `cd ../MCP && npm run build`
3. Check console for errors

### OASIS API Connection Issues

1. Verify OASIS API is running
2. Check API URL in `OASISAPIClient.ts`
3. Test with: `curl http://127.0.0.1:5003/api/health`

### Build Errors

1. Clear node_modules: `rm -rf node_modules && npm install`
2. Clear build: `rm -rf dist && npm run build`
3. Check Node.js version: `node --version` (should be 18+)

## 📚 Next Steps

1. **Review Briefs:**
   - Master Brief: `/Docs/OASIS_IDE_MASTER_BRIEF.md`
   - Component Briefs: `/Docs/OASIS_IDE_BRIEF_*.md`

2. **Start Development:**
   - Pick a component from the briefs
   - Implement following the specifications
   - Test and iterate

3. **Integration:**
   - Ensure components work together
   - Test MCP tool execution
   - Test agent invocation

## 🎯 Current Status

✅ **Foundation Complete:**
- Project structure
- Electron setup
- React setup
- Basic layout
- MCP integration skeleton
- Agent system skeleton

🚧 **In Progress:**
- Component implementations
- AI assistant integration
- OASIS development tools

📋 **Planned:**
- Full feature implementation
- Testing
- Documentation
- Packaging

---

*Happy coding! 🚀*
