import { describe, expect, it } from "vitest";
import { buildBackup, mergeProfiles, mergeScripts, parseBackup, type ScriptRecord } from "./backup";
import { DEFAULT_SETTINGS, profileFromSettings } from "./core";

const script = (id: string, modifiedAt: number, content = "hello"): ScriptRecord => ({ id, title: `Script ${id}`, content, createdAt: 1, modifiedAt });

describe("backup", () => {
  it("round-trips scripts and presenter profiles", () => {
    const profile = profileFromSettings("p1", "Kai", { ...DEFAULT_SETTINGS, speed: 7 }, 5);
    const text = JSON.stringify(buildBackup([script("a", 10)], [profile], 99));
    const parsed = parseBackup(text);
    expect(parsed?.scripts).toEqual([script("a", 10)]);
    expect(parsed?.profiles[0]).toMatchObject({ id: "p1", name: "Kai", speed: 7 });
    expect(parsed?.exportedAt).toBe(99);
  });

  it("rejects files that are not Easy Teleprompter backups", () => {
    expect(parseBackup("not json")).toBeNull();
    expect(parseBackup(JSON.stringify({ scripts: [] }))).toBeNull();
    expect(parseBackup(JSON.stringify({ app: "other", scripts: [] }))).toBeNull();
    expect(parseBackup("null")).toBeNull();
  });

  it("drops malformed and duplicate scripts instead of failing the whole restore", () => {
    const text = JSON.stringify({
      app: "easy-teleprompter",
      scripts: [script("a", 1), { id: "b" }, { id: "a", title: "dup", content: "x" }, null, "junk", { id: "c", title: "T", content: "ok" }],
    });
    expect(parseBackup(text)?.scripts.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("merges by id, keeping the newer edit, and never deletes", () => {
    const existing = [script("a", 10, "local"), script("b", 20)];
    const incoming = [script("a", 30, "from backup"), script("b", 5), script("c", 15)];
    const merged = mergeScripts(existing, incoming);
    expect(merged.added).toBe(1);
    expect(merged.updated).toBe(1);
    expect(merged.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(merged.items.find((item) => item.id === "a")?.content).toBe("from backup");
    expect(merged.items.find((item) => item.id === "b")?.modifiedAt).toBe(20);
  });

  it("merges presenter profiles the same way, sorted by name", () => {
    const old = profileFromSettings("p1", "Zed", DEFAULT_SETTINGS, 1);
    const fresh = profileFromSettings("p1", "Zed", { ...DEFAULT_SETTINGS, speed: 9 }, 2);
    const other = profileFromSettings("p2", "Amy", DEFAULT_SETTINGS, 1);
    const merged = mergeProfiles([old], [fresh, other]);
    expect(merged.items.map((item) => item.name)).toEqual(["Amy", "Zed"]);
    expect(merged.items.find((item) => item.id === "p1")?.speed).toBe(9);
    expect(merged.added).toBe(1);
    expect(merged.updated).toBe(1);
  });
});
