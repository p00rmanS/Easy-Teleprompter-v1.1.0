export type Alignment = "left" | "center" | "right";
export type Theme = "dark" | "light" | "custom";

export type Settings = {
  speed: number;
  wpm: number;
  fontSize: number;
  lineSpacing: number;
  textWidth: number;
  alignment: Alignment;
  countdown: 0 | 3 | 5 | 10;
  theme: Theme;
  backgroundColor: string;
  textColor: string;
  topMargin: number;
  bottomMargin: number;
  focusGuide: boolean;
  hideMarkers: boolean;
  flipHorizontal: boolean;
  flipVertical: boolean;
  extremeSpeed: boolean;
};

export type Preset = {
  id: "training" | "announcement" | "short-form" | "mirror";
  name: string;
  description: string;
  symbol: string;
  values: Partial<Settings>;
};

export type PracticeResult = {
  elapsedMs: number;
  words: number;
  averageWpm: number;
  pauses: number;
  completedAt: number;
};

export const DEFAULT_SETTINGS: Settings = {
  speed: 4,
  wpm: 130,
  fontSize: 58,
  lineSpacing: 1.45,
  textWidth: 78,
  alignment: "left",
  countdown: 3,
  theme: "dark",
  backgroundColor: "#05070b",
  textColor: "#f8fafc",
  topMargin: 16,
  bottomMargin: 18,
  focusGuide: true,
  hideMarkers: false,
  flipHorizontal: false,
  flipVertical: false,
  extremeSpeed: false,
};

export const PRESETS: Preset[] = [
  {
    id: "training",
    name: "Training Video",
    description: "Natural pace with comfortable reading width.",
    symbol: "▤",
    values: { speed: 4, wpm: 130, fontSize: 58, textWidth: 78, alignment: "left", countdown: 3, flipHorizontal: false, flipVertical: false },
  },
  {
    id: "announcement",
    name: "Announcement",
    description: "Slower, larger text for a confident delivery.",
    symbol: "◉",
    values: { speed: 3, wpm: 100, fontSize: 68, textWidth: 72, alignment: "center", countdown: 5, flipHorizontal: false, flipVertical: false },
  },
  {
    id: "short-form",
    name: "Short Reel",
    description: "Quicker pace for short social videos.",
    symbol: "▶",
    values: { speed: 6, wpm: 160, fontSize: 54, textWidth: 82, alignment: "center", countdown: 3, flipHorizontal: false, flipVertical: false },
  },
  {
    id: "mirror",
    name: "Prompter Glass",
    description: "Mirrored text for a physical teleprompter.",
    symbol: "⇄",
    values: { speed: 4, wpm: 130, fontSize: 62, textWidth: 74, alignment: "center", countdown: 5, flipHorizontal: true, flipVertical: false },
  },
];

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const clampProgress = (value: number) => clamp(Number.isFinite(value) ? value : 0, 0, 1);

const NORMAL_SPEED_RANGE = { min: 1, max: 10 };
const EXTREME_SPEED_RANGE = { min: 0.2, max: 25 };

export function speedBounds(extreme: boolean) {
  return extreme ? EXTREME_SPEED_RANGE : NORMAL_SPEED_RANGE;
}

export function toggleExtremeSpeed(settings: Settings, enabled: boolean): Settings {
  const bounds = speedBounds(enabled);
  return { ...settings, extremeSpeed: enabled, speed: clamp(settings.speed, bounds.min, bounds.max) };
}

export function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function speakingSeconds(words: number, wpm: number) {
  if (!words) return 0;
  return Math.max(1, Math.round((words / clamp(wpm, 60, 220)) * 60));
}

export function scrollPixelsPerSecond(speed: number, wpm: number) {
  const base = 10 + clamp(speed, EXTREME_SPEED_RANGE.min, EXTREME_SPEED_RANGE.max) * 7.5;
  return base * (clamp(wpm, 80, 200) / 130);
}

