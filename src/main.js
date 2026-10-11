import '@fontsource/dm-serif-display/400.css';
import '@fontsource/dm-serif-display/400-italic.css';
import '@fontsource/dm-mono/300.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import './styles.css';
import { MOODS, analyzeMood } from './moods.js';
import { ctx, playMoodMusic } from './audio.js';
import {
  sessionParagraphs, sessionFilename, saveBlob, canShareFiles,
  makeDocxBlob, makePdfBlob, makeWavBlob, shareFile,
} from './export.js';
import { loadEntries, saveEntry, deleteEntry, newEntryId, dayKey } from './journal.js';
import { renderHistory, renderCalendar } from './sidebar.js';

// ─── State ────────────────────────────────────────────────────────────────────
let completedCount = 0;
let isManualOverride = false;
let manualMood = null;
let apiKey = localStorage.getItem('pm_api_key') || '';
const GOAL = 3;

if (apiKey) {
  document.getElementById('api-key-input').value = apiKey;
  document.getElementById('key-status').textContent = 'key saved — AI mood analysis active';
  document.getElementById('key-status').className = 'key-status ok';
}

function showDate(date) {
  document.getElementById('date-stamp').textContent = new Date(date).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
}
showDate(new Date());

// ─── UI helpers ───────────────────────────────────────────────────────────────
const notifEl   = document.getElementById('notif');
const notifTxt  = document.getElementById('notif-text');
const moodBadge = document.getElementById('mood-badge');
const moodParam = document.getElementById('mood-params');
const analyzingEl = document.getElementById('analyzing-text');
const ringEl    = document.getElementById('ring');
const countEl   = document.getElementById('count-num');
const pips      = ['pip1','pip2','pip3'].map(id => document.getElementById(id));
const pipCls    = ['active-p1','active-p2','active-p3'];
const allWaveBars = document.querySelectorAll('.wave-bar');

function showAnalyzing(on) {
  analyzingEl.classList.toggle('visible', on);
  if (on) { moodBadge.classList.remove('visible'); moodParam.classList.remove('visible'); }
}

function showMoodResult(moodData) {
  analyzingEl.classList.remove('visible');
  const p = MOODS[moodData.mood] || MOODS.neutral;
  moodBadge.textContent = moodData.mood;
  moodBadge.className = 'mood-badge visible mood-' + moodData.mood;
  moodParam.textContent = p.desc + (moodData.reason ? ` — "${moodData.reason}"` : '');
  moodParam.classList.add('visible');
}

function updateRing(n) {
  ringEl.style.strokeDashoffset = 226 * (1 - n/GOAL);
  countEl.textContent = n;
  ringEl.style.stroke = ['var(--accent1)','var(--accent2)','var(--accent3)'][n-1];
}

function setWave(color, on) {
  allWaveBars.forEach(b => { b.style.background = color; b.classList.toggle('animating', on); });
}

