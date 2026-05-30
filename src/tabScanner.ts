import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';

export interface RunningSession {
  sessionId: string;
  pid: number;
  startedAt: number;
}

export interface CapturedTab {
  sessionId: string;
  title: string;
  startedAt: number;
}

const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions');
const PROJECTS_ROOT = path.join(os.homedir(), '.claude', 'projects');

export function projectKeyFor(workspaceDir: string): string {
  return workspaceDir.replace(/[:\\/]/g, '-');
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err && err.code === 'EPERM';
  }
}

function pathsEqual(a: string, b: string): boolean {
  const norm = (p: string) => path.resolve(p).toLowerCase();
  return norm(a) === norm(b);
}

export function findRunningSessions(workspaceDir: string): RunningSession[] {
  if (!fs.existsSync(SESSIONS_DIR)) { return []; }
  const out: RunningSession[] = [];
  for (const name of fs.readdirSync(SESSIONS_DIR)) {
    if (!name.endsWith('.json')) { continue; }
    const full = path.join(SESSIONS_DIR, name);
    try {
      const raw = fs.readFileSync(full, 'utf8');
      const j = JSON.parse(raw);
      if (!j.cwd || !j.sessionId || j.pid === undefined) { continue; }
      if (!pathsEqual(j.cwd, workspaceDir)) { continue; }
      if (!isPidAlive(Number(j.pid))) { continue; }
      out.push({
        sessionId: String(j.sessionId),
        pid: Number(j.pid),
        startedAt: Number(j.startedAt ?? 0)
      });
    } catch { /* skip malformed */ }
  }
  return out;
}

async function firstUserText(transcriptPath: string): Promise<string> {
  if (!fs.existsSync(transcriptPath)) { return ''; }
  return new Promise<string>((resolve) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(transcriptPath, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });
    let done = false;
    const finish = (val: string) => {
      if (done) { return; }
      done = true;
      rl.close();
      resolve(val);
    };
    rl.on('line', (line) => {
      if (done) { return; }
      if (!line.includes('"type":"user"')) { return; }
      try {
        const rec = JSON.parse(line);
        if (rec.type !== 'user' || !rec.message) { return; }
        if (rec.isSidechain) { return; }
        const content = rec.message.content;
        if (typeof content === 'string') { return finish(content); }
        if (Array.isArray(content)) {
          for (const blk of content) {
            if (blk?.type === 'text' && typeof blk.text === 'string' && blk.text.trim()) {
              return finish(blk.text);
            }
          }
        }
      } catch { /* skip malformed line */ }
    });
    rl.on('close', () => finish(''));
    rl.on('error', () => finish(''));
  });
}

function formatTitle(raw: string, fallbackTimestamp: number): string {
  const trimmed = (raw || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    const when = fallbackTimestamp ? new Date(fallbackTimestamp).toISOString().slice(0, 16).replace('T', ' ') : '?';
    return `(no text — image/binary first message, ${when})`;
  }
  return trimmed.length > 100 ? trimmed.slice(0, 97) + '…' : trimmed;
}

export async function captureCurrentTabs(workspaceDir: string): Promise<CapturedTab[]> {
  const sessions = findRunningSessions(workspaceDir);
  const projectKey = projectKeyFor(workspaceDir);
  const tabs: CapturedTab[] = [];
  for (const s of sessions) {
    const tx = path.join(PROJECTS_ROOT, projectKey, `${s.sessionId}.jsonl`);
    if (!fs.existsSync(tx)) { continue; }
    const raw = await firstUserText(tx);
    if (!raw) { continue; }
    tabs.push({
      sessionId: s.sessionId,
      title: formatTitle(raw, s.startedAt),
      startedAt: s.startedAt
    });
  }
  tabs.sort((a, b) => a.startedAt - b.startedAt);
  return tabs;
}

function firstUserTextSync(transcriptPath: string, maxBytes = 1024 * 1024): string {
  if (!fs.existsSync(transcriptPath)) { return ''; }
  let fd: number | undefined;
  try {
    fd = fs.openSync(transcriptPath, 'r');
    const stat = fs.fstatSync(fd);
    const len = Math.min(stat.size, maxBytes);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, 0);
    const text = buf.toString('utf8');
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line || !line.includes('"type":"user"')) { continue; }
      try {
        const rec = JSON.parse(line);
        if (rec.type !== 'user' || !rec.message || rec.isSidechain) { continue; }
        const content = rec.message.content;
        if (typeof content === 'string') { return content; }
        if (Array.isArray(content)) {
          for (const blk of content) {
            if (blk?.type === 'text' && typeof blk.text === 'string' && blk.text.trim()) {
              return blk.text;
            }
          }
        }
      } catch { /* skip malformed */ }
    }
    return '';
  } catch {
    return '';
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }
}

export function captureCurrentTabsSync(workspaceDir: string): CapturedTab[] {
  const sessions = findRunningSessions(workspaceDir);
  const projectKey = projectKeyFor(workspaceDir);
  const tabs: CapturedTab[] = [];
  for (const s of sessions) {
    const tx = path.join(PROJECTS_ROOT, projectKey, `${s.sessionId}.jsonl`);
    if (!fs.existsSync(tx)) { continue; }
    const raw = firstUserTextSync(tx);
    if (!raw) { continue; }
    tabs.push({
      sessionId: s.sessionId,
      title: formatTitle(raw, s.startedAt),
      startedAt: s.startedAt
    });
  }
  tabs.sort((a, b) => a.startedAt - b.startedAt);
  return tabs;
}