export function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}

export function calculatePracticeResult(words: number, elapsedMs: number, pauses: number, completedAt = Date.now()): PracticeResult {
  const safeElapsed = Math.max(1000, elapsedMs);
  return {
    elapsedMs: safeElapsed,
    words: Math.max(0, words),
    averageWpm: Math.round(Math.max(0, words) / (safeElapsed / 60000)),
    pauses: Math.max(0, Math.round(pauses)),
    completedAt,
  };
}

export function shouldOfferResume(progress: number, savedFingerprint: string, currentFingerprint: string) {
  return savedFingerprint === currentFingerprint && progress >= 0.02 && progress < 0.98;
}

export function scriptFingerprint(title: string, content: string, id?: string | null) {
  let hash = 2166136261;
  const source = `${id ?? "draft"}|${title}|${content}`;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `tp-${(hash >>> 0).toString(16)}`;
}

export function sanitizeSettings(input: unknown): Settings {
  const value = input && typeof input === "object" ? input as Partial<Settings> : {};
  const countdown = [0, 3, 5, 10].includes(Number(value.countdown)) ? Number(value.countdown) as 0 | 3 | 5 | 10 : DEFAULT_SETTINGS.countdown;
  const alignment = ["left", "center", "right"].includes(String(value.alignment)) ? value.alignment as Alignment : DEFAULT_SETTINGS.alignment;
  const theme = ["dark", "light", "custom"].includes(String(value.theme)) ? value.theme as Theme : DEFAULT_SETTINGS.theme;
  const extremeSpeed = typeof value.extremeSpeed === "boolean" ? value.extremeSpeed : DEFAULT_SETTINGS.extremeSpeed;
  const speedRange = speedBounds(extremeSpeed);
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    speed: clamp(Number(value.speed ?? DEFAULT_SETTINGS.speed), speedRange.min, speedRange.max),
    wpm: clamp(Number(value.wpm ?? DEFAULT_SETTINGS.wpm), 80, 200),
    fontSize: clamp(Number(value.fontSize ?? DEFAULT_SETTINGS.fontSize), 28, 120),
    lineSpacing: clamp(Number(value.lineSpacing ?? DEFAULT_SETTINGS.lineSpacing), 1.1, 2.2),
    textWidth: clamp(Number(value.textWidth ?? DEFAULT_SETTINGS.textWidth), 45, 98),
    topMargin: clamp(Number(value.topMargin ?? DEFAULT_SETTINGS.topMargin), 0, 35),
    bottomMargin: clamp(Number(value.bottomMargin ?? DEFAULT_SETTINGS.bottomMargin), 0, 35),
    alignment,
    countdown,
    theme,
    extremeSpeed,
    backgroundColor: /^#[0-9a-f]{6}$/i.test(String(value.backgroundColor)) ? String(value.backgroundColor) : DEFAULT_SETTINGS.backgroundColor,
    textColor: /^#[0-9a-f]{6}$/i.test(String(value.textColor)) ? String(value.textColor) : DEFAULT_SETTINGS.textColor,
    focusGuide: typeof value.focusGuide === "boolean" ? value.focusGuide : DEFAULT_SETTINGS.focusGuide,
    hideMarkers: typeof value.hideMarkers === "boolean" ? value.hideMarkers : DEFAULT_SETTINGS.hideMarkers,
    flipHorizontal: typeof value.flipHorizontal === "boolean" ? value.flipHorizontal : DEFAULT_SETTINGS.flipHorizontal,
    flipVertical: typeof value.flipVertical === "boolean" ? value.flipVertical : DEFAULT_SETTINGS.flipVertical,
  };
}

export function applyPreset(settings: Settings, presetId: Preset["id"]) {
  const preset = PRESETS.find((item) => item.id === presetId);
  return preset ? sanitizeSettings({ ...settings, ...preset.values }) : settings;
}
