import * as vscode from 'vscode';
import { Snapshot, SnapshotStore } from './snapshotStore';
import { CapturedTab } from './tabScanner';

export type TreeNode = ActionNode | SnapshotNode | SessionNode;

export class ActionNode extends vscode.TreeItem {
  readonly kind = 'action' as const;
  constructor(label: string, commandId: string, icon: string, tooltip?: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(icon);
    this.contextValue = 'action';
    this.tooltip = tooltip ?? label;
    this.command = {
      command: commandId,
      title: label
    };
  }
}

export class SnapshotNode extends vscode.TreeItem {
  readonly kind = 'snapshot' as const;
  constructor(readonly snapshot: Snapshot) {
    super(snapshot.name, vscode.TreeItemCollapsibleState.Collapsed);
    const when = new Date(snapshot.createdAt).toLocaleString();
    const auto = snapshot.isAuto ? ' • auto' : '';
    this.description = `${snapshot.tabs.length} tab${snapshot.tabs.length === 1 ? '' : 's'} • ${when}${auto}`;
    this.tooltip = `${snapshot.name}\n${snapshot.workspaceFolder}\nSaved: ${when}\nTabs: ${snapshot.tabs.length}`;
    this.iconPath = new vscode.ThemeIcon(snapshot.isAuto ? 'history' : 'bookmark');
    this.contextValue = 'snapshot';
    this.id = snapshot.id;
  }
}

export class SessionNode extends vscode.TreeItem {
  readonly kind = 'session' as const;
  constructor(readonly snapshotId: string, readonly workspaceFolder: string, readonly tab: CapturedTab) {
    super(tab.title, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${tab.title}\nsessionId: ${tab.sessionId}`;
    this.description = tab.sessionId.slice(0, 8);
    this.iconPath = new vscode.ThemeIcon('comment-discussion');
    this.contextValue = 'session';
    this.id = `${snapshotId}::${tab.sessionId}`;
    this.command = {
      command: 'claudeTabs.restoreSession',
      title: 'Restore This Tab',
      arguments: [this]
    };
  }
}

export class SnapshotProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChange = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private readonly store: SnapshotStore, private readonly workspaceFolder: string | undefined) {
    store.onChange(() => this._onDidChange.fire());
  }

  refresh(): void {
    this._onDidChange.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      if (!this.workspaceFolder) { return []; }
      const snapshots = this.store.list(this.workspaceFolder);
      const actions: TreeNode[] = [
        new ActionNode('New Snapshot…', 'claudeTabs.saveSnapshot', 'add', 'Capture all currently open Claude Code tabs and save under a name you choose'),
        new ActionNode('Quick Save', 'claudeTabs.quickSave', 'save-all', 'Save a timestamped snapshot of current tabs without prompting for a name')
      ];
      return [...actions, ...snapshots.map((s) => new SnapshotNode(s))];
    }
    if (element.kind === 'snapshot') {
      return element.snapshot.tabs.map((t) => new SessionNode(element.snapshot.id, element.snapshot.workspaceFolder, t));
    }
    return [];
  }
}
