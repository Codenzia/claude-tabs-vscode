# Changelog

All notable changes to **Claude Tabs** will be documented here.

## [0.1.8] — 2026-09-10

### Added
- Dropped tabs are now reopened **automatically** by the startup check (15s and 2min passes) — a notice lists which ones came back. Set `claudeTabs.autoRestoreMissing` to `false` to get the old button instead.

### Fixed
- The startup check now compares against the last snapshot taken *before* the window opened (normally the Shutdown one) merged with the Startup snapshot. The Startup snapshot alone was an unsafe baseline: VSCode can re-flush its layout without the tabs it dropped, hiding them from the diff.
- Captures now drop tabs that are neither in the live tab bar nor backed by a running process, so a tab you closed shortly before a reload is no longer treated as "dropped" and reopened.

## [0.1.7] — 2026-09-06

### Added
- Sessions whose transcript no longer exists on disk (Claude Code deletes transcripts after `cleanupPeriodDays`, default 30) are marked in the tree with a warning icon and "transcript deleted"; the snapshot row shows how many. They are no longer clickable, and every restore command skips them and reports the count — reopening one only produced an empty tab.

## [0.1.6] — 2026-08-26

### Fixed
- The startup missing-tab check now runs a second pass two minutes after the window opens. VSCode restores webview tabs as placeholders and can still close one when it hydrates it later, so a single early check missed those late drops. The second pass only reports tabs not already reported.

## [0.1.5] — 2026-08-21

### Added
- **Restore Missing Tabs** — compares a snapshot (latest by default, or any snapshot via its context menu) against the tabs currently open and reopens only the gap. No import step, no duplicates.
- Startup check: after the window finishes restoring, Claude Tabs detects tabs that VSCode dropped (typically after a Claude Code extension update) and offers one-click restore. Disable via `claudeTabs.checkMissingOnStartup`.

### Changed
- Snapshots now capture the tab set from VSCode's persisted editor layout (`state.vscdb`, read with a vendored sql.js build) merged with live-process scanning. This also captures idle tabs that have no running CLI process — previously the main way tabs escaped snapshots — and preserves custom tab names and tab-bar order.

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
