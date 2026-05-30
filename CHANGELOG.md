# Changelog

All notable changes to **Claude Tabs** will be documented here.

## [0.1.4] — 2026-05-30

### Added
- Marketplace icon (orange bookmark on dark slate) and dark gallery banner.

## [0.1.3] — 2026-05-30

### Changed
- Marketplace-ready README with stronger hook, comparison table, and usage walkthrough.
- Added CHANGELOG.

## [0.1.2] — 2026-05-30

### Added
- Permanent **+ New Snapshot…** and **+ Quick Save** actions at the top of the tree so users can always create a new snapshot without hunting for title-bar icons.

## [0.1.1] — 2026-05-30

### Fixed
- Activity Bar icon now renders correctly (switched from ThemeIcon syntax to an embedded SVG resource).

## [0.1.0] — 2026-05-30

### Initial release
- Per-workspace snapshots of the open Claude Code tab set, stored in VSCode `globalState`.
- TreeView in the Activity Bar with snapshot list, expandable to show titled sessions.
- Save Snapshot (named) and Quick Save (timestamped) commands.
- One-click restore for an entire snapshot or a single tab via the Claude Code extension's `claude-vscode.primaryEditor.open` internal command.
- Rename and delete operations on snapshots.
- Export and import all snapshots as JSON for backup or cross-machine transfer.
- Auto-snapshot at workspace startup, on a configurable interval (default 15 min), and at shutdown via `deactivate()`.
- Graceful detection when the Claude Code extension is missing or its open command is unavailable.
