# Claude Tabs

> Developed by [**Codenzia**](https://codenzia.com)

Snapshot and restore your Claude Code conversation tabs across VSCode restarts and extension updates.

If you keep many Claude Code conversations open in VSCode (one per project, one per task, etc.), every extension update normally costs you all of them. Claude Tabs solves that with one click.

## Features

- **Save a snapshot** of all open Claude Code tabs in the current workspace, with a name you choose
- **One-click restore** — reopens every conversation in the Claude Code panel by sessionId
- **Auto snapshots** on workspace startup and on a configurable interval
- **Per-workspace** — each project keeps its own snapshot list
- **Tree view** in the Activity Bar to browse, rename, delete, and restore snapshots
- **Export / Import** snapshots as JSON for backup or transfer between machines

## How it works

Claude Code persists every conversation under `~/.claude/projects/<workspace>/<sessionId>.jsonl`, and writes a per-process descriptor under `~/.claude/sessions/<pid>.json` while each tab is live. Claude Tabs:

1. Scans those files for sessions whose `cwd` matches your current workspace and whose process is still alive.
2. Reads the first user message from each transcript to give you a recognizable title.
3. Stores the resulting `(sessionId, title)` list in VSCode's `globalState`, keyed by workspace folder.
4. On restore, invokes the Claude Code extension's `claude-vscode.primaryEditor.open` command for each saved sessionId.

## Commands

| Command | Description |
| --- | --- |
| `Claude Tabs: Save Snapshot…` | Capture current tabs and save with a name you provide |
| `Claude Tabs: Quick Save (timestamped)` | Same as above, auto-named with the current time |
| `Claude Tabs: Restore All Tabs from Snapshot` | Open all tabs from a snapshot |
| `Claude Tabs: Restore This Tab` | Reopen a single conversation |
| `Claude Tabs: Rename Snapshot` | |
| `Claude Tabs: Delete Snapshot` | |
| `Claude Tabs: Export Snapshots to JSON…` | Backup all snapshots across all workspaces |
| `Claude Tabs: Import Snapshots from JSON…` | Restore from a backup |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `claudeTabs.autoSnapshotOnDeactivate` | `true` | Take an auto-snapshot at startup as a safety net |
| `claudeTabs.periodicSnapshotMinutes` | `15` | Auto-snapshot every N minutes; `0` to disable |
| `claudeTabs.autoSnapshotKeep` | `10` | How many auto-snapshots to retain per workspace |
| `claudeTabs.restoreDelayMs` | `400` | Pause between reopening each tab during restore |

## Requirements

- VSCode `1.85` or newer
- The [Claude Code](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) VSCode extension installed (Claude Tabs uses its internal open command to rehydrate tabs)

## Compatibility note

Claude Tabs depends on an internal Claude Code extension command (`claude-vscode.primaryEditor.open` / `claude-vscode.editor.open`) that takes a sessionId. Anthropic may rename this in a future release; Claude Tabs detects its absence and surfaces a clear error so you can fall back to the Claude Code history panel.

## About Codenzia

[Codenzia](https://codenzia.com) builds developer tooling and SaaS infrastructure on the Laravel + Filament stack. Claude Tabs is part of our public toolkit for teams that live in AI-assisted editors.

## License

MIT — see [LICENSE](LICENSE).
