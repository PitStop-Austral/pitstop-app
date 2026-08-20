# Install CodeGraph

[CodeGraph](https://github.com/colbymchenry/codegraph) indexes each project locally and exposes its graph to supported agents through MCP.

## 1. Install the CLI

### macOS or Linux

```bash
curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex
```

Alternatively, if Node.js is already installed:

```bash
npm install --global @colbymchenry/codegraph
```

Open a new terminal so `codegraph` is available on `PATH`.

## 2. Connect your agents

```bash
codegraph install
```

This configures CodeGraph's MCP server for detected supported agents, including Codex and Claude Code.

## 3. Initialize the project

Run this from the repository root:

```bash
codegraph init
```

It creates `.codegraph/`, builds the initial graph, and enables automatic updates when files change.

## Maintenance

```bash
codegraph status
codegraph upgrade
```

To remove CodeGraph's agent configuration and CLI, run `codegraph uninstall`. Project indexes remain until removed with `codegraph uninit`.
