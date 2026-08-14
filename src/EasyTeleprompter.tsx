"use client";

import {
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_SETTINGS,
  PRESETS,
  applyPreset,
  calculatePracticeResult,
  clamp,
  clampProgress,
  formatDuration,
  sanitizeSettings,
  scriptFingerprint,
  scrollPixelsPerSecond,
  shouldOfferResume,
  speakingSeconds,
  speedBounds,
  toggleExtremeSpeed,
  wordCount,
  type Alignment,
  type PracticeResult,
  type Settings,
  type Theme,
} from "./core";

type Script = { id: string; title: string; content: string; createdAt: number; modifiedAt: number };
type SavedPosition = { fingerprint: string; progress: number; updatedAt: number };
type Confirm = { title: string; message: string; label: string; destructive?: boolean } | null;
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechEvent = Event & { resultIndex: number; results: ArrayLike<SpeechResult> };
type Recognition = EventTarget & {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((event: SpeechEvent) => void) | null; onend: (() => void) | null;
  onerror: ((event: Event) => void) | null; start(): void; stop(): void; abort(): void;
};
type RecognitionConstructor = new () => Recognition;

declare global { interface Window { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor } }

const STORE = {
  draft: "easy-teleprompter:draft:v1", settings: "easy-teleprompter:settings:v1",
  scripts: "easy-teleprompter:scripts:v1", tutorial: "easy-teleprompter:tutorial:v1",
  position: "easy-teleprompter:position:v1", results: "easy-teleprompter:practice-results:v1",
};
const SAMPLE_TITLE = "Welcoming Guests with Aloha";
const SAMPLE = `Aloha and welcome to Hale ʻOhana.

[SMILE] My name is James, and I will be taking care of your table this evening.

[EMPHASIS] Every great guest experience begins with a warm welcome.

Before visiting the buffet, please review the menu and allergy information at your table. [PAUSE]

[B-ROLL] Show the beverage menu and a server preparing drinks.

If you need anything during your visit, please let any member of our team know. [3 SEC]

Mahalo, and enjoy your evening with us.`;
const MARKERS = /(\[(?:PAUSE|SMILE|B-ROLL|EMPHASIS|3 SEC)\])/gi;
const MARKER_OPTIONS = ["PAUSE", "SMILE", "B-ROLL", "EMPHASIS", "3 SEC"] as const;

const makeId = () => crypto?.randomUUID?.() ?? `script-${Date.now()}-${Math.random().toString(16).slice(2)}`;
function speakTime(words: number, wpm: number) {
  const seconds = speakingSeconds(words, wpm);
  if (!seconds) return "0 min";
  return seconds >= 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60} sec` : `${seconds} sec`;
}
function dateLabel(timestamp: number) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(timestamp); }
function pace(speed: number) {
  if (speed <= 0.75) return "Very Slow";
  if (speed <= 2.5) return "Relaxed";
  if (speed <= 5) return "Natural";
  if (speed <= 7.5) return "Quick";
  if (speed <= 10) return "Fast";
  if (speed <= 17) return "Very Fast";
  return "Super Fast";
}

function Icon({ symbol, children }: { symbol: string; children: ReactNode }) {
  return <span className="icon-label"><span className="button-icon" aria-hidden="true">{symbol}</span><span>{children}</span></span>;
}
function Modal({ title, onClose, children, wide = false }: { title: string; onClose(): void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const fn = (event: KeyboardEvent) => event.key === "Escape" && onClose(); window.addEventListener("keydown", fn); return () => window.removeEventListener("keydown", fn); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`modal-card ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="modal-header"><h2 id="dialog-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog">×</button></div>
      {children}
    </section>
  </div>;
}
function Range({ label, value, min, max, step = 1, display, onChange }: { label: string; value: number; min: number; max: number; step?: number; display: string; onChange(value: number): void }) {
  return <label className="range-control"><span><span>{label}</span><strong>{display}</strong></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
function Toggle({ label, hint, checked, disabled = false, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange(value: boolean): void }) {
  return <label className={`toggle-row ${disabled ? "disabled" : ""}`}><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true"><b /></i></label>;
}

function Tutorial({ onClose, onSample }: { onClose(): void; onSample(): void }) {
  const steps = [["1", "Paste your script", "Type, paste, or import a text file."], ["2", "Choose your pace", "Set a comfortable speed and text size."], ["3", "Press Start", "Use the countdown to get camera-ready."], ["4", "Tap to pause", "Tap anywhere while reading to pause or resume."]];
  return <Modal title="You’re ready in four steps" onClose={onClose}>
    <div className="tutorial-steps">{steps.map(([n, title, detail]) => <div className="tutorial-step" key={n}><span>{n}</span><div><strong>{title}</strong><p>{detail}</p></div></div>)}</div>
    <div className="modal-actions"><button className="button secondary" onClick={onSample}><Icon symbol="▶">Try Sample Script</Icon></button><button className="button primary" onClick={onClose}>Got it</button></div>
  </Modal>;
}

function Library({ scripts, onOpen, onDuplicate, onRename, onDelete, onClose }: { scripts: Script[]; onOpen(item: Script): void; onDuplicate(item: Script): void; onRename(item: Script): void; onDelete(item: Script): void; onClose(): void }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const visible = useMemo(() => scripts.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "oldest" ? a.modifiedAt - b.modifiedAt : sort === "title" ? a.title.localeCompare(b.title) : b.modifiedAt - a.modifiedAt), [query, scripts, sort]);
  return <Modal title="Saved Scripts" onClose={onClose} wide>
    <div className="library-toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Search scripts" placeholder="Search scripts" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="sort-field"><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="title">Title</option></select></label></div>
    {visible.length ? <div className="script-list">{visible.map((item) => <article className="script-item" key={item.id}><button className="script-open" onClick={() => onOpen(item)}><span aria-hidden="true">≡</span><span><strong>{item.title}</strong><small>Modified {dateLabel(item.modifiedAt)}</small></span></button><div><button onClick={() => onOpen(item)}>Open</button><button onClick={() => onDuplicate(item)}>Duplicate</button><button onClick={() => onRename(item)}>Rename</button><button className="danger-text" onClick={() => onDelete(item)}>Delete</button></div></article>)}</div> : <div className="empty-state"><span>▤</span><h3>{scripts.length ? "No matching scripts" : "No saved scripts yet"}</h3><p>{scripts.length ? "Try a different search." : "Save your first script and it will appear here."}</p></div>}
  </Modal>;
}

