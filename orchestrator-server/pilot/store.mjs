// pilot/store.mjs — Atomic JSON persistence under PILOT_DATA_DIR.
// Collections: leads, drafts, jobs, schedule, optouts, events (webhook dedupe), conversations.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { CFG } from './env.mjs';

function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }
function pathFor(name) { return join(CFG.PILOT_DATA_DIR, `${name}.json`); }

export function readJSON(name, fallback) {
  try {
    const p = pathFor(name);
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : fallback;
  } catch { return fallback; }
}

// Atomic write: write to .tmp then rename. Prevents corrupt files on crash.
export function writeJSON(name, data) {
  ensureDir(CFG.PILOT_DATA_DIR);
  const p = pathFor(name);
  const tmp = p + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, p); // atomic on same filesystem
}

export const COLLECTIONS = ['leads', 'drafts', 'jobs', 'schedule', 'optouts', 'events', 'conversations'];

export function nowISO() { return new Date().toISOString(); }
export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// Generic CRUD helper bound to a collection name
export function collection(name) {
  return {
    all() { return readJSON(name, []); },
    save(list) { writeJSON(name, list); return list; },
    find(pred) { return this.all().find(pred); },
    filter(pred) { return this.all().filter(pred); },
    byId(id) { return this.find(x => x.id === id); },
    upsert(item) {
      const list = this.all();
      const i = list.findIndex(x => x.id === item.id);
      if (i >= 0) list[i] = { ...list[i], ...item };
      else list.push(item);
      this.save(list);
      return i >= 0 ? list[i] : item;
    },
    remove(id) {
      const list = this.all().filter(x => x.id !== id);
      this.save(list);
      return true;
    },
  };
}
