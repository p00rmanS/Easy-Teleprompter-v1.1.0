import { describe, expect, it } from "vitest";
import { resultsToCsvBlob, toCsvRows } from "./csv";
import type { CloudPracticeResult } from "../types";

const RESULT_A: CloudPracticeResult = { elapsedMs: 65000, words: 140, averageWpm: 129, pauses: 1, completedAt: 1700000100000, uid: "u1", employeeId: "e1", employeeName: "Alice", venueId: "hale-ohana", scriptId: "s1", scriptTitle: "Welcoming Guests" };
const RESULT_B: CloudPracticeResult = { elapsedMs: 40000, words: 90, averageWpm: 135, pauses: 0, completedAt: 1700000000000, uid: "u2", employeeId: "e2", employeeName: "Bob, Jr.", venueId: "hale-ohana", scriptId: null, scriptTitle: 'Menu "Specials"' };

describe("toCsvRows", () => {
  it("includes a header row and sorts newest first", () => {
    const rows = toCsvRows([RESULT_B, RESULT_A]);
    expect(rows[0]).toEqual(["Employee", "Script", "Completed", "Duration", "Avg WPM", "Pauses"]);
    expect(rows[1][0]).toBe("Alice");
    expect(rows[2][0]).toBe("Bob, Jr.");
  });
});

describe("resultsToCsvBlob", () => {
  it("escapes commas and quotes in fields", async () => {
    const blob = resultsToCsvBlob(toCsvRows([RESULT_B]));
    const text = await blob.text();
    expect(text).toContain('"Bob, Jr."');
    expect(text).toContain('"Menu ""Specials"""');
  });
});