// ─── Reward trigger ───────────────────────────────────────────────────────────
// index: paragraph number toward the goal (null for an Enter on a blank line)
async function triggerReward(paraText, index, playIndex) {
  ctx(); // wake audio context
  showAnalyzing(true);
  const gen = sessionGen;

  let moodData;
  if (isManualOverride && manualMood) {
    const p = MOODS[manualMood];
    moodData = { mood:manualMood, energy:p.energy, valence:p.valence, reason:'manual' };
  } else {
    moodData = paraText ? await analyzeMood(paraText, apiKey) : { mood:'neutral', energy:MOODS.neutral.energy, valence:MOODS.neutral.valence, reason:'blank line' };
  }
  if (gen !== sessionGen) return;

  const profile = MOODS[moodData.mood] || MOODS.neutral;
  showMoodResult(moodData);

  const onGoal = index !== null && index < GOAL;
  if (onGoal) {
    pips[index].classList.add(pipCls[index]);
    updateRing(index + 1);
  }

  notifEl.className = 'notif playing';
  notifEl.style.setProperty('--notif-color', profile.color);
  setWave(profile.color, true);

  const msgs = ['♩ paragraph 1 unlocked','♩♩ paragraph 2 unlocked','♩♩♩ morning complete'];
  notifTxt.textContent = onGoal ? msgs[index] : (index === null ? '♩ new line' : `♩ paragraph ${index+1}`);
  const titles = ['First paragraph done.','Two down. One more to go.','Morning frequency complete.'];
  if (onGoal) document.getElementById('progress-title').textContent = titles[index];

  // Paragraph 3 gets the finale; everything else cycles through the regular voicings
  const musicIndex = index === 2 ? 2 : (playIndex % 3 === 2 ? 3 : playIndex % 3);
  if (index !== null) { sessionTracks[index] = { profile, musicIndex, moodData }; scheduleSave(0); }
  if (onGoal) {
    pips[index].classList.add('done');
    pips[index].title = `replay paragraph ${index+1} — ${moodData.mood}`;
    document.getElementById('pip-hint').classList.add('visible');
  }
  const token = ++playToken;
  playMoodMusic(profile, musicIndex);

  if (index === 2) setTimeout(() => document.getElementById('goal-banner').classList.add('show'), 900);

  const dur = profile.energy > 0.7 ? 2200 : profile.energy < 0.3 ? 4500 : 3200;
  setTimeout(() => {
    if (token !== playToken) return;
    setWave(profile.color, false);
    notifEl.classList.remove('playing');
    notifTxt.textContent = completedCount < GOAL
      ? (completedCount === 0 ? 'waiting for your first paragraph...' : `paragraph ${completedCount} done — ${GOAL-completedCount} to go`)
      : (completedCount === GOAL ? 'goal reached — well done' : `${completedCount} paragraphs — keep going`);
  }, dur);
}

// ─── Paragraph detection ──────────────────────────────────────────────────────
document.getElementById('writer').addEventListener('keydown', () => ctx());

// iOS only lets audio start from a tap — unlock it with a silent sound on the first touch
function unlockAudio() {
  const c = ctx();
  const src = c.createBufferSource();
  src.buffer = c.createBuffer(1, 1, 22050);
  src.connect(c.destination);
  src.start(0);
}
['touchend', 'click'].forEach(ev => document.addEventListener(ev, unlockAudio, { once: true, passive: true }));
// Every Enter plays music. Enter after a line with text also counts toward the goal.
let enterCount = 0;
let prevText = '';
let playToken = 0;        // bumps on every playback so stale status updates are skipped
let sessionTracks = [];   // per counted paragraph: { profile, musicIndex, moodData }

// Click a finished bar to replay that paragraph's music
pips.forEach((pip, i) => pip.addEventListener('click', () => {
  const t = sessionTracks[i];
  if (!t) return;
  showMoodResult(t.moodData);
  notifEl.className = 'notif playing';
  notifEl.style.setProperty('--notif-color', t.profile.color);
  notifTxt.textContent = `♩ replaying paragraph ${i+1}`;
  setWave(t.profile.color, true);
  const token = ++playToken;
  playMoodMusic(t.profile, t.musicIndex);
  setTimeout(() => { if (token === playToken) { setWave(t.profile.color, false); notifEl.classList.remove('playing'); } }, 3500);
}));
document.getElementById('writer').addEventListener('input', (e) => {
  const el = document.getElementById('writer');
  const text = el.value;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  document.getElementById('word-count').textContent = words + ' word' + (words!==1?'s':'');
  const paras = (text.match(/^[^\n]*\S[^\n]*\n/gm) || []).length;
  document.getElementById('para-count-meta').textContent = paras + ' paragraph' + (paras!==1?'s':'') + ' detected';
  // Some Android keyboards don't report insertLineBreak, so also check for a new newline at the caret
  const newlineTyped = e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph' ||
    (text.length === prevText.length + 1 && text[el.selectionStart - 1] === '\n');
  prevText = text;
  scheduleSave();
  if (!newlineTyped) return;
  const before = text.slice(0, el.selectionStart).split('\n').slice(0, -1);
  const justFinished = (before[before.length - 1] || '').trim();
  const latest = before.map(l => l.trim()).filter(Boolean).slice(-1)[0] || '';
  if (justFinished) {
    triggerReward(justFinished, completedCount, enterCount++);
    completedCount++;
  } else {
    triggerReward(latest, null, enterCount++);
  }
});

