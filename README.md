# The Morning Frequency

**Write a few lines. Hear your mood played back as music.**

### ▶ [Open the app](https://bri-an-pmp.github.io/the-morning-frequency/)

No sign-up and no install. It works in any modern browser.

---

## The 1-minute version

**What it is:** a writing tool for your morning. Each time you finish a paragraph by pressing **Enter twice**, it works out the mood of what you just wrote (joyful, reflective, tense, hopeful and so on) and plays a short piece of choir-and-organ music in a cathedral-like space to match. Write three paragraphs and your morning is complete. Click any finished paragraph's bar to replay its sound, then take home both your writing (Word or PDF) and your music (a WAV recording).

**Why it's worth a try:** a blank page is hard to start, and most writing apps feel like work. The Morning Frequency turns each paragraph into a small reward. You keep writing because you want to hear what comes next. It's a few calm minutes that get your thoughts out of your head and onto the page, with a soundtrack that responds to how you feel.

**How to use it:**
1. Turn your sound on and start typing.
2. Write a paragraph (any length, even one word), then press **Enter twice** to hear your music.
3. Write three paragraphs to complete your morning. You can keep going after that.
4. Click a colored bar under the progress ring to replay that paragraph's sound.
5. Click **Finish Session** to download your writing (**.docx** or **PDF**) and your music (**.wav**), or tap **save to cloud / share** to send them to iCloud Drive, Google Drive, Dropbox, email and more.

---

## How it works

The whole app is one file, [`index.html`](index.html): plain HTML, CSS and JavaScript with no framework and no build step.

| Piece | What it does |
|---|---|
| **Web Audio API** | Generates all the music live in the browser. There are no audio files. Choir and organ voices go through a phaser, an echo (delay) and a long cathedral reverb. Key, tempo, chords and melody all follow the detected mood. |
| **Mood detection** | Works out the mood of each paragraph from its keywords. If you add an Anthropic API key, it asks **Claude** (Haiku) instead, which reads the paragraph and returns a mood, an energy level and how positive it feels. |
| **[docx](https://www.npmjs.com/package/docx) and [jsPDF](https://github.com/parallax/jsPDF)** | Build the Word and PDF downloads in your browser. They load only when you finish a session. |
| **Offline audio rendering** | Re-renders each paragraph's music in high quality and joins them into one WAV file, entirely in your browser. |
| **Web Share API** | Opens your device's own share menu for "save to cloud", so there's no account to connect. |
| **GitHub Pages** | Hosts the site for free, straight from this repo. |

**Optional settings** (under *music settings*): an API key for Claude mood detection, a manual mood picker, tempo, volume, musical key and texture.

## Privacy

Your writing stays in your browser. Nothing is stored on a server. If you add an API key, it's saved only on your own device, and your paragraphs go only to Anthropic for mood analysis.

## Run it yourself

Download `index.html` and open it in your browser. To host your own copy, fork this repo and turn on **GitHub Pages** (Settings → Pages → deploy from the `main` branch, root folder).
