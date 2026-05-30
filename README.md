# Claude Tabs

> Snapshot and restore your Claude Code conversation tabs across VSCode restarts, crashes, and extension updates. Developed by [**Codenzia**](https://codenzia.com).

If you keep many Claude Code conversations open in VSCode — one per project, one per task, one per investigation — every extension update or window restart normally costs you the entire set. Claude Tabs solves this in one click.

## Why it exists

Anthropic's Claude Code extension stores each conversation on disk, but **the *open tab set* — which conversations you actually had open — is not preserved across restarts**. You can find old conversations in the history panel, but you have to remember which 19 you cared about and reopen them one by one.

Claude Tabs makes the open tab set a first-class object:

- **Save it** as a named snapshot before doing anything risky
- **Auto-save it** on a timer and at shutdown
- **Restore it** as real Claude Code editor tabs with one click

## Features

- **Named snapshots** — Save the current tab set under any label (`"before 2.1.158 update"`, `"monday platform work"`)
- **One-click restore** — Reopens every conversation as a proper Claude Code editor tab, not a terminal session
- **Auto snapshots** — At workspace startup, on a configurable interval, and at shutdown — three layers of safety
- **Per-workspace** — Each project keeps its own snapshot list; no cross-contamination
- **Tree view in the Activity Bar** — Browse, expand to see titled tabs inside each snapshot, right-click to restore / rename / delete
- **Export / Import** — Snapshots are plain JSON; back them up or move them between machines
- **Lightweight** — Pure TypeScript, no native deps, no telemetry

## Quick start

1. Install the extension
2. Click the **bookmark icon** in the Activity Bar (left edge)
3. Click **+ New Snapshot…** in the tree, give it a name
4. When you need to restore: right-click the snapshot → **Restore All Tabs from Snapshot**

## How it works

Claude Code persists every conversation under `~/.claude/projects/<workspace>/<sessionId>.jsonl`, and writes a per-process descriptor under `~/.claude/sessions/<pid>.json` while each tab is live. Claude Tabs:

1. Scans those files for sessions whose `cwd` matches your current workspace and whose process is still alive
2. Reads the first user message from each transcript to give you a recognizable title
3. Stores the resulting `(sessionId, title)` list in VSCode's `globalState`, keyed by workspace folder
4. On restore, invokes the Claude Code extension's `claude-vscode.primaryEditor.open` command for each saved sessionId

## Commands

| Command | Description |
| --- | --- |
| `Claude Tabs: Save Snapshot…` | Capture current tabs and save with a name you choose |
| `Claude Tabs: Quick Save (timestamped)` | Same, auto-named with the current time |
| `Claude Tabs: Restore All Tabs from Snapshot` | Reopen every tab in a snapshot |
| `Claude Tabs: Restore This Tab` | Reopen a single conversation |
| `Claude Tabs: Rename Snapshot` | Rename an existing snapshot |
| `Claude Tabs: Delete Snapshot` | Delete a snapshot |
| `Claude Tabs: Export Snapshots to JSON…` | Back up all snapshots across all workspaces |
| `Claude Tabs: Import Snapshots from JSON…` | Restore from a backup |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `claudeTabs.autoSnapshotOnDeactivate` | `true` | Take an auto-snapshot at startup and at window shutdown |
| `claudeTabs.periodicSnapshotMinutes` | `15` | Auto-snapshot every N minutes; `0` to disable |
| `claudeTabs.autoSnapshotKeep` | `10` | How many auto-snapshots to retain per workspace |
| `claudeTabs.restoreDelayMs` | `400` | Pause between reopening each tab during restore |

## Requirements

- VSCode `1.85` or newer
- The [Claude Code](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) VSCode extension (Claude Tabs invokes its internal open command to rehydrate tabs)

## Compatibility note

Claude Tabs depends on an internal Claude Code extension command (`claude-vscode.primaryEditor.open` / `claude-vscode.editor.open`) that accepts a sessionId. Anthropic may rename this in a future release; Claude Tabs detects its absence and surfaces a clear error so you can fall back to Claude Code's history panel.

## About Codenzia

[Codenzia](https://codenzia.com) builds developer tooling and SaaS infrastructure on the Laravel + Filament stack. Claude Tabs is part of our public toolkit for teams that live in AI-assisted editors.

## License

MIT — see [LICENSE](LICENSE).
