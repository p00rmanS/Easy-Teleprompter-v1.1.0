# Changelog

## 1.2.0

- Added presenter profiles: save and switch each person's speed, text size, spacing, alignment, countdown, and mirroring.
- Added a live time-left estimate (counting upcoming pause markers) and Fit speed to length to hit an exact run-time.
- Added clicker/remote support: Page Down and media play-pause toggle pause; Page Up steps back five seconds.
- Added library backup and restore (scripts and profiles) as a single JSON file; restoring merges and never deletes.
- Added a 0.2-60 extended speed range with one-tap slowest/fastest, independent of the speaking-pace estimate.
- Added tap-to-insert production markers and responsive touch-target fixes.
- Added optional Firebase sign-in and training-compliance reporting (hidden unless configured).
- Added GitHub Pages deployment (sub-path aware assets, manifest, and service worker) and a CSP meta tag for hosts without headers.
- Fixed in-session messages (fit results, full-screen and voice notices) never being shown during a reading.
- Fixed the reading position and time estimate drifting when a tablet is rotated or the window is resized.
- Fixed the countdown setting restarting playback when changed mid-reading, and an unbounded Follow My Voice retry loop.
- Service worker no longer caches error pages over the app shell.
- Hardened with security headers, dependency audit fixes, and stricter settings validation.

## 1.1.0

- Added a clear notification when a new offline app version is ready.
- Added continue-from-last-position recovery for interrupted readings.
- Calibrated scrolling and duration estimates with adjustable words per minute.
- Added post-practice results for time, average WPM, words, and pauses.
- Added Training, Announcement, Short Reel, and Prompter Glass presets.
- Added safer local-storage validation, quota warnings, reset controls, and storage status.
- Added automated core tests and GitHub Actions verification.
