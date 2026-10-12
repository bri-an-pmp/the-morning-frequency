# The Morning Frequency

An ambient writing app that turns your morning pages into music. Write a paragraph, press Enter (return) twice, and the app works out the mood of what you wrote, then plays a short choir-and-organ piece tuned to match. Write three paragraphs to complete your morning, replay each one's sound, and save your writing and music when you're done. It runs entirely in the browser on desktop and mobile, with no sign-up and no install.

## Live Demo

Try it on GitHub Pages:

[![Open the app](https://img.shields.io/badge/%E2%96%B6%20Open%20the%20app-GitHub%20Pages-blue)](https://bri-an-pmp.github.io/the-morning-frequency/)

https://bri-an-pmp.github.io/the-morning-frequency/

## How to Use It

1. Turn your sound on and type a paragraph. Any length counts, even one word.
2. Press **Enter (return) twice** to hear your frequency and start a new paragraph.
3. After three paragraphs, your morning is complete. Click any colored bar under the progress ring to replay that paragraph's sound.
4. Click **Finish Session** to download your writing (Word or PDF) and your music (WAV), or tap **save to cloud / share** to send them to iCloud Drive, Google Drive, Dropbox or email.
5. Tap **make story video** to turn your music into a short video for Instagram, TikTok or Facebook stories, then **share to story**. Your writing stays private unless you choose to add a line.
6. Every entry saves automatically. Find past entries in **Your entries** on the left (like a chat history) and see the days you wrote on the **calendar** on the right, along with your streak. On a phone, open them with the buttons at the top of the screen.

## How It Works

Each time you finish a paragraph, the app reads its mood: joyful, reflective, tense, melancholic, hopeful, analytical, nostalgic or neutral. By default it uses keyword matching. If you add an Anthropic API key under *music settings*, it asks Claude (claude-haiku-4-5) instead, which returns a mood, an energy level and how positive the paragraph feels.

That mood sets the music's key, tempo, chords, melody and texture. All the sound is generated live with the Web Audio API, with no audio files. Choir and organ voices run through a phaser, an echo and a long cathedral reverb, and a limiter keeps the sound from distorting. The third paragraph gets a fuller finale chord.

When you finish a session, the app builds your files in the browser. It turns your paragraphs into a Word document and a PDF, and re-renders each paragraph's music in high quality, joined into one WAV recording. The story video is drawn on a canvas with a ring that moves with your music, recorded in the browser and saved as a tall MP4 ready for stories. "Save to cloud / share" uses your device's own share menu, so there's no account to connect.

## Tech Stack

Plain HTML, CSS and JavaScript (no framework) built with Vite, Capacitor for the iPhone app, the Web Audio API for music and audio rendering, the Anthropic API (optional) for mood analysis, docx and jsPDF for the Word and PDF downloads, the Web Share API for saving to the cloud, self-hosted fonts (DM Serif Display, DM Mono, Nunito), and GitHub Pages for hosting.

## Project Structure

index.html is the page layout. The src/ folder holds the app code: main.js (the writing flow and interface), audio.js (the music engine), moods.js (mood profiles and detection), export.js (Word, PDF and WAV files and sharing), story.js (the story video), journal.js (saving entries), sidebar.js (the entry history and calendar) and styles.css (the sky design). The ios/ folder is the native iPhone app project created with Capacitor. .github/workflows/deploy.yml builds and publishes the website on every push.

## Privacy

Your writing is saved only on your own device (in the browser on the website, or on your iPhone in the app) and is never stored on a server. If you add an API key, it's saved only on your own device, and your paragraphs are sent only to Anthropic for mood analysis.

## Setup

Install Node.js 22, then run npm install. Use npm run dev to work on the site locally, and npm run build to create the production files in dist/. For the iPhone app (Xcode required), run npm run ios to copy the latest build into the iOS project, then open ios/App/App.xcodeproj in Xcode. Mood detection works without a key; for Claude-powered mood detection, paste your Anthropic API key under *music settings* and click save.

## Deployment

The website is deployed to GitHub Pages (https://bri-an-pmp.github.io/the-morning-frequency/) by a GitHub Actions workflow that builds the site on every push to main. To host your own copy, fork the repo and set Settings → Pages → Source to GitHub Actions. The iPhone app is in progress for the Apple App Store.
