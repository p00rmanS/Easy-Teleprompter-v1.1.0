import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS, applyPreset, calculatePracticeResult, formatDuration,
  sanitizeSettings, scriptFingerprint, scrollPixelsPerSecond,
  shouldOfferResume, speakingSeconds,
} from "./core";

describe("teleprompter core", () => {
  it("calculates a speaking estimate from calibrated WPM", () => {
    expect(speakingSeconds(260, 130)).toBe(120);
    expect(scrollPixelsPerSecond(4, 160)).toBeGreaterThan(scrollPixelsPerSecond(4, 100));
  });

  it("sanitizes damaged settings", () => {
    const value = sanitizeSettings({ speed: 99, wpm: -2, alignment: "sideways" as never, fontSize: 5 });
    expect(value.speed).toBe(10);
    expect(value.wpm).toBe(80);
    expect(value.fontSize).toBe(28);
    expect(value.alignment).toBe(DEFAULT_SETTINGS.alignment);
  });

  it("applies a complete device preset", () => {
    const value = applyPreset(DEFAULT_SETTINGS, "mirror");
    expect(value.flipHorizontal).toBe(true);
    expect(value.textWidth).toBeLessThan(DEFAULT_SETTINGS.textWidth);
  });

  it("offers resume only for a useful matching position", () => {
    expect(shouldOfferResume(.5, "abc", "abc")).toBe(true);
    expect(shouldOfferResume(.01, "abc", "abc")).toBe(false);
    expect(shouldOfferResume(.99, "abc", "abc")).toBe(false);
    expect(shouldOfferResume(.5, "abc", "different")).toBe(false);
  });

  it("summarizes a practice reading", () => {
    expect(calculatePracticeResult(260, 120_000, 3)).toMatchObject({ averageWpm: 130, words: 260, pauses: 3 });
    expect(formatDuration(125_000)).toBe("2m 05s");
  });

  it("fingerprints identical drafts consistently", () => {
    expect(scriptFingerprint("Title", "Hello world", null)).toBe(scriptFingerprint("Title", "Hello world", null));
    expect(scriptFingerprint("Title", "Hello world", null)).not.toBe(scriptFingerprint("Title", "Changed", null));
  });
});