function promptNodes(text: string, hide: boolean) {
  let emphasis = false;
  return text.split(MARKERS).flatMap((part, index): ReactNode[] => {
    if (!part) return [];
    const upper = part.toUpperCase();
    const isMarker = /^\[(?:PAUSE|SMILE|B-ROLL|EMPHASIS|3 SEC)\]$/i.test(part);
    if (isMarker) {
      if (upper === "[EMPHASIS]") emphasis = true;
      const seconds = upper === "[PAUSE]" ? 1.5 : upper === "[3 SEC]" ? 3 : 0;
      const name = upper.slice(1, -1);
      return [<span key={`m${index}`} className={`prompt-marker marker-${name.toLowerCase().replace(" ", "-")} ${hide ? "marker-hidden" : ""}`} data-pause-seconds={seconds || undefined} data-marker-name={name}>{hide ? "\u200b" : upper}</span>];
    }
    if (emphasis) {
      const match = part.match(/^([\s\S]*?[.!?](?:\s|$)|[\s\S]+)/);
      if (match) { emphasis = false; return [<span className="prompt-emphasis" key={`e${index}`}>{match[1]}</span>, <span key={`t${index}`}>{part.slice(match[1].length)}</span>]; }
    }
    return [<span key={`t${index}`}>{part}</span>];
  });
}

