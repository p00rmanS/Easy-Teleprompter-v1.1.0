# Easy Teleprompter

A responsive, installable React + Vite teleprompter built for employee training videos. Drafts, scripts, and settings stay in the browser using `localStorage`; no account, database, or paid API is required.

## Start scrolling

1. Paste or type a script.
2. Press **Start Teleprompter**.
3. Wait for the selected countdown.
4. Scrolling begins automatically. No keyboard key is required.

If the prompt is paused, tap **Start / Resume**, tap the reading area, or press the Spacebar. Open the app through Netlify or `npm run dev`; do not double-click `index.html` directly from a file browser.

## Features

- Smooth automatic scrolling with tap, touch, keyboard, and visible controls
- Portrait and landscape layouts for Android, iPhone, iPad, Mac, and Windows
- Installable PWA with offline use after the first successful visit
- Local script library with search, sort, open, duplicate, rename, and delete
- Import/export `.txt`, clipboard paste, autosave, word count, and speaking time
- Countdown, layout controls, custom colors, mirrored display, full screen, and Wake Lock
- Markers: `[PAUSE]`, `[SMILE]`, `[B-ROLL]`, `[EMPHASIS]`, and `[3 SEC]`
- Experimental browser-based “Follow My Voice” mode when supported
- Resume from the last saved reading position after an interruption
- WPM-calibrated speed, speaking estimates, and post-practice results
- One-tap presets for training, announcements, short reels, and prompter glass
- In-app PWA update notification and stronger storage recovery

## Run locally

1. Install Node.js 22.13 or newer.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the local address shown in the terminal.

Build and test the production version:

```bash
npm test
npm run build
npm run preview
```

The production files are written to `dist/`. GitHub Actions also runs `npm test` and `npm run build` on every push and pull request.

## Deploy to Netlify

### From Git

1. Push this folder to GitHub or another Git provider.
2. In Netlify, choose **Add new site → Import an existing project**.
3. Select the repository. The included `netlify.toml` supplies the correct settings.
4. Confirm the build command is `npm run build` and publish directory is `dist`.
5. Deploy.

### Manual deployment

1. Run `npm install` and `npm run build`.
2. In Netlify, choose **Add new site → Deploy manually**.
3. Drag the generated `dist` folder into Netlify.

Netlify provides the HTTPS required for PWA installation and service workers. On iPhone and iPad, install from Safari using **Share → Add to Home Screen**.

## Browser fallbacks

Automatic scrolling, local storage, markers, gestures, and keyboard controls work without special permissions. Clipboard reading, full screen, Wake Lock, install prompts, and speech recognition depend on the browser; the app shows an explanation or keeps the normal teleprompter available when a feature is unsupported.

## File structure

```text
easy-teleprompter/
├── .github/workflows/ci.yml
├── public/
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon.svg
│   ├── manifest.webmanifest
│   └── service-worker.js
├── scripts/generate_icons.py
├── src/
│   ├── EasyTeleprompter.tsx
│   ├── app.css
│   ├── core.ts
│   ├── core.test.ts
│   └── main.tsx
├── CHANGELOG.md
├── index.html
├── netlify.toml
├── package.json
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```
