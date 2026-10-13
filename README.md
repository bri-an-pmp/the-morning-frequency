# The Morning Frequency

An ambient writing app that turns your morning pages into music. Write a paragraph, press Enter (return) twice, and the app works out the mood of what you wrote, then plays a short choir-and-organ piece tuned to match. Write three paragraphs to complete your morning, replay each one's sound, and save your writing and music when you're done. It runs entirely in the browser on desktop and mobile, with no sign-up and no install.

## Live Demo

Try it on GitHub Pages:

[![Open the app](https://img.shields.io/badge/%E2%96%B6%20Open%20the%20app-GitHub%20Pages-blue)](https://bri-an-pmp.github.io/the-morning-frequency/)

https://bri-an-pmp.github.io/the-morning-frequency/

## How to Use It

1. Turn your sound on, name your entry if you like, and type a paragraph, or tap **🎤 speak instead of typing** and say "new paragraph" when you finish one. Any length counts, even one word.
2. Press **Enter (return) twice** to hear your frequency and start a new paragraph.
3. After three paragraphs, your morning is complete. Click any colored bar under the progress ring to replay that paragraph's sound.
4. Click **Finish Session** to download your writing (Word or PDF) and your music (WAV), named with the date and your entry name, or tap **save to cloud / share** to send them to iCloud Drive, Google Drive, Dropbox or email. **Save to Apple Notes** keeps one running note: each day is added underneath with its own date and title.
5. Tap **make story video** to turn your music into a short video for Instagram, TikTok or Facebook stories, then **share to story**. Your writing stays private unless you choose to add a line.
6. Every entry saves automatically. Use **new entry** to keep this one and start another, or **reset** to erase this entry and start with a clean slate. Find past entries in **Your entries** on the left (like a chat history) and see the days you wrote on the **calendar** on the right, along with your streak. On a phone, open them with the buttons at the top of the screen.
7. Write on 3, 5, 10, 14, 21 and 30 days in a row to unlock streak sounds, each with its own key and bells, grander at every milestone. Each streak also earns a **streak mix**: every paragraph's music from the whole streak in one continuous piece, ending with the milestone sound, to play, download or share.
8. Make it yours: set **reverb** and **delay** from 0% (dry) to 200% (twice as spacious) under *music settings*, turn the **circle of fifths** wheel under *music settings* to pick a home key (tap ▶ to hear the five-key path), and choose a **color theme** above the calendar, or let the page follow your mood as you write.

## How It Works

Each time you finish a paragraph, the app reads its mood: joyful, reflective, tense, melancholic, hopeful, analytical or nostalgic; five moods inspired by Stevie Wonder (grateful, groovy, loving, celebratory and dreamy); or three in Spanish from flamenco and bolero (alegría, duende and ternura). By default it uses keyword matching (in English and Spanish). If you add a Claude key under *music settings → Smarter mood matching*, it asks Claude (claude-haiku-4-5) instead, which reads the whole paragraph and returns a mood, an energy level and how positive it feels.

That mood sets the music's tempo, chords, melody and texture. The key comes from the circle of fifths: you pick a home key, and each paragraph moves one step around the circle, so the paragraphs flow into each other like a chord progression (the inner, minor ring gives a darker sound). All the sound is generated live with the Web Audio API, with no audio files. Choir, organ and bell voices run through a phaser, a chorus, two echoes and a long cathedral reverb, and a limiter keeps the sound from distorting. The third paragraph gets a fuller finale chord, and streak milestones (3, 5, 10, 14, 21 and 30 days) each have their own fanfare.

When you finish a session, the app builds your files in the browser, named with the date and your entry name. It turns your paragraphs into a Word document and a PDF, and re-renders each paragraph's music in high quality, joined into one WAV recording with no gaps. The story video is drawn on a canvas with a ring that moves with your music, recorded in the browser and saved as a tall MP4 ready for stories. "Save to cloud / share" uses your device's own share menu, so there's no account to connect.

## Tech Stack

Plain HTML, CSS and JavaScript (no framework) built with Vite, Capacitor for the iPhone app (with Capacitor Preferences for saving entries), the Web Audio API for music and audio rendering, Canvas and MediaRecorder for the story video, the Anthropic API (optional) for mood analysis, docx and jsPDF 4 for the Word and PDF downloads, the Web Share API for saving to the cloud, self-hosted fonts (DM Serif Display, DM Mono, Nunito), and GitHub Pages for hosting.

## Project Structure

index.html is the page layout. The src/ folder holds the app code: main.js (the writing flow and interface), audio.js (the music engine), moods.js (the 15 mood profiles and detection), circle.js (the circle of fifths wheel), theme.js (the color themes), export.js (Word, PDF and WAV files, the streak mix and sharing), story.js (the story video), journal.js (saving entries safely), sidebar.js (the entry history, calendar and streaks) and styles.css (the sky design). vite.config.js adds the security policy to the built site. The ios/ folder is the native iPhone app project created with Capacitor. .github/workflows/deploy.yml builds and publishes the website on every push.

## Accessibility

Built for older writers and people with low vision, and checked against WCAG 2.2 AA with axe-core (no violations on desktop or phone, in every color theme):

- **Text size** buttons (normal, large, extra large) at the top, remembered between visits; browser zoom works too.
- **Font** choices under them: Claude serif and Claude sans (free look-alikes of Claude's reading and interface fonts: Source Serif 4 and Inter) and Easy-read (Atkinson Hyperlegible, designed by the Braille Institute for low vision). Tap the chosen one again for the original fonts.
- Strong contrast: text and theme colors are darkened automatically until they're easy to read, and the page follows the device's "increase contrast" setting.
- Every button, slider and menu has a name for screen readers; music, mood and progress updates are announced; the replay bars are real buttons.
- A clear focus outline for keyboard users, large tap targets, and no controls that only appear on hover.
- Animations stop when the device is set to reduce motion.
- Voice input for people who'd rather not type.

## Privacy and Security

Your writing is saved only on your own device (in the browser on the website, or on your iPhone in the app) and is never stored on a server. Without a Claude key, your writing never leaves your device. If you add a key, it's saved only on your own device, and your paragraphs are sent only to Anthropic for mood analysis. When you use voice input, your device's speech service (Apple in Safari, Google in Chrome) turns your voice into text.

The app was reviewed for security weaknesses, and these protections are built in:

- A Content Security Policy lets the page run only its own code and talk only to itself and Claude's API.
- Claude's replies are checked before use (real moods only, values kept in range), and the paragraph is marked as text to analyze, not instructions.
- Saved entries and settings are checked and repaired when loaded; unreadable data is backed up instead of being overwritten; saves happen one at a time so they can't undo each other.
- Held-down keys can't flood the audio, blank lines don't trigger extra Claude calls, and long streak mixes are built a piece at a time to stay within phone memory.
- Dependencies are checked with npm audit (jsPDF was upgraded to 4.2.1 for a critical advisory).

Known limits: the website shares the bri-an-pmp.github.io address with other GitHub Pages sites on the same account, and a Claude key kept in the browser is only as safe as that browser. A custom domain, or the on-device mood detection planned for the iPhone app, removes both.

## Setup

Install Node.js 22, then run npm install. Use npm run dev to work on the site locally, and npm run build to create the production files in dist/. For the iPhone app (Xcode required), run npm run ios to copy the latest build into the iOS project, then open ios/App/App.xcodeproj in Xcode. Mood detection works without a key; for Claude-powered mood detection, open *music settings → Smarter mood matching* and follow the steps there. Run npm run lint and npm audit before publishing.

AI coding agents (Cursor, Claude Code and others) should read AGENTS.md first: it covers the commands, the code map and the project's rules.

## Deployment

The website is deployed to GitHub Pages (https://bri-an-pmp.github.io/the-morning-frequency/) by a GitHub Actions workflow that builds the site on every push to main. To host your own copy, fork the repo and set Settings → Pages → Source to GitHub Actions. The iPhone app is in progress for the Apple App Store.
