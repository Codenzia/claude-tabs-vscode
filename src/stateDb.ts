import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { CapturedTab } from './tabScanner';

const EDITOR_MEMENTO_KEY = 'memento/workbench.parts.editor';
const WEBVIEW_EDITOR_ID = 'workbench.editors.webviewInput';
const CLAUDE_PANEL_ID = 'claudeVSCodePanel';

let sqlModule: any;
let dbPath: string | undefined;

/**
 * Prepares reading of this workspace's `state.vscdb` (the database where VSCode
 * persists the editor layout, including Claude webview tabs that have no running
 * CLI process). Uses a vendored sql.js build; on any failure the extension
 * silently falls back to process-based scanning.
 */
export async function initStateDb(ctx: vscode.ExtensionContext): Promise<void> {
  try {
    const storage = ctx.storageUri?.fsPath;
    if (!storage) { return; }
    const candidate = path.join(path.dirname(storage), 'state.vscdb');
    if (!fs.existsSync(candidate)) { return; }
    const initSqlJs = require(path.join(ctx.extensionPath, 'resources', 'sqljs', 'sql-wasm.js'));
    sqlModule = await initSqlJs({
      locateFile: (file: string) => path.join(ctx.extensionPath, 'resources', 'sqljs', file)
    });
    dbPath = candidate;
  } catch (err) {
    console.error('[claude-tabs] sql.js init failed — falling back to process scanning', err);
    sqlModule = undefined;
    dbPath = undefined;
  }
}

/**
 * Reads the Claude tab set out of the persisted editor layout, in tab-bar order.
 * Returns undefined when the DB is unavailable or unreadable (e.g. a torn read
 * while VSCode is mid-write) so callers can fall back to process scanning.
 */
export function readOpenTabsFromStateDb(): CapturedTab[] | undefined {
  if (!sqlModule || !dbPath) { return undefined; }
  let db: any;
  try {
    db = new sqlModule.Database(fs.readFileSync(dbPath));
    const res = db.exec(`SELECT value FROM ItemTable WHERE key = '${EDITOR_MEMENTO_KEY}'`);
    const value = res?.[0]?.values?.[0]?.[0];
    if (typeof value !== 'string') { return undefined; }
    return extractClaudeTabs(JSON.parse(value));
  } catch (err) {
    console.error('[claude-tabs] state DB read failed', err);
    return undefined;
  } finally {
    try { db?.close(); } catch { /* ignore */ }
  }
}

function extractClaudeTabs(memento: unknown): CapturedTab[] {
  const tabs: CapturedTab[] = [];
  const seen = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== 'object') { return; }
    const obj = node as Record<string, unknown>;
    if (obj.id === WEBVIEW_EDITOR_ID && typeof obj.value === 'string') {
      try {
        const v = JSON.parse(obj.value);
        if (v?.providedId === CLAUDE_PANEL_ID) {
          const state = JSON.parse(v.state ?? '{}');
          const sessionId = state?.sessionID;
          if (typeof sessionId === 'string' && sessionId && !seen.has(sessionId)) {
            seen.add(sessionId);
            tabs.push({
              sessionId,
              title: typeof v.title === 'string' && v.title ? v.title : sessionId,
              startedAt: tabs.length
            });
          }
        }
      } catch { /* skip malformed entry */ }
    }
    Object.values(obj).forEach(walk);
  };
  walk(memento);
  return tabs;
}
