import { describe, expect, it } from "vitest";
import { buildCloudPracticeResult } from "./practiceSync";
import type { PracticeResult } from "../core";

describe("buildCloudPracticeResult", () => {
  it("merges a local practice result with sync context, without mutating the input", () => {
    const result: PracticeResult = { elapsedMs: 120000, words: 260, averageWpm: 130, pauses: 2, completedAt: 1700000000000 };
    const ctx = { venueId: "hale-ohana", employeeId: "emp_1", employeeName: "James B.", uid: "uid_1", scriptId: "script_1", scriptTitle: "Welcoming Guests" };
    const cloud = buildCloudPracticeResult(result, ctx);
    expect(cloud).toMatchObject({ ...result, ...ctx });
    expect(result).toEqual({ elapsedMs: 120000, words: 260, averageWpm: 130, pauses: 2, completedAt: 1700000000000 });
  });

  it("carries a null scriptId through for unsaved scripts", () => {
    const result: PracticeResult = { elapsedMs: 60000, words: 100, averageWpm: 100, pauses: 0, completedAt: 1700000000000 };
    const cloud = buildCloudPracticeResult(result, { venueId: "v", employeeId: "e", employeeName: "N", uid: "u", scriptId: null, scriptTitle: "Untitled Script" });
    expect(cloud.scriptId).toBeNull();
  });
});