// ─── Settings ─────────────────────────────────────────────────────────────────
document.getElementById('settings-toggle').addEventListener('click', toggleSettings);
document.getElementById('save-key-btn').addEventListener('click', saveApiKey);
document.getElementById('manual-override-toggle').addEventListener('change', e => toggleManualOverride(e.target.checked));
document.querySelectorAll('.mood-btn').forEach(btn => btn.addEventListener('click', () => selectMood(btn)));
document.getElementById('tempo-offset').addEventListener('input', e => {
  document.getElementById('tempo-val').textContent = (e.target.value > 0 ? '+' : '') + e.target.value;
});
document.getElementById('volume').addEventListener('input', e => {
  document.getElementById('volume-val').textContent = e.target.value + '%';
});

function toggleSettings() {
  document.getElementById('settings-toggle').classList.toggle('open');
  document.getElementById('settings-panel').classList.toggle('open');
}

function saveApiKey() {
  const val = document.getElementById('api-key-input').value.trim();
  if (!val || !val.startsWith('sk-')) {
    document.getElementById('key-status').textContent = 'invalid key format';
    document.getElementById('key-status').className = 'key-status err';
    return;
  }
  apiKey = val;
  localStorage.setItem('pm_api_key', val);
  document.getElementById('key-status').textContent = 'key saved — AI mood analysis active';
  document.getElementById('key-status').className = 'key-status ok';
}

function toggleManualOverride(on) {
  isManualOverride = on;
  document.getElementById('manual-mood-wrap').classList.toggle('visible', on);
}

function selectMood(btn) {
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  manualMood = btn.dataset.mood;
}

// ─── Reset ────────────────────────────────────────────────────────────────────
function clearSession() {
  sessionGen++;
  document.getElementById('writer').value = '';
  completedCount = 0; enterCount = 0; sessionTracks = []; prevText = '';
  pips.forEach(p => p.removeAttribute('title'));
  document.getElementById('pip-hint').classList.remove('visible');
  countEl.textContent = '0'; ringEl.style.strokeDashoffset = '226'; ringEl.style.stroke = 'var(--accent1)';
  pips.forEach(p => { p.className = 'para-pip'; });
  setWave('var(--accent1)', false);
  notifEl.className = 'notif';
  notifTxt.textContent = 'waiting for your first paragraph...';
  moodBadge.className = 'mood-badge';
  moodParam.classList.remove('visible');
  analyzingEl.classList.remove('visible');
  document.getElementById('progress-title').textContent = 'Start writing.';
  document.getElementById('word-count').textContent = '0 words';
  document.getElementById('para-count-meta').textContent = '0 paragraphs detected';
  document.getElementById('goal-banner').classList.remove('show');
  document.getElementById('finish-panel').classList.remove('show');
}

// ─── Journal: auto-save, history, calendar ────────────────────────────────────
let sessionGen = 0;          // bumps whenever the writing box switches to a different entry
let currentId = null;        // id of the entry being written (null until there's text)
let currentCreatedAt = null;
let entries = [];
let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let saveTimer = null;

function scheduleSave(delay = 600) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, delay);
}

async function persist() {
  const text = document.getElementById('writer').value;
  if (!text.trim()) return;                       // nothing worth keeping yet
  if (!currentId) { currentId = newEntryId(); currentCreatedAt = new Date().toISOString(); }
  entries = await saveEntry({
    id: currentId,
    createdAt: currentCreatedAt,
    updatedAt: new Date().toISOString(),
    text,
    completedCount,
    enterCount,
    tracks: sessionTracks.map(t => t ? { musicIndex: t.musicIndex, moodData: t.moodData } : null),
  });
  renderSidebars();
}

