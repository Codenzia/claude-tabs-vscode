import * as vscode from 'vscode';
import { captureCurrentTabs, captureCurrentTabsSync } from './tabScanner';
import { Snapshot, SnapshotStore } from './snapshotStore';
import { SessionNode, SnapshotNode, SnapshotProvider, TreeNode } from './snapshotProvider';
import { isClaudeCodeInstalled, restoreMany, restoreOne } from './restorer';

let deactivateState: { store: SnapshotStore; root: string } | undefined;

const CONFIG_NS = 'claudeTabs';
const SETTING_AUTO = 'autoSnapshotOnDeactivate';
const SETTING_PERIODIC = 'periodicSnapshotMinutes';
const SETTING_AUTO_KEEP = 'autoSnapshotKeep';
const SETTING_DELAY = 'restoreDelayMs';
const STATE_VIEW_HAS_SNAPSHOTS = 'claudeTabs:hasSnapshots';

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function cfg(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(CONFIG_NS);
}

function updateViewContext(store: SnapshotStore, root: string | undefined) {
  const has = !!root && store.list(root).length > 0;
  vscode.commands.executeCommand('setContext', STATE_VIEW_HAS_SNAPSHOTS, has);
}

async function captureWithFeedback(root: string): Promise<ReturnType<typeof captureCurrentTabs> extends Promise<infer T> ? T : never> {
  return await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Claude Tabs: scanning open tabs…', cancellable: false },
    async () => captureCurrentTabs(root)
  );
}

