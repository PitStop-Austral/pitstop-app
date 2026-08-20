# Install Ponytail

[Ponytail](https://github.com/DietrichGebert/ponytail) is developer tooling, not an application dependency.

Node.js must be available on the non-interactive shell `PATH` for Ponytail lifecycle hooks. The skills still work without it, but automatic activation does not.

## Codex

Install the Ponytail marketplace, then install its plugin:

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

Then run `codex`, open `/hooks`, review and trust its two lifecycle hooks, and start a new thread. Restart the Codex desktop app after installing the plugin.

To update the marketplace, run:

```bash
codex plugin marketplace upgrade ponytail
```

## Claude Code

In a Claude Code session, send these as **two separate prompts**:

```text
/plugin marketplace add DietrichGebert/ponytail
```

```text
/plugin install ponytail@ponytail
```

The same steps work in the Claude Code Desktop app's **Code** tab.

Ponytail defaults to `full` mode. Switch modes with:

```text
/ponytail lite
/ponytail full
/ponytail ultra
```

Disable it for the current session with `stop ponytail`, `normal mode`, or `/ponytail off`.

To update it manually, run `/plugin marketplace update ponytail` and then `/reload-plugins`.
