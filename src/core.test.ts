import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS, applyPreset, calculatePracticeResult, formatDuration,
  sanitizeSettings, scriptFingerprint, scrollPixelsPerSecond,
  shouldOfferResume, speakingSeconds, speedBounds, speedStep, toggleExtremeSpeed,
} from "./core";

describe("teleprompter core", () => {
  it("calculates a speaking estimate from calibrated WPM", () => {
    expect(speakingSeconds(260, 130)).toBe(120);
  });

  it("keeps scroll speed independent of speaking pace (WPM)", () => {
    // Operators shoot different presenters; scroll rate must not be throttled by a WPM estimate.
    expect(scrollPixelsPerSecond(4)).toBeGreaterThan(scrollPixelsPerSecond(2));
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

  it("keeps normal speeds capped at 1-10 unless extreme range is on", () => {
    expect(sanitizeSettings({ speed: 99 }).speed).toBe(10);
    expect(sanitizeSettings({ speed: 999, extremeSpeed: true }).speed).toBe(speedBounds(true).max);
    expect(sanitizeSettings({ speed: 0.05, extremeSpeed: true }).speed).toBe(0.2);
  });

  it("clamps speed back into range when extreme mode is turned off", () => {
    const extreme = { ...DEFAULT_SETTINGS, extremeSpeed: true, speed: 40 };
    expect(toggleExtremeSpeed(extreme, false).speed).toBe(speedBounds(false).max);
    expect(toggleExtremeSpeed(DEFAULT_SETTINGS, true).speed).toBe(DEFAULT_SETTINGS.speed);
  });

  it("scrolls far faster and far slower once the extreme range is unlocked", () => {
    const normalFastest = scrollPixelsPerSecond(speedBounds(false).max);
    const extremeFastest = scrollPixelsPerSecond(speedBounds(true).max);
    const extremeSlowest = scrollPixelsPerSecond(speedBounds(true).min);
    expect(extremeFastest).toBeGreaterThan(normalFastest);
    expect(extremeSlowest).toBeLessThan(scrollPixelsPerSecond(speedBounds(false).min));
  });

  it("gives extreme mode a bigger per-tap step so fewer taps reach the extremes", () => {
    expect(speedStep(true)).toBeGreaterThan(speedStep(false));
  });
});
