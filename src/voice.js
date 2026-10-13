// Speak instead of typing. The browser turns speech into text (Safari uses Apple's speech
// service, Chrome uses Google's); the words go into the writing box. Saying "new paragraph"
// works like pressing Enter (return) twice, so the paragraph's music plays.
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const NEW_PARAGRAPH = /(?:new|next) paragraph|nuevo p[aá]rrafo|punto y aparte/gi;

const $ = id => document.getElementById(id);
const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

// Put text at the cursor and tell the page, exactly as if it had been typed
function typeInto(writer, text, inputType) {
  writer.focus();
  const start = writer.selectionStart, end = writer.selectionEnd;
  writer.setRangeText(text, start, end, 'end');
  writer.dispatchEvent(new InputEvent('input', { inputType, data: text, bubbles: true }));
}

function insertWords(writer, words) {
  let t = words.trim();
  if (!t) return;
  const before = writer.value.slice(0, writer.selectionStart);
  // Capitalize at the start of a paragraph, and keep a space between phrases
  if (!before.trim() || /\n\s*$/.test(before)) t = t.charAt(0).toUpperCase() + t.slice(1);
  if (before && !/\s$/.test(before)) t = ' ' + t;
  typeInto(writer, t, 'insertText');
}

function pressEnterTwice(writer) {
  typeInto(writer, '\n', 'insertLineBreak');
  typeInto(writer, '\n', 'insertLineBreak');
}

export function initVoice() {
  const btn = $('voice-btn'), status = $('voice-status'), writer = $('writer');
  const say = text => { status.textContent = text; status.hidden = !text; };

  if (!Recognition) {
    btn.addEventListener('click', () => say(isApple
      ? 'This screen can’t listen directly. Tap the writing box, then tap the microphone key on your keyboard and speak. Press return twice when you finish a paragraph.'
      : 'This browser can’t turn speech into text. Try Chrome or Safari, or use the microphone key on your keyboard.'));
    return;
  }

  let rec = null, listening = false;

  function setButton() {
    btn.classList.toggle('listening', listening);
    btn.setAttribute('aria-pressed', listening ? 'true' : 'false');
    btn.textContent = listening ? '■ stop listening' : '🎤 speak instead of typing';
  }

  function stop(message = '') {
    listening = false;
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
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (!e.results[i].isFinal) { interim += text; continue; }
        // "...end of my thought new paragraph next thought" → words, Enter twice, words
        const parts = text.split(NEW_PARAGRAPH);
        parts.forEach((part, n) => {
          insertWords(writer, part);
          if (n < parts.length - 1) pressEnterTwice(writer);
        });
      }
      say(interim ? `hearing: “${interim.trim()}”` : 'Listening… say “new paragraph” to hear your music.');
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
    setButton();
    say('Listening… say “new paragraph” to hear your music. (Your device’s speech service turns your voice into text.)');
  }

  btn.addEventListener('click', () => (listening ? stop() : start()));
  document.addEventListener('visibilitychange', () => { if (document.hidden && listening) stop(); });
  setButton();
}
