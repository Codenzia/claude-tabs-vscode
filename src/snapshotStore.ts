import * as vscode from 'vscode';
import { CapturedTab } from './tabScanner';

export interface Snapshot {
  id: string;
  name: string;
  createdAt: number;
  workspaceFolder: string;
  isAuto: boolean;
  tabs: CapturedTab[];
}

interface StoreShape {
  [workspaceFolder: string]: Snapshot[];
}

const STORE_KEY = 'claudeTabs.snapshots.v1';

function normalizeKey(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class SnapshotStore {
  private readonly _onChange = new vscode.EventEmitter<void>();
  readonly onChange = this._onChange.event;

  constructor(private readonly ctx: vscode.ExtensionContext) {}

  private read(): StoreShape {
    return this.ctx.globalState.get<StoreShape>(STORE_KEY, {});
  }

  private async write(s: StoreShape): Promise<void> {
    await this.ctx.globalState.update(STORE_KEY, s);
    this._onChange.fire();
  }

  list(workspaceFolder: string): Snapshot[] {
    const store = this.read();
    const arr = store[normalizeKey(workspaceFolder)] ?? [];
    return [...arr].sort((a, b) => b.createdAt - a.createdAt);
  }

  listAll(): Snapshot[] {
    const store = this.read();
    return Object.values(store).flat().sort((a, b) => b.createdAt - a.createdAt);
  }

  get(workspaceFolder: string, id: string): Snapshot | undefined {
    return this.list(workspaceFolder).find((s) => s.id === id);
  }

  async save(workspaceFolder: string, name: string, tabs: CapturedTab[], isAuto = false): Promise<Snapshot> {
    const snap: Snapshot = {
      id: uid(),
      name,
      createdAt: Date.now(),
      workspaceFolder,
      isAuto,
      tabs
    };
    const store = this.read();
    const key = normalizeKey(workspaceFolder);
    store[key] = [...(store[key] ?? []), snap];
    await this.write(store);
    return snap;
  }

  async rename(workspaceFolder: string, id: string, newName: string): Promise<void> {
    const store = this.read();
    const key = normalizeKey(workspaceFolder);
    const arr = store[key] ?? [];
    const idx = arr.findIndex((s) => s.id === id);
    if (idx < 0) { return; }
    arr[idx] = { ...arr[idx], name: newName };
    store[key] = arr;
    await this.write(store);
  }

  async delete(workspaceFolder: string, id: string): Promise<void> {
    const store = this.read();
    const key = normalizeKey(workspaceFolder);
    store[key] = (store[key] ?? []).filter((s) => s.id !== id);
    await this.write(store);
  }

  async pruneAutoSnapshots(workspaceFolder: string, keep: number): Promise<void> {
    if (keep < 1) { return; }
    const store = this.read();
    const key = normalizeKey(workspaceFolder);
    const arr = store[key] ?? [];
    const autos = arr.filter((s) => s.isAuto).sort((a, b) => b.createdAt - a.createdAt);
    const rest = arr.filter((s) => !s.isAuto);
    if (autos.length <= keep) { return; }
    store[key] = [...rest, ...autos.slice(0, keep)];
    await this.write(store);
  }

  exportAll(): StoreShape {
    return this.read();
  }

  async importMerge(incoming: StoreShape): Promise<{ added: number; skipped: number }> {
    const store = this.read();
    let added = 0;
    let skipped = 0;
    for (const [key, snaps] of Object.entries(incoming)) {
      const existing = new Set((store[key] ?? []).map((s) => s.id));
      const fresh = snaps.filter((s) => {
        if (existing.has(s.id)) { skipped++; return false; }
        added++;
        return true;
      });
      store[key] = [...(store[key] ?? []), ...fresh];
    }
    await this.write(store);
    return { added, skipped };
  }
}
