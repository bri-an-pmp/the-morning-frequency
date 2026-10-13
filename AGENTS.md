# Guide for AI coding agents (Cursor, Claude Code and others)

The Morning Frequency is an ambient journaling app: the writer types a paragraph, presses Enter (return) twice, and hears choir-and-organ music generated for the paragraph's mood. It runs as a website (GitHub Pages) and as an iPhone app (Capacitor). The owner is not a developer, so keep anything the user sees in plain language.

## Setup and commands

- Node 22 (see `.nvmrc`). With nvm: `nvm use 22`.
- `npm ci` installs dependencies.
- `npm run dev` starts the local dev server.
- `npm run build` writes the production site to `dist/`.
- `npm run lint` runs ESLint on `src/`; it must pass before every commit (CI runs it too).
- `npm run ios` builds and copies the site into the iOS project (`ios/App/App/public` is generated and gitignored), then open `ios/App/App.xcodeproj` in Xcode.
- `npm audit --omit=dev` should show no runtime vulnerabilities.

Pushing to `main` deploys the site automatically (`.github/workflows/deploy.yml`: lint, build, publish to Pages).

## Code map

Plain HTML, CSS and JavaScript modules with no framework, bundled by Vite.

- `index.html`: all markup.
- `src/main.js`: the writing flow and UI (Enter detection, paragraphs, saving, sidebars, finish panel, streaks, story button, settings).
- `src/audio.js`: the Web Audio engine. Every sound goes through `getChain(c)` (phaser → chorus, two echoes, cathedral reverb → limiter). `playMoodMusic`, `playStreakMusic` and `playKeyPreview` take an optional context, so the same code renders downloads with an `OfflineAudioContext`.
- `src/moods.js`: the 15 moods and mood detection (keywords, or Claude when the user adds a key). This is the single source of the mood list; buttons, themes and the Claude prompt are generated from it.
- `src/circle.js`: the circle of fifths wheel (home key, path, key family).
- `src/theme.js`: color themes derived from the mood colors.
- `src/export.js`: Word, PDF and WAV files, seamless joining, the streak mix, sharing, and file names (date + entry name).
- `src/story.js`: the 9:16 story video (canvas + MediaRecorder).
- `src/journal.js`: saved entries via Capacitor Preferences (key `tmf_entries`); writes are serialized and loaded data is validated.
- `src/sidebar.js`: entry history, calendar and streak counting.
- `vite.config.js`: adds the Content Security Policy to the built page.

## Rules

- **Security policy.** The built site only allows its own code and connections to itself and `https://api.anthropic.com`. If you add any external service, font or script, update the CSP in `vite.config.js` or it will be blocked in production. Don't add `innerHTML` with user or stored text; use `textContent`.
- **Treat stored data and API replies as untrusted.** Check moods with `isMood()` / `moodProfile()` (never `MOODS[x]` on unchecked input), clamp numbers, and extend `cleanEntry()` in `journal.js` when you add fields to entries.
- **Stay compatible with old entries.** Entries saved by earlier versions must still open and play (for example, the removed mood "neutral" now plays as "dreamy").
- **Don't fail silently.** If something the user asked for doesn't work (a Claude key, a video, a download), tell them in plain words what happened and what to do.
- **UI wording.** Say "Enter (return)". Instructions must stay visible and simple. The writer may be on a phone: keep tap targets at least 44px, inputs at least 16px, and no horizontal scrolling at 390px wide.
- **Audio.** New voices connect to `chain.bus`. Schedule times must be finite and not negative (OfflineAudioContext throws). Long renders should be processed incrementally to fit in phone memory.
- **Accessibility (older and low-vision users).** Use `calc(Npx * var(--ts, 1))` for font sizes so the text-size buttons work, and `var(--font-ui)` / `var(--font-write)` / `var(--font-label)` for font families so the font choice works, and nothing under 13px for reading text. Text colors must reach 4.5:1 contrast; run mood colors through `readable()` from `theme.js` before using them as text. Every control needs an accessible name, and status changes go in an `aria-live` region. Don't hide controls behind hover.
- **iPhone app.** Bundle ID `com.brianathey.morningfrequency`, iPhone only. Downloads and the share sheet don't work inside the app yet (native save/share is planned); don't assume browser downloads work there.

## Checking changes

There's no automated test suite yet. Before committing: run `npm run lint` and `npm run build`, open the built site (`npx vite preview`) and try the flow you changed on desktop and at phone width. For audio changes, also download the WAV and listen.