function Teleprompter({ title, script, settings, setSettings, initialProgress, onProgress, onFinish, onExit, notify }: { title: string; script: string; settings: Settings; setSettings: React.Dispatch<React.SetStateAction<Settings>>; initialProgress: number; onProgress(progress: number): void; onFinish(result: PracticeResult): void; onExit(): void; notify(message: string): void }) {
  const surface = useRef<HTMLDivElement>(null), scroller = useRef<HTMLDivElement>(null), promptContent = useRef<HTMLDivElement>(null);
  const recognition = useRef<Recognition | null>(null), animation = useRef<number | null>(null);
  const wakeLock = useRef<{ release(): Promise<void> } | null>(null), lastFrame = useRef<number | null>(null);
  const progressRef = useRef(clampProgress(initialProgress)), scrollY = useRef(0), speechChar = useRef(0), pauseUntil = useRef(0);
  const sessionStarted = useRef(0), pauseCount = useRef(0), lastSavedProgress = useRef(0);
  const triggered = useRef(new Set<string>()), playingRef = useRef(false), voiceRef = useRef(false);
  const voiceFailures = useRef(0);
  const touch = useRef({ y: 0, distance: null as number | null, font: settings.fontSize });
  const [playing, setPlaying] = useState(false), [countdown, setCountdown] = useState<number | null>(settings.countdown || null);
  const [settingsOpen, setSettingsOpen] = useState(false), [hidden, setHidden] = useState(false);
  const [markerPause, setMarkerPause] = useState<string | null>(null), [progress, setProgress] = useState(clampProgress(initialProgress));
  const [speechSupported, setSpeechSupported] = useState(false), [voice, setVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const set = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value })), [setSettings]);
  const mirror = `${settings.flipHorizontal ? "scaleX(-1)" : ""} ${settings.flipVertical ? "scaleY(-1)" : ""}`.trim();
  const applyPosition = useCallback((position: number) => {
    if (promptContent.current) promptContent.current.style.transform = `translate3d(0, ${-position}px, 0) ${mirror}`;
  }, [mirror]);

  const acquireLock = useCallback(async () => {
    const nav = navigator as Navigator & { wakeLock?: { request(kind: "screen"): Promise<{ release(): Promise<void> }> } };
    if (!nav.wakeLock || wakeLock.current) return;
    try { wakeLock.current = await nav.wakeLock.request("screen"); } catch { /* Optional. */ }
  }, []);
  const releaseLock = useCallback(async () => { try { await wakeLock.current?.release(); } catch { /* Already released. */ } wakeLock.current = null; }, []);
  const begin = useCallback(() => { setPlaying(false); if (settings.countdown) setCountdown(settings.countdown); else { setCountdown(null); setPlaying(true); } }, [settings.countdown]);
  const restart = useCallback(() => { scrollY.current = 0; applyPosition(0); progressRef.current = 0; lastSavedProgress.current = 0; setProgress(0); speechChar.current = 0; sessionStarted.current = 0; pauseCount.current = 0; triggered.current.clear(); pauseUntil.current = 0; setMarkerPause(null); onProgress(0); begin(); }, [applyPosition, begin, onProgress]);

  const beginRef = useRef(begin);
  beginRef.current = begin;
  useEffect(() => {
    setSpeechSupported(Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition));
    beginRef.current();
    return () => { recognition.current?.abort(); releaseLock(); };
    // Mount-only: must not re-run when `begin` changes identity (e.g. countdown setting edited mid-session).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (countdown === null) return; if (countdown <= 0) { setCountdown(null); setPlaying(true); return; } const timer = window.setTimeout(() => setCountdown((value) => value === null ? null : value - 1), 1000); return () => clearTimeout(timer); }, [countdown]);
  useEffect(() => { playingRef.current = playing; voiceRef.current = voice; if (playing && !sessionStarted.current) sessionStarted.current = Date.now(); playing ? acquireLock() : releaseLock(); }, [playing, voice, acquireLock, releaseLock]);
  useEffect(() => { const fn = () => document.visibilityState === "visible" && playingRef.current && acquireLock(); document.addEventListener("visibilitychange", fn); return () => document.removeEventListener("visibilitychange", fn); }, [acquireLock]);
  useEffect(() => { const box = scroller.current, text = promptContent.current; if (!box || !text) return; const frame = requestAnimationFrame(() => { scrollY.current = progressRef.current * Math.max(1, text.scrollHeight - box.clientHeight); applyPosition(scrollY.current); }); return () => cancelAnimationFrame(frame); }, [settings.fontSize, settings.lineSpacing, settings.textWidth, settings.alignment, settings.flipHorizontal, settings.flipVertical, applyPosition]);

  useEffect(() => {
    const box = scroller.current, text = promptContent.current; if (!box || !text || !playing || voice) return;
    lastFrame.current = null; let lastUpdate = 0;
    const loop = (time: number) => {
      if (!lastFrame.current) lastFrame.current = time;
      const delta = Math.min(50, time - lastFrame.current); lastFrame.current = time;
      const focus = scrollY.current + box.clientHeight / 2;
      text.querySelectorAll<HTMLElement>("[data-pause-seconds]").forEach((marker, index) => {
        const key = `${index}-${marker.dataset.markerName}`, seconds = Number(marker.dataset.pauseSeconds || 0);
        if (seconds && marker.offsetTop <= focus && !triggered.current.has(key)) {
          triggered.current.add(key); pauseUntil.current = Date.now() + seconds * 1000;
          pauseCount.current += 1;
          setMarkerPause(seconds === 3 ? "3 second pause" : "Brief pause");
          setTimeout(() => setMarkerPause(null), seconds * 1000);
        }
      });
      const max = Math.max(1, text.scrollHeight - box.clientHeight);
      if (Date.now() >= pauseUntil.current) scrollY.current = Math.min(max, scrollY.current + scrollPixelsPerSecond(settings.speed, settings.wpm) * delta / 1000);
      applyPosition(scrollY.current);
      progressRef.current = Math.min(1, scrollY.current / max);
      if (time - lastUpdate > 180) {
        setProgress(progressRef.current);
        if (Math.abs(progressRef.current - lastSavedProgress.current) >= 0.005) { onProgress(progressRef.current); lastSavedProgress.current = progressRef.current; }
        lastUpdate = time;
      }
      if (scrollY.current >= max - 2) {
        setPlaying(false); setProgress(1); onProgress(1);
        onFinish(calculatePracticeResult(wordCount(script), Date.now() - (sessionStarted.current || Date.now()), pauseCount.current));
        return;
      }
      animation.current = requestAnimationFrame(loop);
    };
    animation.current = requestAnimationFrame(loop);
    return () => { if (animation.current) cancelAnimationFrame(animation.current); animation.current = null; };
  }, [playing, voice, settings.speed, settings.wpm, script, onFinish, onProgress, applyPosition]);

  const startRecognition = useCallback(() => {
    const Constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition; if (!Constructor) return;
    voiceFailures.current = 0;
    recognition.current?.abort(); const mic = new Constructor(); recognition.current = mic;
    mic.continuous = true; mic.interimResults = true; mic.lang = "en-US";
    mic.onresult = (event) => {
      let spoken = ""; for (let i = event.resultIndex; i < event.results.length; i++) spoken += ` ${event.results[i][0].transcript}`;
      const words = spoken.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
      const clean = script.replace(MARKERS, " ").toLowerCase().replace(/[^a-z0-9'\s]/g, " "); let found = -1;
      for (let count = Math.min(7, words.length); count >= 2; count--) { const phrase = words.slice(-count).join(" "), start = Math.max(0, speechChar.current - 220), local = clean.slice(start).indexOf(phrase); if (local >= 0) { found = start + local + phrase.length; break; } }
      if (found >= 0) { voiceFailures.current = 0; speechChar.current = Math.max(speechChar.current, found); const ratio = Math.min(1, found / Math.max(1, clean.length)); progressRef.current = ratio; setProgress(ratio); const box = scroller.current, text = promptContent.current; if (box && text) { scrollY.current = ratio * Math.max(1, text.scrollHeight - box.clientHeight); applyPosition(scrollY.current); } }
    };
    mic.onerror = () => { voiceFailures.current += 1; setVoiceError("Voice following paused. Check microphone permission, or use automatic scrolling."); };
    mic.onend = () => {
      if (!voiceRef.current || !playingRef.current) return;
      if (voiceFailures.current >= 3) {
        setVoice(false);
        setVoiceError("Voice following stopped after repeated microphone errors. Automatic scrolling is on.");
        return;
      }
      setTimeout(() => { try { mic.start(); } catch { voiceFailures.current += 1; } }, 250);
    };
    try { mic.start(); setVoiceError(null); } catch { voiceFailures.current += 1; setVoiceError("The microphone could not start. Automatic scrolling is still available."); }
  }, [script, applyPosition]);
  useEffect(() => { if (voice && playing) startRecognition(); else recognition.current?.stop(); }, [voice, playing, startRecognition]);

  const toggleVoice = (enabled: boolean) => { if (enabled && !speechSupported) return; setVoice(enabled); setPlaying(true); setCountdown(null); setVoiceError(null); notify(enabled ? "Follow My Voice is listening." : "Automatic scrolling is on."); };
  const togglePlay = useCallback(() => countdown === null && setPlaying((current) => { if (current) pauseCount.current += 1; return !current; }), [countdown]);
  const changeSpeed = useCallback((delta: number) => { const bounds = speedBounds(settings.extremeSpeed); set("speed", clamp(Math.round((settings.speed + delta) * 10) / 10, bounds.min, bounds.max)); }, [set, settings.speed, settings.extremeSpeed]);
  const jumpSpeed = useCallback((edge: "min" | "max") => { const bounds = speedBounds(settings.extremeSpeed); set("speed", edge === "min" ? bounds.min : bounds.max); }, [set, settings.extremeSpeed]);
  const changeText = useCallback((delta: number) => set("fontSize", Math.min(120, Math.max(28, settings.fontSize + delta))), [set, settings.fontSize]);
  const seek = useCallback((seconds: number) => { const box = scroller.current, text = promptContent.current; if (!box || !text) return; const max = Math.max(1, text.scrollHeight - box.clientHeight); scrollY.current = Math.max(0, Math.min(max, scrollY.current + scrollPixelsPerSecond(settings.speed, settings.wpm) * seconds)); applyPosition(scrollY.current); progressRef.current = scrollY.current / max; setProgress(progressRef.current); onProgress(progressRef.current); }, [settings.speed, settings.wpm, onProgress, applyPosition]);
  const fullscreen = useCallback(async () => {
    const element = surface.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (element?.requestFullscreen) await element.requestFullscreen(); else if (element?.webkitRequestFullscreen) element.webkitRequestFullscreen(); else notify("Full screen is unavailable here. The teleprompter still works normally."); } catch { notify("Full screen could not start. Try your browser’s full-screen control."); }
  }, [notify]);
  const exit = useCallback(() => { recognition.current?.abort(); releaseLock(); onProgress(progressRef.current); document.fullscreenElement && document.exitFullscreen().catch(() => undefined); onExit(); }, [onExit, onProgress, releaseLock]);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("input,select,textarea")) return;
      const key = event.key.toLowerCase();
      if (event.code === "Space" || key === " " || key === "spacebar") { event.preventDefault(); togglePlay(); }
      else if (event.key === "ArrowUp") { event.preventDefault(); changeSpeed(.5); }
      else if (event.key === "ArrowDown") { event.preventDefault(); changeSpeed(-.5); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); seek(-5); }
      else if (event.key === "ArrowRight") { event.preventDefault(); seek(5); }
      else if (key === "r") restart(); else if (key === "f") fullscreen(); else if (key === "h") setHidden((value) => !value); else if (event.key === "Escape") exit();
    };
    window.addEventListener("keydown", keys); return () => window.removeEventListener("keydown", keys);
  }, [togglePlay, changeSpeed, seek, restart, fullscreen, exit]);

  const distance = (touches: ReactTouchEvent<HTMLDivElement>["touches"]) => touches.length < 2 ? null : Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  const touchStart = (event: ReactTouchEvent<HTMLDivElement>) => { touch.current = { y: event.touches[0]?.clientY ?? 0, distance: distance(event.touches), font: settings.fontSize }; };
  const touchMove = (event: ReactTouchEvent<HTMLDivElement>) => { if (event.touches.length === 2 && touch.current.distance) { const next = distance(event.touches); if (next) { event.preventDefault(); set("fontSize", Math.min(120, Math.max(28, Math.round(touch.current.font + (next - touch.current.distance) / 6)))); } } };
  const touchEnd = (event: ReactTouchEvent<HTMLDivElement>) => { if (event.changedTouches.length !== 1 || touch.current.distance) return; const delta = touch.current.y - event.changedTouches[0].clientY; if (Math.abs(delta) > 45) changeSpeed(delta > 0 ? .5 : -.5); };
  const style = { "--prompt-bg": settings.backgroundColor, "--prompt-color": settings.textColor, "--prompt-size": `${settings.fontSize}px`, "--prompt-leading": settings.lineSpacing, "--prompt-width": `${settings.textWidth}%`, "--prompt-align": settings.alignment, "--top-margin": `${settings.topMargin}vh`, "--bottom-margin": `${settings.bottomMargin}vh` } as CSSProperties;

  return <div ref={surface} className="teleprompter" style={style} onClick={(event) => !(event.target as HTMLElement).closest("button,input,select,label,.settings-sheet") && togglePlay()} onTouchStart={touchStart} onTouchMove={touchMove} onTouchEnd={touchEnd}>
    <div className="prompt-scroller" ref={scroller}><div className="prompt-content" ref={promptContent}>{promptNodes(script, settings.hideMarkers)}</div></div>
    <div className="reading-margin top" /><div className="reading-margin bottom" />
    {settings.focusGuide && <div className="focus-guide"><span /><span /></div>}
    <div className="progress"><span style={{ width: `${progress * 100}%` }} /></div>
    {countdown !== null && <div className="countdown"><span>Get ready</span><strong>{countdown || "Go"}</strong></div>}
    {markerPause && <div className="pause-toast">{markerPause}</div>}
    {!hidden ? <>
      <header className="prompt-topbar"><button className="glass-button" onClick={exit}><Icon symbol="←">Exit</Icon></button><div className="prompt-title"><strong>{title || "Untitled Script"}</strong><span className={playing ? "playing" : ""}>{voice && playing ? "Listening" : playing ? "Scrolling" : countdown !== null ? "Countdown" : "Paused"}</span></div><div><button className="glass-button optional" onClick={restart}><Icon symbol="↻">Restart</Icon></button><button className="glass-button optional" onClick={fullscreen}><Icon symbol="⛶">Full Screen</Icon></button><button className="glass-button" onClick={() => setHidden(true)}><Icon symbol="◉">Hide</Icon></button></div></header>
      <div className="control-dock"><div className="control-group"><button className="speed-jump" onClick={() => jumpSpeed("min")} aria-label="Jump to slowest speed">«</button><button onClick={() => changeSpeed(-.5)} aria-label="Decrease scroll speed">−</button><span><small>Speed</small><strong>{settings.speed.toFixed(1)}</strong></span><button onClick={() => changeSpeed(.5)} aria-label="Increase scroll speed">+</button><button className="speed-jump" onClick={() => jumpSpeed("max")} aria-label="Jump to fastest speed">»</button></div><button className="play-button" onClick={togglePlay} disabled={countdown !== null}><span>{playing ? "Ⅱ" : "▶"}</span>{playing ? "Pause" : "Start / Resume"}</button><div className="control-group size-control"><button onClick={() => changeText(-4)}>A−</button><span><small>Text</small><strong>{settings.fontSize}</strong></span><button onClick={() => changeText(4)}>A+</button></div><button className="glass-button settings-button" onClick={() => setSettingsOpen((value) => !value)}><Icon symbol="⚙">Settings</Icon></button></div>
      {settingsOpen && <section className="settings-sheet"><div className="settings-header"><div><span className="eyebrow">Reading controls</span><h2>Teleprompter Settings</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)}>×</button></div>
        <div className="settings-grid"><Range label="Scroll speed" value={settings.speed} min={speedBounds(settings.extremeSpeed).min} max={speedBounds(settings.extremeSpeed).max} step={settings.extremeSpeed ? .1 : .5} display={`${settings.speed.toFixed(1)} · ${pace(settings.speed)}`} onChange={(value) => set("speed", value)} /><Range label="Speaking pace" value={settings.wpm} min={80} max={200} step={5} display={`${settings.wpm} WPM`} onChange={(value) => set("wpm", value)} /><Range label="Text size" value={settings.fontSize} min={28} max={120} step={2} display={`${settings.fontSize}px`} onChange={(value) => set("fontSize", value)} /><Range label="Line spacing" value={settings.lineSpacing} min={1.1} max={2.2} step={.05} display={settings.lineSpacing.toFixed(2)} onChange={(value) => set("lineSpacing", value)} /><Range label="Text width" value={settings.textWidth} min={45} max={98} display={`${settings.textWidth}%`} onChange={(value) => set("textWidth", value)} /><Range label="Top reading margin" value={settings.topMargin} min={0} max={35} display={`${settings.topMargin}%`} onChange={(value) => set("topMargin", value)} /><Range label="Bottom reading margin" value={settings.bottomMargin} min={0} max={35} display={`${settings.bottomMargin}%`} onChange={(value) => set("bottomMargin", value)} /></div>
        <div className="settings-options"><label><span>Text alignment</span><select value={settings.alignment} onChange={(event) => set("alignment", event.target.value as Alignment)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label><span>Countdown</span><select value={settings.countdown} onChange={(event) => set("countdown", Number(event.target.value) as 0 | 3 | 5 | 10)}><option value={0}>Off</option><option value={3}>3 seconds</option><option value={5}>5 seconds</option><option value={10}>10 seconds</option></select></label><div className="theme-control"><span>Display theme</span><div><button className={settings.theme === "dark" ? "active" : ""} onClick={() => setSettings((current) => ({ ...current, theme: "dark", backgroundColor: "#05070b", textColor: "#f8fafc" }))}>Dark</button><button className={settings.theme === "light" ? "active" : ""} onClick={() => setSettings((current) => ({ ...current, theme: "light", backgroundColor: "#ffffff", textColor: "#101828" }))}>Light</button><button className={settings.theme === "custom" ? "active" : ""} onClick={() => set("theme", "custom")}>Custom</button></div></div><div className="colors"><label><span>Background</span><input type="color" value={settings.backgroundColor} onChange={(event) => setSettings((current) => ({ ...current, theme: "custom", backgroundColor: event.target.value }))} /></label><label><span>Text</span><input type="color" value={settings.textColor} onChange={(event) => setSettings((current) => ({ ...current, theme: "custom", textColor: event.target.value }))} /></label></div></div>
        <div className="toggle-grid"><Toggle label="Extreme speed range" hint="Unlocks very slow and super fast scrolling" checked={settings.extremeSpeed} onChange={(value) => setSettings((current) => toggleExtremeSpeed(current, value))} /><Toggle label="Center reading guide" checked={settings.focusGuide} onChange={(value) => set("focusGuide", value)} /><Toggle label="Hide production markers" checked={settings.hideMarkers} onChange={(value) => set("hideMarkers", value)} /><Toggle label="Flip horizontally" hint="For teleprompter glass" checked={settings.flipHorizontal} onChange={(value) => set("flipHorizontal", value)} /><Toggle label="Flip vertically" checked={settings.flipVertical} onChange={(value) => set("flipVertical", value)} /><Toggle label="Follow My Voice" hint={speechSupported ? "Experimental · uses your browser microphone" : "Unsupported in this browser"} checked={voice} disabled={!speechSupported} onChange={toggleVoice} /></div>
        {voiceError && <p className="inline-alert">{voiceError}</p>}<p className="shortcuts"><strong>Keyboard:</strong> Space pause · ↑/↓ speed · ←/→ five seconds · R restart · F full screen · Esc exit</p>
      </section>}
    </> : <button className="show-controls glass-button" onClick={() => setHidden(false)}><Icon symbol="◉">Show controls</Icon></button>}
  </div>;
}

