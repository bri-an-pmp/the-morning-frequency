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

## How It Works

Each time you finish a paragraph, the app reads its mood: joyful, reflective, tense, melancholic, hopeful, analytical, nostalgic or neutral. By default it uses keyword matching. If you add an Anthropic API key under *music settings*, it asks Claude (claude-haiku-4-5) instead, which returns a mood, an energy level and how positive the paragraph feels.

That mood sets the music's key, tempo, chords, melody and texture. All the sound is generated live with the Web Audio API, with no audio files. Choir and organ voices run through a phaser, an echo and a long cathedral reverb, and a limiter keeps the sound from distorting. The third paragraph gets a fuller finale chord.

When you finish a session, the app builds your files in the browser. It turns your paragraphs into a Word document and a PDF, and re-renders each paragraph's music in high quality, joined into one WAV recording. "Save to cloud / share" uses your device's own share menu, so there's no account to connect.

## Tech Stack

Plain HTML, CSS and JavaScript (no framework, no build step), the Web Audio API for music and audio rendering, the Anthropic API (optional) for mood analysis, docx and jsPDF for the Word and PDF downloads, the Web Share API for saving to the cloud, Google Fonts (DM Serif Display, DM Mono, Nunito), and GitHub Pages for hosting.

## Project Structure

index.html is the whole app: the page layout, the sky-themed design, the music engine, mood detection and the downloads. README.md is this file.

## Privacy

Your writing stays in your browser and is never stored on a server. If you add an API key, it's saved only on your own device, and your paragraphs are sent only to Anthropic for mood analysis.

## Setup

No install is needed. To run it locally, download index.html and open it in any modern browser. Mood detection works without a key; for Claude-powered mood detection, paste your Anthropic API key under *music settings* and click save.

## Deployment

This project is deployed with GitHub Pages (https://bri-an-pmp.github.io/the-morning-frequency/) from the main branch, root folder. To host your own copy, fork the repo and turn on Pages under Settings → Pages.
