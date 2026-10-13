// Speak instead of typing. The browser turns speech into text (Safari uses Apple's speech
// service, Chrome uses Google's); the words go into the writing box. A spoken command, or an
// optional 5-second pause, works like pressing Enter (return) twice, so the paragraph's music plays.
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Phrases that end a paragraph. Plain "enter" on its own isn't one ("enter the room" is just speech).
const NEW_PARAGRAPH = /\b(?:new|next) paragraph\b|\b(?:press|hit) enter(?: twice| two times| 2)?\b|\benter (?:twice|two times|2|enter)\b|\bplay (?:my |the )?music\b|\b(?:nuevo|siguiente) p[aá]rrafo\b|\bpunto y aparte\b/gi;
const PAUSE_MS = 5000;

const $ = id => document.getElementById(id);
const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

// Put text at the cursor and tell the page, exactly as if it had been typed
function typeInto(writer, text, inputType) {
  writer.focus();
  const start = writer.selectionStart, end = writer.selectionEnd;
  writer.setRangeText(text, start, end, 'end');
  writer.dispatchEvent(new InputEvent('input', { inputType, data: text, bubbles: true }));
}

// Returns true if any words were added
function insertWords(writer, words) {
  let t = words.replace(/^[\s.,!?;:]+/, '').trim();
  if (!t) return false;
  const before = writer.value.slice(0, writer.selectionStart);
  // Capitalize at the start of a paragraph, and keep a space between phrases
  if (!before.trim() || /\n\s*$/.test(before)) t = t.charAt(0).toUpperCase() + t.slice(1);
  if (before && !/\s$/.test(before)) t = ' ' + t;
  typeInto(writer, t, 'insertText');
  return true;
}

function pressEnterTwice(writer) {
  typeInto(writer, '\n', 'insertLineBreak');
  typeInto(writer, '\n', 'insertLineBreak');
}

export function initVoice() {
  const btn = $('voice-btn'), status = $('voice-status'), writer = $('writer');
  const autoPause = $('voice-autopause'), pauseHint = $('voice-help-pause');
  const say = (text, heard = false) => { status.textContent = text; status.hidden = !text; status.classList.toggle('heard', heard); };

  // The pause option is remembered; the help text matches it
  try { const saved = localStorage.getItem('tmf_voice_autopause'); if (saved !== null) autoPause.checked = saved === '1'; } catch (e) { /* default on */ }
  const syncPauseHint = () => { pauseHint.hidden = !autoPause.checked; };
  autoPause.addEventListener('change', () => {
    syncPauseHint();
    try { localStorage.setItem('tmf_voice_autopause', autoPause.checked ? '1' : '0'); } catch (e) { /* not essential */ }
  });
  syncPauseHint();

  const listeningTip = () => autoPause.checked
    ? 'Listening… When you finish a thought, say “new paragraph”, or just pause for 5 seconds, to hear your music.'
    : 'Listening… When you finish a thought, say “new paragraph” to hear your music.';

  if (!Recognition) {
    // No built-in listening here: the phone keyboard's microphone works instead, and its
    // "new paragraph" command now plays the music too
    btn.addEventListener('click', () => say(isApple
      ? 'Tap the writing box, then tap the microphone key on your keyboard and talk. Say “new paragraph” when you finish a thought, and your music plays.'
      : 'This browser can’t listen directly. Use the microphone key on your keyboard, and say “new paragraph” when you finish a thought. Or try Chrome or Safari.'));
    autoPause.parentElement.hidden = true;
    pauseHint.hidden = true;
    return;
  }

  let rec = null, listening = false, pauseTimer = null, wordsSinceBreak = false;

  function setButton() {
    btn.classList.toggle('listening', listening);
    btn.setAttribute('aria-pressed', listening ? 'true' : 'false');
    btn.textContent = listening ? '■ stop listening' : '🎤 speak instead of typing';
  }

  function endParagraph(reason) {
    clearTimeout(pauseTimer);
    if (!wordsSinceBreak) return;   // nothing new said: don't add empty paragraphs
    wordsSinceBreak = false;
    pressEnterTwice(writer);
    say(reason === 'pause'
      ? '♪ You paused, so here’s your music. Keep talking for your next paragraph.'
      : '♪ Got it, here’s your music. Keep talking for your next paragraph.', true);
  }

  function armPauseTimer() {
    clearTimeout(pauseTimer);
    if (autoPause.checked && wordsSinceBreak) pauseTimer = setTimeout(() => endParagraph('pause'), PAUSE_MS);
  }

  function stop(message = '') {
    listening = false;
    clearTimeout(pauseTimer);
    if (rec) { try { rec.stop(); } catch (e) { /* already stopped */ } }
    setButton();
    say(message);
  }

  function start() {
    rec = new Recognition();
    rec.lang = navigator.language || 'en-US';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = e => {
      clearTimeout(pauseTimer);   // still talking
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (!e.results[i].isFinal) { interim += text; continue; }
        // "...end of my thought new paragraph next thought" → words, Enter twice, words.
        // Some speech services already turn "new paragraph" into a line break, so treat those the same.
        const parts = text.split(NEW_PARAGRAPH).flatMap(p => p.split(/\n+/));
        const breaks = parts.length - 1;
        parts.forEach((part, n) => {
          if (insertWords(writer, part)) wordsSinceBreak = true;
          if (n < breaks) endParagraph('command');
        });
        if (!breaks) say(listeningTip());
      }
      if (interim) say(`hearing: “${interim.trim()}”`);
      armPauseTimer();
    };
    rec.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stop('The microphone is turned off for this page. Allow the microphone in your browser or phone settings, then tap the button again.');
      } else if (e.error === 'network') {
        stop('Speaking needs an internet connection. Check your connection and try again.');
      } else {
        stop('Listening stopped. Tap the button to try again.');
      }
    };
    // Browsers stop after a pause; keep listening until the writer taps stop
    rec.onend = () => { if (listening) { try { rec.start(); } catch (e) { stop(); } } };

    try { rec.start(); } catch (e) { stop('Listening couldn’t start. Tap the button to try again.'); return; }
    listening = true;
    wordsSinceBreak = false;
    setButton();
    say(listeningTip());
  }

  btn.addEventListener('click', () => {
    if (!listening) return start();
    // Stopping mid-paragraph still plays that paragraph's music
    const unfinished = wordsSinceBreak;
    endParagraph('command');
    stop(unfinished ? '♪ Here’s the music for your last paragraph. Tap the button to keep talking.' : '');
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && listening) stop(); });
  setButton();
}