function renderSidebars() {
  renderHistory(document.getElementById('history-list'), entries, currentId, {
    onOpen: entry => { openEntry(entry); closeDrawers(); },
    onDelete: removeEntry,
  });
  renderCalendar(document.getElementById('calendar'), entries, calMonth, currentId, {
    onPickDay: entry => { openEntry(entry); closeDrawers(); },
    onMonth: m => { calMonth = m; renderSidebars(); },
  });
}

async function startNewEntry() {
  clearTimeout(saveTimer);
  await persist();
  clearSession();
  currentId = null; currentCreatedAt = null;
  showDate(new Date());
  renderSidebars();
  closeDrawers();
  document.getElementById('writer').focus();
}

async function openEntry(entry) {
  if (entry.id === currentId) return;
  clearTimeout(saveTimer);
  await persist();
  clearSession();
  currentId = entry.id; currentCreatedAt = entry.createdAt;
  const writer = document.getElementById('writer');
  writer.value = entry.text;
  prevText = entry.text;
  completedCount = entry.completedCount || 0;
  enterCount = entry.enterCount || 0;
  sessionTracks = (entry.tracks || []).map(t => t ? { ...t, profile: MOODS[t.moodData?.mood] || MOODS.neutral } : null);

  // Restore progress: ring, bars (replayable), title, banner, counts
  const done = Math.min(completedCount, GOAL);
  for (let i = 0; i < done; i++) {
    pips[i].classList.add(pipCls[i]);
    if (sessionTracks[i]) {
      pips[i].classList.add('done');
      pips[i].title = `replay paragraph ${i+1} — ${sessionTracks[i].moodData.mood}`;
    }
  }
  if (done) updateRing(done);
  if (sessionTracks.some(Boolean)) document.getElementById('pip-hint').classList.add('visible');
  const titles = ['Start writing.','First paragraph done.','Two down. One more to go.','Morning frequency complete.'];
  document.getElementById('progress-title').textContent = titles[done];
  if (completedCount >= GOAL) document.getElementById('goal-banner').classList.add('show');
  const words = entry.text.trim().split(/\s+/).filter(Boolean).length;
  document.getElementById('word-count').textContent = words + ' word' + (words!==1?'s':'');
  const paras = (entry.text.match(/^[^\n]*\S[^\n]*\n/gm) || []).length;
  document.getElementById('para-count-meta').textContent = paras + ' paragraph' + (paras!==1?'s':'') + ' detected';
  const isToday = dayKey(entry.createdAt) === dayKey(new Date());
  notifTxt.textContent = isToday ? 'welcome back — keep writing' : 'reopened ' + new Date(entry.createdAt).toLocaleDateString('en-US',{month:'long',day:'numeric'}) + ' — click a bar to hear it';
  showDate(entry.createdAt);
  calMonth = new Date(new Date(entry.createdAt).getFullYear(), new Date(entry.createdAt).getMonth(), 1);
  renderSidebars();
}

async function removeEntry(entry) {
  if (!confirm('Delete this entry? This can\'t be undone.')) return;
  entries = await deleteEntry(entry.id);
  if (entry.id === currentId) {
    clearSession();
    currentId = null; currentCreatedAt = null;
    showDate(new Date());
  }
  renderSidebars();
}

document.getElementById('reset-btn').addEventListener('click', startNewEntry);
document.getElementById('new-entry-btn').addEventListener('click', startNewEntry);

// Save if the app is closed or sent to the background mid-sentence
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(saveTimer); persist(); } });

// ─── Drawers (phones and narrow windows) ──────────────────────────────────────
const backdrop = document.getElementById('drawer-backdrop');
function openDrawer(id) {
  closeDrawers();
  document.getElementById(id).classList.add('open');
  backdrop.classList.add('show');
}
function closeDrawers() {
  document.querySelectorAll('.drawer.open').forEach(d => d.classList.remove('open'));
  backdrop.classList.remove('show');
}
document.getElementById('open-history').addEventListener('click', () => openDrawer('history'));
document.getElementById('open-calendar').addEventListener('click', () => openDrawer('calendar-panel'));
backdrop.addEventListener('click', closeDrawers);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawers(); });