export function activate(context: vscode.ExtensionContext) {
  const store = new SnapshotStore(context);
  const root = workspaceRoot();
  const provider = new SnapshotProvider(store, root);

  const treeView = vscode.window.createTreeView('claudeTabs.snapshots', {
    treeDataProvider: provider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  store.onChange(() => updateViewContext(store, root));
  updateViewContext(store, root);

  if (root) {
    deactivateState = { store, root };
  }

  const ensureRoot = (): string | undefined => {
    const r = workspaceRoot();
    if (!r) {
      vscode.window.showWarningMessage('Claude Tabs: open a workspace folder first.');
      return undefined;
    }
    return r;
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeTabs.refresh', () => provider.refresh()),

    vscode.commands.registerCommand('claudeTabs.saveSnapshot', async () => {
      const r = ensureRoot();
      if (!r) { return; }
      const tabs = await captureWithFeedback(r);
      if (tabs.length === 0) {
        vscode.window.showInformationMessage('No running Claude Code tabs found for this workspace.');
        return;
      }
      const suggested = `${new Date().toLocaleString()} — ${tabs.length} tabs`;
      const name = await vscode.window.showInputBox({
        prompt: 'Snapshot name',
        value: suggested,
        placeHolder: 'e.g. "before extension update"'
      });
      if (!name) { return; }
      const snap = await store.save(r, name, tabs, false);
      vscode.window.showInformationMessage(`Saved snapshot "${snap.name}" with ${snap.tabs.length} tab${snap.tabs.length === 1 ? '' : 's'}.`);
    }),

    vscode.commands.registerCommand('claudeTabs.quickSave', async () => {
      const r = ensureRoot();
      if (!r) { return; }
      const tabs = await captureWithFeedback(r);
      if (tabs.length === 0) {
        vscode.window.showInformationMessage('No running Claude Code tabs found for this workspace.');
        return;
      }
      const name = `Quick save — ${new Date().toLocaleString()}`;
      const snap = await store.save(r, name, tabs, false);
      vscode.window.showInformationMessage(`Saved "${snap.name}" (${snap.tabs.length} tabs).`);
    }),

    vscode.commands.registerCommand('claudeTabs.restoreSnapshot', async (node?: SnapshotNode) => {
      let snap: Snapshot | undefined = node?.snapshot;
      if (!snap) {
        const r = ensureRoot();
        if (!r) { return; }
        const list = store.list(r);
        if (list.length === 0) {
          vscode.window.showInformationMessage('No snapshots yet for this workspace.');
          return;
        }
        const pick = await vscode.window.showQuickPick(
          list.map((s) => ({
            label: s.name,
            description: `${s.tabs.length} tabs • ${new Date(s.createdAt).toLocaleString()}`,
            snap: s
          })),
          { placeHolder: 'Pick a snapshot to restore' }
        );
        if (!pick) { return; }
        snap = pick.snap;
      }
      if (!(await isClaudeCodeInstalled())) {
        vscode.window.showErrorMessage('Claude Code extension is not installed. Install it to restore tabs.');
        return;
      }
      const delayMs = cfg().get<number>(SETTING_DELAY, 400);
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Restoring "${snap.name}"…`,
          cancellable: true
        },
        async (progress, token) => {
          const result = await restoreMany(snap!.tabs, { delayMs, progress, token });
          if (result.failed === 0) {
            vscode.window.showInformationMessage(`Restored ${result.opened} tab${result.opened === 1 ? '' : 's'}.`);
          } else {
            vscode.window.showWarningMessage(`Restored ${result.opened} of ${snap!.tabs.length} (${result.failed} failed). Check the Claude Code history panel.`);
          }
        }
      );
    }),

    vscode.commands.registerCommand('claudeTabs.restoreSession', async (node?: SessionNode) => {
      if (!node) { return; }
      if (!(await isClaudeCodeInstalled())) {
        vscode.window.showErrorMessage('Claude Code extension is not installed.');
        return;
      }
      const ok = await restoreOne(node.tab.sessionId);
      if (!ok) {
        vscode.window.showErrorMessage('Failed to open that tab. The Claude Code open command may have changed.');
      }
    }),

    vscode.commands.registerCommand('claudeTabs.renameSnapshot', async (node?: SnapshotNode) => {
      if (!node) { return; }
      const newName = await vscode.window.showInputBox({
        prompt: 'New name',
        value: node.snapshot.name
      });
      if (!newName || newName === node.snapshot.name) { return; }
      await store.rename(node.snapshot.workspaceFolder, node.snapshot.id, newName);
    }),

    vscode.commands.registerCommand('claudeTabs.deleteSnapshot', async (node?: SnapshotNode) => {
      if (!node) { return; }
      const choice = await vscode.window.showWarningMessage(
        `Delete snapshot "${node.snapshot.name}"?`,
        { modal: true },
        'Delete'
      );
      if (choice !== 'Delete') { return; }
      await store.delete(node.snapshot.workspaceFolder, node.snapshot.id);
    }),

    vscode.commands.registerCommand('claudeTabs.exportSnapshots', async () => {
      const data = store.exportAll();
      const uri = await vscode.window.showSaveDialog({
        saveLabel: 'Export',
        filters: { JSON: ['json'] },
        defaultUri: vscode.Uri.file(`claude-tabs-snapshots-${Date.now()}.json`)
      });
      if (!uri) { return; }
      await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(data, null, 2), 'utf8'));
      vscode.window.showInformationMessage(`Exported snapshots to ${uri.fsPath}`);
    }),

    vscode.commands.registerCommand('claudeTabs.importSnapshots', async () => {
      const picks = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { JSON: ['json'] },
        openLabel: 'Import'
      });
      if (!picks || picks.length === 0) { return; }
      try {
        const raw = await vscode.workspace.fs.readFile(picks[0]);
        const parsed = JSON.parse(Buffer.from(raw).toString('utf8'));
        const result = await store.importMerge(parsed);
        vscode.window.showInformationMessage(`Imported ${result.added} snapshot(s); skipped ${result.skipped} duplicate(s).`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Import failed: ${err?.message ?? err}`);
      }
    })
  );

  let periodicHandle: NodeJS.Timeout | undefined;
  const setupPeriodic = () => {
    if (periodicHandle) { clearInterval(periodicHandle); periodicHandle = undefined; }
    const minutes = cfg().get<number>(SETTING_PERIODIC, 15);
    if (minutes > 0 && root) {
      periodicHandle = setInterval(async () => {
        try {
          const tabs = await captureCurrentTabs(root);
          if (tabs.length === 0) { return; }
          const name = `Auto — ${new Date().toLocaleString()}`;
          await store.save(root, name, tabs, true);
          const keep = cfg().get<number>(SETTING_AUTO_KEEP, 10);
          await store.pruneAutoSnapshots(root, keep);
        } catch (err) {
          console.error('[claude-tabs] periodic snapshot failed', err);
        }
      }, minutes * 60 * 1000);
    }
  };
  setupPeriodic();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${CONFIG_NS}.${SETTING_PERIODIC}`)) { setupPeriodic(); }
    }),
    { dispose: () => { if (periodicHandle) { clearInterval(periodicHandle); } } }
  );

  (async () => {
    try {
      if (cfg().get<boolean>(SETTING_AUTO, true) && root) {
        const tabs = await captureCurrentTabs(root);
        if (tabs.length > 0) {
          const name = `Startup — ${new Date().toLocaleString()}`;
          await store.save(root, name, tabs, true);
          await store.pruneAutoSnapshots(root, cfg().get<number>(SETTING_AUTO_KEEP, 10));
        }
      }
    } catch (err) {
      console.error('[claude-tabs] startup snapshot failed', err);
    }
  })();
}

export function deactivate(): Thenable<void> | void {
  const state = deactivateState;
  deactivateState = undefined;
  if (!state) { return; }
  if (!vscode.workspace.getConfiguration(CONFIG_NS).get<boolean>(SETTING_AUTO, true)) { return; }
  let tabs;
  try {
    tabs = captureCurrentTabsSync(state.root);
  } catch (err) {
    console.error('[claude-tabs] deactivate sync capture failed', err);
    return;
  }
  if (!tabs || tabs.length === 0) { return; }
  const name = `Shutdown — ${new Date().toLocaleString()}`;
  return state.store.save(state.root, name, tabs, true).then(
    () => state.store.pruneAutoSnapshots(
      state.root,
      vscode.workspace.getConfiguration(CONFIG_NS).get<number>(SETTING_AUTO_KEEP, 10)
    ),
    (err) => { console.error('[claude-tabs] deactivate save failed', err); }
  );
}