export default function EasyTeleprompter() {
  const [title, setTitle] = useState(""), [content, setContent] = useState(""), [currentId, setCurrentId] = useState<string | null>(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS), [scripts, setScripts] = useState<Script[]>([]);
  const [prompt, setPrompt] = useState(false), [tutorial, setTutorial] = useState(false), [library, setLibrary] = useState(false), [installHelp, setInstallHelp] = useState(false);
  const [rename, setRename] = useState<Script | null>(null), [renameValue, setRenameValue] = useState(""), [confirm, setConfirm] = useState<Confirm>(null), [toast, setToast] = useState<string | null>(null);
  const [ready, setReady] = useState(false), [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [initialProgress, setInitialProgress] = useState(0), [resumePosition, setResumePosition] = useState<SavedPosition | null>(null);
  const [practiceResult, setPracticeResult] = useState<PracticeResult | null>(null), [recentResults, setRecentResults] = useState<PracticeResult[]>([]);
  const [storageWarning, setStorageWarning] = useState<string | null>(null), [storageUsage, setStorageUsage] = useState<string>("Checking…");
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);
  const confirmAction = useRef<(() => void) | null>(null), fileInput = useRef<HTMLInputElement>(null), scriptEditor = useRef<HTMLTextAreaElement>(null);
  const reloadingForUpdate = useRef(false);
  const notify = useCallback((message: string) => { setToast(message); setTimeout(() => setToast((value) => value === message ? null : value), 2800); }, []);

  const safelySave = useCallback((key: string, value: unknown) => {
    try { localStorage.setItem(key, JSON.stringify(value)); setStorageWarning(null); return true; }
    catch (error) {
      const full = error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
      setStorageWarning(full ? "Device storage is full. Export or delete older scripts before continuing." : "This browser blocked local saving. Your current script remains open, but may not survive a refresh.");
      return false;
    }
  }, []);

  const refreshStorage = useCallback(async () => {
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (!estimate?.quota) return setStorageUsage("Available");
      const used = estimate.usage ?? 0, percent = Math.round((used / estimate.quota) * 100);
      setStorageUsage(`${(used / 1024 / 1024).toFixed(1)} MB used · ${percent}%`);
      if (percent >= 90) setStorageWarning("Device storage is almost full. Export or delete older scripts soon.");
    } catch { setStorageUsage("Available"); }
  }, []);

  useEffect(() => {
    let recovered = false;
    const read = <T,>(key: string, fallback: T): T => {
      const raw = localStorage.getItem(key); if (!raw) return fallback;
      try { return JSON.parse(raw) as T; } catch { recovered = true; return fallback; }
    };
    const draft = read<{ title?: string; content?: string; currentId?: string | null }>(STORE.draft, {});
    setTitle(draft.title ?? ""); setContent(draft.content ?? ""); setCurrentId(draft.currentId ?? null);
    setSettings(sanitizeSettings(read<Partial<Settings>>(STORE.settings, {})));
    const saved = read<Script[]>(STORE.scripts, []); setScripts(Array.isArray(saved) ? saved.filter((item) => item && typeof item.content === "string") : []);
    const results = read<PracticeResult[]>(STORE.results, []); setRecentResults(Array.isArray(results) ? results.slice(0, 10) : []);
    if (recovered) setStorageWarning("Damaged saved settings were safely reset. Your app can continue normally.");
    setTutorial(localStorage.getItem(STORE.tutorial) !== "dismissed"); setReady(true);
    refreshStorage();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").then((registration) => {
        const watch = (worker: ServiceWorker | null) => worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateWorker(worker);
        });
        if (registration.waiting && navigator.serviceWorker.controller) setUpdateWorker(registration.waiting);
        watch(registration.installing);
        registration.addEventListener("updatefound", () => watch(registration.installing));
        registration.update().catch(() => undefined);
      }).catch(() => undefined);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!reloadingForUpdate.current) { reloadingForUpdate.current = true; window.location.reload(); }
      });
    }
    const event = (value: Event) => { value.preventDefault(); setInstallPrompt(value); }; window.addEventListener("beforeinstallprompt", event); return () => window.removeEventListener("beforeinstallprompt", event);
  }, [refreshStorage]);
  useEffect(() => { if (ready) safelySave(STORE.draft, { title, content, currentId }); }, [ready, title, content, currentId, safelySave]);
  useEffect(() => { if (ready) safelySave(STORE.settings, settings); }, [ready, settings, safelySave]);
  useEffect(() => { if (ready) { safelySave(STORE.scripts, scripts); refreshStorage(); } }, [ready, scripts, safelySave, refreshStorage]);

  const words = useMemo(() => wordCount(content), [content]);
  const fingerprint = useMemo(() => scriptFingerprint(title, content, currentId), [title, content, currentId]);
  const dismissTutorial = () => { localStorage.setItem(STORE.tutorial, "dismissed"); setTutorial(false); };
  const sample = () => { setTitle(SAMPLE_TITLE); setContent(SAMPLE); setCurrentId(null); dismissTutorial(); notify("Sample script loaded. Press Start when you’re ready."); };
  const ask = (state: Exclude<Confirm, null>, action: () => void) => { confirmAction.current = action; setConfirm(state); };
  const clearNow = () => { setTitle(""); setContent(""); setCurrentId(null); notify("New script ready."); };
  const newScript = () => title.trim() || content.trim() ? ask({ title: "Start a new script?", message: "Your current draft will be cleared. Save it first if you want it in your library.", label: "New Script", destructive: true }, clearNow) : clearNow();
  const clear = () => ask({ title: "Clear this script?", message: "The title and script text will be removed from the editor.", label: "Clear Script", destructive: true }, () => { setTitle(""); setContent(""); setCurrentId(null); notify("Script cleared."); });
  const save = () => {
    if (!content.trim()) return notify("Add some script text before saving.");
    const now = Date.now(), clean = title.trim() || "Untitled Script", existing = currentId && scripts.find((item) => item.id === currentId);
    if (existing) { setScripts((items) => items.map((item) => item.id === currentId ? { ...item, title: clean, content, modifiedAt: now } : item)); setTitle(clean); notify("Script updated."); }
    else { const item = { id: makeId(), title: clean, content, createdAt: now, modifiedAt: now }; setScripts((items) => [item, ...items]); setCurrentId(item.id); setTitle(clean); notify("Script saved on this device."); }
  };
  const open = (item: Script) => { setTitle(item.title); setContent(item.content); setCurrentId(item.id); setLibrary(false); notify(`Opened “${item.title}”.`); };
  const duplicate = (item: Script) => { const now = Date.now(); setScripts((items) => [{ ...item, id: makeId(), title: `${item.title} (Copy)`, createdAt: now, modifiedAt: now }, ...items]); notify("Script duplicated."); };
  const renameScript = () => { if (!rename || !renameValue.trim()) return; const clean = renameValue.trim(); setScripts((items) => items.map((item) => item.id === rename.id ? { ...item, title: clean, modifiedAt: Date.now() } : item)); if (currentId === rename.id) setTitle(clean); setRename(null); notify("Script renamed."); };
  const deleteScript = (item: Script) => ask({ title: `Delete “${item.title}”?`, message: "This removes the saved copy from this device. This action cannot be undone.", label: "Delete", destructive: true }, () => { setScripts((items) => items.filter((value) => value.id !== item.id)); if (currentId === item.id) setCurrentId(null); notify("Saved script deleted."); });
  const paste = async () => { if (!navigator.clipboard?.readText) return notify("Clipboard access is unavailable. Press and hold in the script box, then choose Paste."); try { const text = await navigator.clipboard.readText(); text ? (setContent((value) => value ? `${value}\n${text}` : text), notify("Text pasted.")) : notify("Your clipboard is empty."); } catch { notify("Clipboard permission was blocked. Press and hold in the script box to paste."); } };
  const importTxt = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (!file.name.toLowerCase().endsWith(".txt") && file.type && file.type !== "text/plain") return notify("Please choose a .txt file."); try { setContent(await file.text()); setTitle(file.name.replace(/\.txt$/i, "")); setCurrentId(null); notify("Text file imported."); } catch { notify("That file could not be read."); } };
  const exportTxt = () => { if (!content.trim()) return notify("There is no script to export."); const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" })), link = document.createElement("a"); link.href = url; link.download = `${(title.trim() || "teleprompter-script").replace(/[\\/:*?\"<>|]+/g, "-")}.txt`; link.click(); URL.revokeObjectURL(url); notify("Script exported."); };
  const insertMarker = (marker: (typeof MARKER_OPTIONS)[number]) => {
    const tag = `[${marker}]`, editor = scriptEditor.current;
    const start = editor?.selectionStart ?? content.length, end = editor?.selectionEnd ?? content.length;
    const before = content.slice(0, start), after = content.slice(end);
    const leading = before && !/\s$/.test(before) ? " " : "", trailing = !/^\s/.test(after) ? " " : "";
    const insert = `${leading}${tag}${trailing}`;
    setContent(`${before}${insert}${after}`);
    const cursor = before.length + insert.length;
    setTimeout(() => { editor?.focus(); editor?.setSelectionRange(cursor, cursor); }, 0);
  };
  const launchPrompt = (progress: number) => { setResumePosition(null); setInitialProgress(clampProgress(progress)); setPrompt(true); };
  const start = () => {
    if (!content.trim()) return notify("Paste or type a script first.");
    try {
      const raw = localStorage.getItem(STORE.position), saved = raw ? JSON.parse(raw) as SavedPosition : null;
      if (saved && shouldOfferResume(saved.progress, saved.fingerprint, fingerprint)) return setResumePosition(saved);
    } catch { localStorage.removeItem(STORE.position); }
    launchPrompt(0);
  };
  const handlePromptProgress = useCallback((progress: number) => {
    if (progress >= .98) localStorage.removeItem(STORE.position);
    else safelySave(STORE.position, { fingerprint, progress: clampProgress(progress), updatedAt: Date.now() });
  }, [fingerprint, safelySave]);
  const handleFinish = useCallback((result: PracticeResult) => {
    localStorage.removeItem(STORE.position); setPrompt(false); setPracticeResult(result);
    setRecentResults((current) => { const next = [result, ...current].slice(0, 10); safelySave(STORE.results, next); return next; });
  }, [safelySave]);
  const resetSettings = () => ask({ title: "Reset all settings?", message: "Speed, text, colors, margins, and display options will return to their beginner-friendly defaults.", label: "Reset Settings" }, () => { setSettings(DEFAULT_SETTINGS); localStorage.removeItem(STORE.settings); notify("Settings reset."); });
  const clearPosition = () => { localStorage.removeItem(STORE.position); setResumePosition(null); notify("Saved reading position cleared."); };
  const selectPreset = (id: (typeof PRESETS)[number]["id"]) => { setSettings((current) => applyPreset(current, id)); notify("Reading preset applied."); };
  const applyUpdate = () => updateWorker?.postMessage({ type: "SKIP_WAITING" });
  const install = async () => { const event = installPrompt as (Event & { prompt?: () => Promise<void>; userChoice?: Promise<unknown> }) | null; if (event?.prompt) { await event.prompt(); await event.userChoice?.catch(() => undefined); setInstallPrompt(null); } else setInstallHelp(true); };

  if (prompt) return <Teleprompter title={title} script={content} settings={settings} setSettings={setSettings} initialProgress={initialProgress} onProgress={handlePromptProgress} onFinish={handleFinish} onExit={() => setPrompt(false)} notify={notify} />;
  return <div className="app-shell">
    {updateWorker && <div className="update-banner" role="status"><span><strong>Easy Teleprompter has an update ready.</strong><small>Your script is already saved.</small></span><button className="button primary" onClick={applyUpdate}>Update Now</button><button className="icon-button" onClick={() => setUpdateWorker(null)} aria-label="Dismiss update">×</button></div>}
    <header className="site-header"><a href="#top" className="brand"><span className="brand-mark"><i /></span><span><strong>Easy Teleprompter</strong><small>Training video companion</small></span></a><nav><button className="header-button" onClick={() => setTutorial(true)}><Icon symbol="?">Quick Help</Icon></button><button className="header-button accent" onClick={install}><Icon symbol="↓">Install App</Icon></button></nav></header>
    <main id="top" className="main-content">
      {storageWarning && <div className="storage-alert" role="alert"><span>!</span><p>{storageWarning}</p><button onClick={() => setStorageWarning(null)}>Dismiss</button></div>}
      <section className="hero"><div><span className="eyebrow"><i /> Offline-ready · No account needed</span><h1>Easy Teleprompter</h1><p>Paste your script. Set your speed. Start speaking.</p></div><div className="hero-actions"><button className="button primary large" onClick={start}><Icon symbol="▶">Start Teleprompter</Icon></button><button className="button secondary" onClick={newScript}><Icon symbol="＋">New Script</Icon></button><button className="button secondary" onClick={() => setLibrary(true)}><Icon symbol="▤">Saved Scripts</Icon></button></div></section>
      <section className="editor-layout">
        <article className="card editor-card"><div className="card-heading"><div><span className="section-number">01</span><div><h2>Your Script</h2><p>Your draft saves automatically on this device.</p></div></div><span className="save-state"><i /> Saved locally</span></div><label className="field"><span>Script title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Drink Service Training" /></label><div className="script-toolbar"><button onClick={paste}><Icon symbol="▣">Paste</Icon></button><button onClick={() => fileInput.current?.click()}><Icon symbol="↑">Import .txt</Icon></button><button onClick={exportTxt}><Icon symbol="↓">Export .txt</Icon></button><i /><button onClick={save}><Icon symbol="◇">Save Script</Icon></button><button onClick={() => setLibrary(true)}><Icon symbol="▤">Load Saved</Icon></button><button className="danger-text" onClick={clear}><Icon symbol="×">Clear</Icon></button></div><input ref={fileInput} className="visually-hidden" type="file" accept=".txt,text/plain" onChange={importTxt} /><div className="marker-toolbar" role="toolbar" aria-label="Insert production marker"><span>Insert:</span>{MARKER_OPTIONS.map((marker) => <button key={marker} type="button" className={`marker-chip marker-${marker.toLowerCase().replace(" ", "-")}`} onClick={() => insertMarker(marker)} aria-label={`Insert ${marker.toLowerCase()} marker`}>{`[${marker}]`}</button>)}</div><textarea ref={scriptEditor} className="script-editor" value={content} onChange={(event) => setContent(event.target.value)} placeholder={`Paste or type your script here…\n\nTip: Add [PAUSE], [SMILE], [B-ROLL], [EMPHASIS], or [3 SEC] production markers.`} /><div className="editor-footer"><span><strong>{words}</strong> words</span><span><strong>{speakTime(words, settings.wpm)}</strong> at {settings.wpm} WPM</span><span className="marker-legend"><i>[PAUSE]</i><i>[SMILE]</i><i>[B-ROLL]</i></span></div></article>
        <aside><article className="card quick-card"><div className="card-heading"><div><span className="section-number">02</span><div><h2>Quick Setup</h2><p>Start with these essentials.</p></div></div></div><Range label="Scroll speed" value={settings.speed} min={speedBounds(settings.extremeSpeed).min} max={speedBounds(settings.extremeSpeed).max} step={settings.extremeSpeed ? .1 : .5} display={`${settings.speed.toFixed(1)} · ${pace(settings.speed)}`} onChange={(value) => setSettings((current) => ({ ...current, speed: value }))} /><Toggle label="Extreme speed range" hint="Unlocks very slow and super fast scrolling" checked={settings.extremeSpeed} onChange={(value) => setSettings((current) => toggleExtremeSpeed(current, value))} /><Range label="Speaking pace" value={settings.wpm} min={80} max={200} step={5} display={`${settings.wpm} WPM`} onChange={(value) => setSettings((current) => ({ ...current, wpm: value }))} /><Range label="Text size" value={settings.fontSize} min={28} max={120} step={2} display={`${settings.fontSize}px`} onChange={(value) => setSettings((current) => ({ ...current, fontSize: value }))} /><label className="select-field"><span>Countdown before scrolling</span><select value={settings.countdown} onChange={(event) => setSettings((current) => ({ ...current, countdown: Number(event.target.value) as 0 | 3 | 5 | 10 }))}><option value={0}>Off</option><option value={3}>3 seconds</option><option value={5}>5 seconds</option><option value={10}>10 seconds</option></select></label><button className="button primary start-button" onClick={start}><Icon symbol="▶">Start Teleprompter</Icon></button><p className="tap-hint">☝ Tap anywhere while reading to pause or resume.</p></article><article className="card preset-card"><h3>One-tap presets</h3><p>Choose a proven setup, then fine-tune it.</p><div className="preset-grid">{PRESETS.map((preset) => <button key={preset.id} className="preset-button" onClick={() => selectPreset(preset.id)}><strong>{preset.name}</strong><span>{preset.description}</span></button>)}</div></article><article className="card marker-card"><div><h3>Production markers</h3><button onClick={sample}>Try sample</button></div><p>Add these directly inside your script.</p><section><span><b>[PAUSE]</b> Brief stop</span><span><b>[3 SEC]</b> Timed stop</span><span><b>[SMILE]</b> Direction</span><span><b>[B-ROLL]</b> Visual cue</span><span><b>[EMPHASIS]</b> Highlight next sentence</span></section></article><article className="card recovery-card"><h3>Storage & Recovery</h3><p><strong>{storageUsage}</strong> in browser storage</p>{recentResults[0] && <p>Last practice: {recentResults[0].averageWpm} WPM · {formatDuration(recentResults[0].elapsedMs)}</p>}<div className="recovery-actions"><button onClick={clearPosition}>Clear Saved Position</button><button onClick={resetSettings}>Reset Settings</button></div></article></aside>
      </section>
      <section className="privacy"><span>✓</span><div><strong>Your scripts stay on your device.</strong><p>No login, database, paid API, or cloud upload is required.</p></div><i>Android · iPhone · iPad · Mac · Windows</i></section>
    </main><footer><span>Easy Teleprompter v1.1</span><span>Built for clear, confident training videos.</span></footer>
    {tutorial && <Tutorial onClose={dismissTutorial} onSample={sample} />}{library && <Library scripts={scripts} onOpen={open} onDuplicate={duplicate} onRename={(item) => { setRename(item); setRenameValue(item.title); }} onDelete={deleteScript} onClose={() => setLibrary(false)} />}
    {rename && <Modal title="Rename Script" onClose={() => setRename(null)}><label className="field"><span>Script title</span><input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => event.key === "Enter" && renameScript()} /></label><div className="modal-actions"><button className="button secondary" onClick={() => setRename(null)}>Cancel</button><button className="button primary" onClick={renameScript}>Rename</button></div></Modal>}
    {confirm && <Modal title={confirm.title} onClose={() => setConfirm(null)}><p className="confirm-message">{confirm.message}</p><div className="modal-actions"><button className="button secondary" onClick={() => setConfirm(null)}>Cancel</button><button className={`button ${confirm.destructive ? "danger" : "primary"}`} onClick={() => { const action = confirmAction.current; setConfirm(null); action?.(); }}>{confirm.label}</button></div></Modal>}
    {installHelp && <Modal title="Install Easy Teleprompter" onClose={() => setInstallHelp(false)}><div className="install-help"><div><strong>iPhone / iPad</strong><p>Open in Safari, tap Share, then choose <b>Add to Home Screen</b>.</p></div><div><strong>Android / Chrome</strong><p>Open the browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.</p></div><div><strong>Mac / Windows</strong><p>Use the install icon in Chrome or Edge’s address bar or browser menu.</p></div></div><div className="modal-actions"><button className="button primary" onClick={() => setInstallHelp(false)}>Done</button></div></Modal>}
    {resumePosition && <Modal title="Continue where you stopped?" onClose={() => setResumePosition(null)}><p className="confirm-message">This script was saved at <strong>{Math.round(resumePosition.progress * 100)}%</strong>. Continue there or begin again.</p><div className="resume-progress"><span style={{ width: `${resumePosition.progress * 100}%` }} /></div><div className="modal-actions stacked-mobile"><button className="button secondary" onClick={() => { clearPosition(); launchPrompt(0); }}>Start From Beginning</button><button className="button primary" onClick={() => launchPrompt(resumePosition.progress)}>Continue Reading</button></div></Modal>}
    {practiceResult && <Modal title="Practice complete" onClose={() => setPracticeResult(null)}><p className="result-intro">Nice work. Here is a quick summary of that reading.</p><div className="practice-results"><div><strong>{formatDuration(practiceResult.elapsedMs)}</strong><span>Reading time</span></div><div><strong>{practiceResult.averageWpm}</strong><span>Average WPM</span></div><div><strong>{practiceResult.words}</strong><span>Words</span></div><div><strong>{practiceResult.pauses}</strong><span>Pauses</span></div></div><div className="modal-actions"><button className="button secondary" onClick={() => { setPracticeResult(null); launchPrompt(0); }}>Practice Again</button><button className="button primary" onClick={() => setPracticeResult(null)}>Done</button></div></Modal>}
    {toast && <div className="app-toast" role="status"><span>✓</span>{toast}</div>}
  </div>;
}
