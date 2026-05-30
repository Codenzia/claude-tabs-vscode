import * as vscode from 'vscode';
import { CapturedTab } from './tabScanner';

const PRIMARY_OPEN_COMMAND = 'claude-vscode.primaryEditor.open';
const EDITOR_OPEN_COMMAND = 'claude-vscode.editor.open';
const CLAUDE_EXTENSION_ID_PREFIX = 'anthropic.claude-code';

export interface RestoreOptions {
  delayMs: number;
  progress?: vscode.Progress<{ message?: string; increment?: number }>;
  token?: vscode.CancellationToken;
}

export async function isClaudeCodeInstalled(): Promise<boolean> {
  for (const ext of vscode.extensions.all) {
    if (ext.id.toLowerCase().startsWith(CLAUDE_EXTENSION_ID_PREFIX)) { return true; }
  }
  const commands = await vscode.commands.getCommands(true);
  return commands.includes(PRIMARY_OPEN_COMMAND) || commands.includes(EDITOR_OPEN_COMMAND);
}

async function pickOpenCommand(): Promise<string | undefined> {
  const commands = await vscode.commands.getCommands(true);
  if (commands.includes(PRIMARY_OPEN_COMMAND)) { return PRIMARY_OPEN_COMMAND; }
  if (commands.includes(EDITOR_OPEN_COMMAND)) { return EDITOR_OPEN_COMMAND; }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function restoreOne(sessionId: string): Promise<boolean> {
  const cmd = await pickOpenCommand();
  if (!cmd) { return false; }
  try {
    if (cmd === EDITOR_OPEN_COMMAND) {
      await vscode.commands.executeCommand(cmd, sessionId, undefined, vscode.ViewColumn.Active);
    } else {
      await vscode.commands.executeCommand(cmd, sessionId, undefined);
    }
    return true;
  } catch (err) {
    console.error('[claude-tabs] restoreOne failed', err);
    return false;
  }
}

export async function restoreMany(tabs: CapturedTab[], opts: RestoreOptions): Promise<{ opened: number; failed: number }> {
  const cmd = await pickOpenCommand();
  if (!cmd) {
    vscode.window.showErrorMessage(
      'Claude Code extension does not expose the open command we need. Install/update Claude Code, or open sessions manually from its history panel.'
    );
    return { opened: 0, failed: tabs.length };
  }
  let opened = 0;
  let failed = 0;
  const total = tabs.length;
  for (let i = 0; i < total; i++) {
    if (opts.token?.isCancellationRequested) { break; }
    const tab = tabs[i];
    opts.progress?.report({
      message: `${i + 1}/${total} — ${tab.title.slice(0, 60)}`,
      increment: 100 / total
    });
    try {
      if (cmd === EDITOR_OPEN_COMMAND) {
        await vscode.commands.executeCommand(cmd, tab.sessionId, undefined, vscode.ViewColumn.Active);
      } else {
        await vscode.commands.executeCommand(cmd, tab.sessionId, undefined);
      }
      opened++;
    } catch (err) {
      console.error('[claude-tabs] restore failed for', tab.sessionId, err);
      failed++;
    }
    if (opts.delayMs > 0 && i < total - 1) { await sleep(opts.delayMs); }
  }
  return { opened, failed };
}
