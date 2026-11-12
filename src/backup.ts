import { sanitizeProfiles, type Profile } from "./core";

export type ScriptRecord = { id: string; title: string; content: string; createdAt: number; modifiedAt: number };
export type Backup = { app: "easy-teleprompter"; version: 1; exportedAt: number; scripts: ScriptRecord[]; profiles: Profile[] };

const MAX_SCRIPTS = 500;

export function buildBackup(scripts: ScriptRecord[], profiles: Profile[], exportedAt = Date.now()): Backup {
  return { app: "easy-teleprompter", version: 1, exportedAt, scripts, profiles };
}

function sanitizeScripts(input: unknown): ScriptRecord[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const scripts: ScriptRecord[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const value = item as Partial<ScriptRecord>;
    if (typeof value.id !== "string" || !value.id || seen.has(value.id)) continue;
    if (typeof value.title !== "string" || typeof value.content !== "string") continue;
    seen.add(value.id);
    const modifiedAt = Number.isFinite(value.modifiedAt) ? Number(value.modifiedAt) : 0;
    scripts.push({ id: value.id, title: value.title, content: value.content, modifiedAt, createdAt: Number.isFinite(value.createdAt) ? Number(value.createdAt) : modifiedAt });
    if (scripts.length >= MAX_SCRIPTS) break;
  }
  return scripts;
}

/** Parses untrusted backup text. Returns null unless it is a recognizable Easy Teleprompter backup. */
export function parseBackup(text: string): Backup | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<Backup>;
  if (value.app !== "easy-teleprompter" || !Array.isArray(value.scripts)) return null;
  return {
    app: "easy-teleprompter",
    version: 1,
    exportedAt: Number.isFinite(value.exportedAt) ? Number(value.exportedAt) : 0,
    scripts: sanitizeScripts(value.scripts),
    profiles: sanitizeProfiles(value.profiles),
  };
}

type Merge<T> = { items: T[]; added: number; updated: number };

function mergeById<T extends { id: string }>(existing: T[], incoming: T[], stamp: (item: T) => number): Merge<T> {
  const byId = new Map(existing.map((item) => [item.id, item]));
  let added = 0, updated = 0;
  for (const item of incoming) {
    const current = byId.get(item.id);
    if (!current) { byId.set(item.id, item); added += 1; }
    else if (stamp(item) > stamp(current)) { byId.set(item.id, item); updated += 1; }
  }
  return { items: [...byId.values()], added, updated };
}

/** Adds scripts that are new and replaces ones the backup has a newer edit of. Never deletes anything. */
export function mergeScripts(existing: ScriptRecord[], incoming: ScriptRecord[]): Merge<ScriptRecord> {
  const merged = mergeById(existing, incoming, (item) => item.modifiedAt);
  return { ...merged, items: merged.items.sort((a, b) => b.modifiedAt - a.modifiedAt) };
}

export function mergeProfiles(existing: Profile[], incoming: Profile[]): Merge<Profile> {
  const merged = mergeById(existing, incoming, (item) => item.updatedAt);
  return { ...merged, items: merged.items.sort((a, b) => a.name.localeCompare(b.name)) };
}