// ─── Finish session + download ────────────────────────────────────────────────
// Files are prepared when the panel opens, so sharing still counts as a direct click
let prepared = {};
function prepareFiles() {
  prepared = {
    docx: makeDocxBlob(),
    pdf: makePdfBlob(),
    wav: sessionTracks.some(Boolean) ? makeWavBlob(sessionTracks) : null,
  };
  Object.values(prepared).forEach(pr => pr && pr.catch(() => {}));
  holdUntilReady(['download-docx'], prepared.docx);
  holdUntilReady(['download-pdf', 'share-writing'], prepared.pdf);
  if (prepared.wav) holdUntilReady(['download-wav', 'share-music'], prepared.wav);
}

function holdUntilReady(ids, promise) {
  const btns = ids.map(id => document.getElementById(id));
  btns.forEach(b => { b.dataset.label = b.dataset.label || b.textContent; b.disabled = true; b.textContent = 'preparing...'; });
  promise.finally(() => btns.forEach(b => { b.disabled = false; b.textContent = b.dataset.label; }));
}

function wireButton(id, fn) {
  const btn = document.getElementById(id);
  btn.addEventListener('click', async () => {
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'preparing...';
    try { await fn(); }
    catch (e) {
      if (e && e.name !== 'AbortError') alert('That didn\'t work — check your internet connection and try again.');
    }
    finally { btn.disabled = false; btn.textContent = label; }
  });
}
wireButton('download-docx', async () => saveBlob(await prepared.docx, sessionFilename('docx')));
wireButton('download-pdf',  async () => saveBlob(await prepared.pdf,  sessionFilename('pdf')));
wireButton('download-wav',  async () => saveBlob(await prepared.wav,  sessionFilename('wav')));
wireButton('share-writing', async () => shareFile(await prepared.pdf, sessionFilename('pdf'), 'application/pdf'));
wireButton('share-music',   async () => shareFile(await prepared.wav, sessionFilename('wav'), 'audio/wav'));

// Show "save to cloud / share" only where the device has a share menu that accepts files
if (canShareFiles([new File(['x'], 'test.pdf', { type: 'application/pdf' })])) {
  document.querySelectorAll('.share-btn').forEach(b => b.classList.add('available'));
}

document.getElementById('finish-btn').addEventListener('click', () => {
  const paras = sessionParagraphs();
  if (!paras.length) {
    document.getElementById('writer').focus();
    notifTxt.textContent = 'write something first, then finish your session';
    return;
  }
  const words = paras.join(' ').split(/\s+/).filter(Boolean).length;
  document.getElementById('finish-sub').textContent =
    paras.length + ' paragraph' + (paras.length!==1?'s':'') + ', ' + words + ' word' + (words!==1?'s':'') + ' — download your writing and music, or save them to the cloud.';
  const hasMusic = sessionTracks.some(Boolean);
  document.getElementById('download-wav').disabled = !hasMusic;
  document.getElementById('share-music').disabled = !hasMusic;
  document.getElementById('finish-note').textContent = hasMusic
    ? (document.querySelector('.share-btn.available') ? '"save to cloud / share" opens your device\'s share menu — iCloud Drive, Google Drive, Dropbox, email and more.' : '')
    : 'No music yet — press Enter twice after a paragraph to create some.';
  prepareFiles();
  const panel = document.getElementById('finish-panel');
  panel.classList.add('show');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

(async () => {
  entries = await loadEntries();
  const today = entries.find(e => dayKey(e.createdAt) === dayKey(new Date()));
  if (today) await openEntry(today); else renderSidebars();
})();

// Desktop: start with the cursor in the writing box. Phones: don't, or the keyboard
// pops up and scrolls past the instructions before anyone reads them.
if (!window.matchMedia('(pointer: coarse)').matches) document.getElementById('writer').focus();
