// Speak instead of typing. The browser turns speech into text (Safari uses Apple's speech
// service, Chrome uses Google's); the words go into the writing box. A spoken command, or an
// optional 5-second pause, works like pressing Enter (return) twice, so the paragraph's music plays.
import { t, SPEECH_LANG } from './i18n.js';

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Phrases that end a paragraph. Plain "enter" on its own isn't one ("enter the room" is just speech).
const NEW_PARAGRAPH = /\b(?:new|next) paragraph\b|\b(?:press|hit) enter(?: twice| two times| 2)?\b|\benter (?:twice|two times|2|enter)\b|\bplay (?:my |the )?music\b|\b(?:nuevo|siguiente|otro) p[aá]rrafo\b|\bpunto y aparte\b|\b(?:presione|presiona|presioná|dele|dale|dé) enter(?: dos veces)?\b|\benter dos veces\b|\b(?:ponga|pon|poné|toque|toca|tocá) (?:mi |la )?m[uú]sica\b/gi;
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
  let phrase = words.replace(/^[\s.,!?;:]+/, '').trim();
  if (!phrase) return false;
  const before = writer.value.slice(0, writer.selectionStart);
  // Capitalize at the start of a paragraph, and keep a space between phrases
  if (!before.trim() || /\n\s*$/.test(before)) phrase = phrase.charAt(0).toUpperCase() + phrase.slice(1);
  if (before && !/\s$/.test(before)) phrase = ' ' + phrase;
  typeInto(writer, phrase, 'insertText');
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
    ? t('voiceTipPause')
    : t('voiceTip');

  if (!Recognition) {
    // No built-in listening here: the phone keyboard's microphone works instead, and its
    // "new paragraph" command now plays the music too
    btn.addEventListener('click', () => say(isApple ? t('voiceKeyboardApple') : t('voiceKeyboardOther')));
    autoPause.parentElement.hidden = true;
    pauseHint.hidden = true;
    return;
  }

  let rec = null, listening = false, pauseTimer = null, wordsSinceBreak = false;

  function setButton() {
    btn.classList.toggle('listening', listening);
    btn.setAttribute('aria-pressed', listening ? 'true' : 'false');
    btn.textContent = listening ? t('voiceStop') : t('voiceStart');
  }

  function endParagraph(reason) {
    clearTimeout(pauseTimer);
    if (!wordsSinceBreak) return;   // nothing new said: don't add empty paragraphs
    wordsSinceBreak = false;
    pressEnterTwice(writer);
    say(reason === 'pause' ? t('voicePaused') : t('voiceGotIt'), true);
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
    rec.lang = SPEECH_LANG;
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
      if (interim) say(t('voiceHeard', { text: interim.trim() }));
      armPauseTimer();
    };
    rec.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stop(t('voiceNoMic'));
      } else if (e.error === 'network') {
        stop(t('voiceOffline'));
      } else {
        stop(t('voiceStopped'));
      }
    };
    // Browsers stop after a pause; keep listening until the writer taps stop
    rec.onend = () => { if (listening) { try { rec.start(); } catch (e) { stop(); } } };

    try { rec.start(); } catch (e) { stop(t('voiceCantStart')); return; }
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
    stop(unfinished ? t('voiceLast') : '');
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && listening) stop(); });
  setButton();
}
