import '@fontsource/dm-serif-display/400.css';
import '@fontsource/dm-serif-display/400-italic.css';
import '@fontsource/dm-mono/300.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import './styles.css';
import { MOODS, MOOD_MEANINGS, DEFAULT_MOOD, moodProfile, analyzeMood, describeKey } from './moods.js';
import { ctx, playMoodMusic, playStreakMusic, STREAK_SOUNDS, updateFx } from './audio.js';
import {
  sessionParagraphs, sessionFilename, datedFilename, setSessionMeta, saveBlob, canShareFiles,
  makeDocxBlob, makePdfBlob, makeWavBlob, makeStreakWavBlob, STREAK_MIX_MAX, shareFile,
} from './export.js';
import { loadEntries, saveEntry, deleteEntry, newEntryId, dayKey } from './journal.js';
import { renderHistory, renderCalendar, streakDays, streakEntries, reachedMilestone } from './sidebar.js';
import { makeStory } from './story.js';
import { initCircle, keyForStep, setCircleStep } from './circle.js';
import { initThemes, followMood, readable } from './theme.js';
import { initVoice } from './voice.js';
import { notesText, notesStarted, saveToNotes } from './notes.js';

// ─── State ────────────────────────────────────────────────────────────────────
let completedCount = 0;
let isManualOverride = false;
let manualMood = null;
let apiKey = localStorage.getItem('pm_api_key') || '';
const GOAL = 3;

function showKeyStatus(text, cls = '') {
  const el = document.getElementById('key-status');
  el.textContent = text;
  el.className = 'key-status' + (cls ? ' ' + cls : '');
  document.getElementById('remove-key-btn').hidden = !apiKey;
}
if (apiKey) {
  document.getElementById('api-key-input').value = apiKey;
  showKeyStatus('Saved — Claude is reading the mood of your writing.', 'ok');
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

function showMoodResult(moodData, key = null) {
  analyzingEl.classList.remove('visible');
  const p = moodProfile(moodData.mood);
  moodBadge.textContent = p.label;
  moodBadge.className = 'mood-badge visible';
  moodBadge.style.setProperty('--mood-color', readable(p.color));
  followMood(p.label);
  const desc = key ? describeKey(p, key) + ' · ' + p.desc.split(' · ').slice(2).join(' · ') : p.desc;
  moodParam.textContent = desc + (moodData.reason ? ` — "${moodData.reason}"` : '');
  moodParam.classList.add('visible');
}

// Replay bars are real buttons, so they work with a keyboard and are read out by screen readers
function markPipDone(i, mood) {
  pips[i].classList.add('done');
  pips[i].disabled = false;
  pips[i].title = `replay paragraph ${i+1} — ${mood}`;
  pips[i].setAttribute('aria-label', `Replay paragraph ${i+1}, ${mood}`);
}
function resetPips() {
  pips.forEach((p, i) => {
    p.className = 'para-pip';
    p.disabled = true;
    p.removeAttribute('title');
    p.setAttribute('aria-label', `Paragraph ${i+1}, not written yet`);
  });
}

function updateRing(n) {
  document.getElementById('ring-count').setAttribute('aria-label', `${n} of ${GOAL} paragraphs written`);
  ringEl.style.strokeDashoffset = 226 * (1 - n/GOAL);
  countEl.textContent = n;
  ringEl.style.stroke = ['var(--accent1)','var(--accent2)','var(--accent3)'][n-1];
}

function setWave(color, on) {
  allWaveBars.forEach(b => { b.style.background = color; b.classList.toggle('animating', on); });
}

// ─── Reward trigger ───────────────────────────────────────────────────────────
// index: paragraph number toward the goal (null for an Enter on a blank line)
// edit: true when an earlier paragraph was changed — its mood and music are redone in place
async function triggerReward(paraText, index, playIndex, edit = false) {
  ctx(); // wake audio context
  showAnalyzing(true);
  const gen = sessionGen;

  let moodData;
  if (isManualOverride && manualMood) {
    const p = MOODS[manualMood];
    moodData = { mood:manualMood, energy:p.energy, valence:p.valence, reason:'manual' };
  } else if (index === null) {
    // A blank-line Enter replays the latest paragraph's mood — no need to ask Claude (or pay) again
    const last = sessionTracks.filter(Boolean).pop();
    moodData = last ? { ...last.moodData, reason: 'blank line' }
      : { mood:DEFAULT_MOOD, energy:MOODS[DEFAULT_MOOD].energy, valence:MOODS[DEFAULT_MOOD].valence, reason:'blank line' };
  } else {
    moodData = await analyzeMood(paraText, apiKey);
  }
  if (gen !== sessionGen) return;
  if (moodData.apiError) {
    // Don't fail silently: say why Claude wasn't used this time
    showKeyStatus(`Claude wasn't used just now (${moodData.apiError}), so word matching picked the mood.`, 'err');
    delete moodData.apiError;
  }

  const profile = moodProfile(moodData.mood);
  // Circle of fifths: each paragraph takes the next key round the circle. An edited paragraph
  // keeps its key; a blank-line Enter replays the latest paragraph's key.
  const key = edit && sessionTracks[index] ? (sessionTracks[index].key || null)
    : keyForStep(index !== null ? index : Math.max(0, completedCount - 1));
  showMoodResult(moodData, key);

  const onGoal = index !== null && index < GOAL;
  if (onGoal) {
    pips[index].classList.add(pipCls[index]);
    if (!edit) updateRing(index + 1);
  }

  notifEl.className = 'notif playing';
  notifEl.style.setProperty('--notif-color', profile.color);
  setWave(profile.color, true);

  const msgs = ['♩ paragraph 1 unlocked','♩♩ paragraph 2 unlocked','♩♩♩ morning complete'];
  notifTxt.textContent = edit ? `♩ paragraph ${index+1} updated`
    : onGoal ? msgs[index] : (index === null ? '♩ new line' : `♩ paragraph ${index+1}`);
  const titles = ['First paragraph done.','Two down. One more to go.','Morning frequency complete.'];
  if (onGoal && !edit) document.getElementById('progress-title').textContent = titles[index];

  // Paragraph 3 gets the finale; everything else cycles through the regular voicings
  // An edited paragraph keeps its original voicing
  const musicIndex = edit && sessionTracks[index] ? sessionTracks[index].musicIndex
    : index === 2 ? 2 : (playIndex % 3 === 2 ? 3 : playIndex % 3);
  if (index !== null) { sessionTracks[index] = { profile, musicIndex, moodData, key }; scheduleSave(0); }
  setCircleStep(completedCount);
  if (onGoal) {
    markPipDone(index, profile.label);
    document.getElementById('pip-hint').classList.add('visible');
  }
  const token = ++playToken;
  playMoodMusic(profile, musicIndex, undefined, key);
  if (index !== null && !edit) checkStreakMilestone(gen);

  if (index === 2 && !edit) setTimeout(() => document.getElementById('goal-banner').classList.add('show'), 900);

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
document.getElementById('writer').addEventListener('keydown', e => {
  ctx();
  // Holding Enter down would fire dozens of pieces of music a second and overload the audio
  if (e.key === 'Enter' && e.repeat) e.preventDefault();
});

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
  showMoodResult(t.moodData, t.key);
  notifEl.className = 'notif playing';
  notifEl.style.setProperty('--notif-color', t.profile.color);
  notifTxt.textContent = `♩ replaying paragraph ${i+1}`;
  setWave(t.profile.color, true);
  const token = ++playToken;
  playMoodMusic(t.profile, t.musicIndex, undefined, t.key || null);
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
  if (justFinished) {
    // Which paragraph is this? Count the lines with text up to the cursor. If it's one that
    // was already counted (the writer went back to edit it), redo that one instead of adding a new one.
    const position = before.filter(l => l.trim()).length - 1;
    if (position < completedCount) {
      triggerReward(justFinished, position, enterCount++, true);
    } else {
      triggerReward(justFinished, completedCount, enterCount++);
      completedCount++;
    }
  } else {
    triggerReward('', null, enterCount++);
  }
});

// ─── Settings ─────────────────────────────────────────────────────────────────
document.getElementById('settings-toggle').addEventListener('click', toggleSettings);
document.getElementById('save-key-btn').addEventListener('click', saveApiKey);
document.getElementById('remove-key-btn').addEventListener('click', removeApiKey);
document.getElementById('manual-override-toggle').addEventListener('change', e => toggleManualOverride(e.target.checked));
// One button per mood, with what it means on hover
document.querySelector('.mood-buttons').append(...Object.values(MOODS).map(p => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mood-btn';
  btn.dataset.mood = p.label;
  btn.textContent = p.label;
  btn.title = MOOD_MEANINGS[p.label] + ' — ' + p.desc;
  btn.style.setProperty('--mood-color', readable(p.color));
  return btn;
}));
document.querySelectorAll('.mood-btn').forEach(btn => btn.addEventListener('click', () => selectMood(btn)));
document.getElementById('tempo-offset').addEventListener('input', e => {
  document.getElementById('tempo-val').textContent = (e.target.value > 0 ? '+' : '') + e.target.value;
});
// Reverb and delay: remembered between visits, and applied straight away
['reverb-amt', 'delay-amt'].forEach(id => {
  const el = document.getElementById(id), label = document.getElementById(id + '-val');
  try { const saved = localStorage.getItem('tmf_' + id); if (saved !== null && /^\d{1,3}$/.test(saved)) el.value = saved; } catch (e) { /* default */ }
  label.textContent = el.value + '%';
  el.addEventListener('input', () => {
    label.textContent = el.value + '%';
    try { localStorage.setItem('tmf_' + id, el.value); } catch (e) { /* not essential */ }
    updateFx();
  });
});
document.getElementById('volume').addEventListener('input', e => {
  document.getElementById('volume-val').textContent = e.target.value + '%';
});

function toggleSettings() {
  const btn = document.getElementById('settings-toggle');
  btn.classList.toggle('open');
  btn.setAttribute('aria-expanded', document.getElementById('settings-panel').classList.toggle('open') ? 'true' : 'false');
}

// Text size: normal, large or extra large, remembered between visits
function setTextSize(ts) {
  document.documentElement.style.setProperty('--ts', ts);
  document.querySelectorAll('.ts-btn').forEach(b => b.setAttribute('aria-pressed', b.dataset.ts === ts ? 'true' : 'false'));
  try { localStorage.setItem('tmf_text_size', ts); } catch (e) { /* not essential */ }
}
document.querySelectorAll('.ts-btn').forEach(b => b.addEventListener('click', () => setTextSize(b.dataset.ts)));
try { const ts = localStorage.getItem('tmf_text_size'); if (['1', '1.2', '1.4'].includes(ts)) setTextSize(ts); } catch (e) { /* default */ }

function saveApiKey() {
  const val = document.getElementById('api-key-input').value.trim();
  if (!val || !val.startsWith('sk-')) {
    showKeyStatus('That doesn\'t look like a Claude key — it should start with sk-ant-. Copy it again from console.anthropic.com.', 'err');
    return;
  }
  apiKey = val;
  localStorage.setItem('pm_api_key', val);
  showKeyStatus('Saved — Claude is reading the mood of your writing.', 'ok');
}

function removeApiKey() {
  apiKey = '';
  localStorage.removeItem('pm_api_key');
  document.getElementById('api-key-input').value = '';
  showKeyStatus('Removed — back to word matching.');
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
  titleEl.value = '';
  completedCount = 0; enterCount = 0; sessionTracks = []; prevText = '';
  resetPips();
  document.getElementById('ring-count').setAttribute('aria-label', `0 of ${GOAL} paragraphs written`);
  document.getElementById('pip-hint').classList.remove('visible');
  countEl.textContent = '0'; ringEl.style.strokeDashoffset = '226'; ringEl.style.stroke = 'var(--accent1)';
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
  setCircleStep(0);
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

// ─── Entry name ───────────────────────────────────────────────────────────────
const titleEl = document.getElementById('entry-title');
function syncMeta() {
  setSessionMeta({ date: new Date(currentCreatedAt || Date.now()), title: titleEl.value.trim() });
}
let reprepareTimer = null;
titleEl.addEventListener('input', () => {
  syncMeta();
  scheduleSave();
  // Downloads already prepared carry the old name inside the document — redo them
  if (document.getElementById('finish-panel').classList.contains('show')) {
    clearTimeout(reprepareTimer);
    reprepareTimer = setTimeout(prepareFiles, 500);
  }
});
// Return in the name box jumps down to the writing
titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('writer').focus(); } });

async function persist() {
  const text = document.getElementById('writer').value;
  const title = titleEl.value.trim();
  if (!text.trim() && !title) return;             // nothing worth keeping yet
  if (!currentId) { currentId = newEntryId(); currentCreatedAt = new Date().toISOString(); }
  entries = await saveEntry({
    id: currentId,
    createdAt: currentCreatedAt,
    updatedAt: new Date().toISOString(),
    title,
    text,
    completedCount,
    enterCount,
    tracks: sessionTracks.map(t => t ? { musicIndex: t.musicIndex, moodData: t.moodData, key: t.key || null } : null),
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
    onStreak: () => { closeDrawers(); openStreakPanel(streakDays(entries)); },
  });
}

// ─── Streaks ──────────────────────────────────────────────────────────────────
// Reaching 3, 5, 10, 14, 21 or 30 days in a row plays that milestone's own sound (once),
// then offers the streak mix: every paragraph's music from the whole streak in one piece.
async function checkStreakMilestone(gen) {
  clearTimeout(saveTimer);
  await persist();
  if (gen !== sessionGen || !currentCreatedAt || dayKey(currentCreatedAt) !== dayKey(new Date())) return;
  const streak = streakDays(entries);
  if (!STREAK_SOUNDS[streak]) return;
  const mark = dayKey(new Date()) + ':' + streak;
  try {
    if (localStorage.getItem('tmf_streak_celebrated') === mark) return;
    localStorage.setItem('tmf_streak_celebrated', mark);
  } catch (e) { /* celebrate anyway */ }
  // Let the paragraph's own music ring first
  setTimeout(() => {
    const token = ++playToken;
    playStreakMusic(streak);
    notifEl.className = 'notif playing';
    notifEl.style.setProperty('--notif-color', '#a77a1f');
    setWave('#d4a531', true);
    notifTxt.textContent = `✦ ${streak}-day streak — ${STREAK_SOUNDS[streak].name}`;
    setTimeout(() => { if (token === playToken) { setWave('#d4a531', false); notifEl.classList.remove('playing'); } }, 7000);
    openStreakPanel(streak);
  }, 5000);
}

const streakEls = {
  panel: document.getElementById('streak-panel'),
  title: document.getElementById('streak-title'),
  sub: document.getElementById('streak-sub'),
  play: document.getElementById('streak-play'),
  download: document.getElementById('streak-download'),
  share: document.getElementById('streak-share'),
};
let streakMix = null;        // Promise<Blob>
let streakSource = null;     // the streak mix while it's playing

function stopStreakMix() {
  if (streakSource) { try { streakSource.stop(); } catch (e) {} streakSource = null; }
  streakEls.play.textContent = 'play streak mix';
}

function openStreakPanel(streak) {
  const milestone = reachedMilestone(streak);
  if (!milestone) return;
  stopStreakMix();
  const inStreak = streakEntries(entries);
  const paras = inStreak.reduce((n, e) => n + (e.tracks || []).filter(Boolean).length, 0);
  streakEls.title.textContent = `✦ ${streak}-day streak · ${STREAK_SOUNDS[milestone].name}`;
  streakEls.sub.textContent = paras > STREAK_MIX_MAX
    ? `Your reward: your streak's frequencies in one piece — the latest ${STREAK_MIX_MAX} of your ${paras} paragraphs over ${streak} days — ending with your ${milestone}-day streak sound.`
    : `Your reward: every frequency from your streak — ${paras} paragraph${paras !== 1 ? 's' : ''} over ${streak} days — in one piece, ending with your ${milestone}-day streak sound.`;
  const btns = [streakEls.play, streakEls.download, streakEls.share];
  btns.forEach(b => { b.disabled = true; });
  streakEls.play.textContent = 'preparing...';
  streakMix = makeStreakWavBlob(inStreak, milestone, (done, total) => {
    streakEls.play.textContent = `preparing... ${Math.round(done / total * 100)}%`;
  });
  streakMix
    .then(() => { streakEls.play.textContent = 'play streak mix'; })
    .catch(e => { console.error(e); streakEls.play.textContent = 'couldn\'t prepare the mix'; })
    .finally(() => btns.forEach(b => { b.disabled = false; }));
  streakEls.panel.classList.add('show');
  streakEls.panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

streakEls.play.addEventListener('click', async () => {
  if (streakSource) { stopStreakMix(); return; }
  const c = ctx();
  const buffer = await c.decodeAudioData(await (await streakMix).arrayBuffer());
  const gain = c.createGain();
  gain.gain.value = 0.8 * parseInt(document.getElementById('volume').value) / 100;
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.connect(gain); gain.connect(c.destination);
  src.onended = () => { if (streakSource === src) stopStreakMix(); };
  streakSource = src;
  src.start();
  streakEls.play.textContent = 'stop';
});
document.getElementById('streak-close').addEventListener('click', () => {
  stopStreakMix();
  streakEls.panel.classList.remove('show');
});
function streakFilename() { return datedFilename(new Date(), `${streakDays(entries)}-day streak mix`, 'wav'); }
streakEls.download.addEventListener('click', async () => saveBlob(await streakMix, streakFilename()));
streakEls.share.addEventListener('click', async () => {
  try { await shareFile(await streakMix, streakFilename(), 'audio/wav'); }
  catch (e) { if (e && e.name !== 'AbortError') alert('That didn\'t work — try download instead.'); }
});

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
  titleEl.value = entry.title || '';
  syncMeta();
  prevText = entry.text;
  completedCount = entry.completedCount || 0;
  enterCount = entry.enterCount || 0;
  setCircleStep(completedCount);
  sessionTracks = (entry.tracks || []).map(t => t ? { ...t, profile: moodProfile(t.moodData?.mood) } : null);

  // Restore progress: ring, bars (replayable), title, banner, counts
  const done = Math.min(completedCount, GOAL);
  for (let i = 0; i < done; i++) {
    pips[i].classList.add(pipCls[i]);
    if (sessionTracks[i]) {
      markPipDone(i, sessionTracks[i].profile.label);
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
  if (entry.id === currentId) {
    // Clear the page first, so a pending autosave can't bring the deleted entry back
    clearTimeout(saveTimer);
    clearSession();
    currentId = null; currentCreatedAt = null;
    showDate(new Date());
  }
  entries = await deleteEntry(entry.id);
  renderSidebars();
}

// Another tab saved or deleted an entry: refresh the lists so they match
window.addEventListener('storage', async e => {
  if (e.key !== 'CapacitorStorage.tmf_entries') return;
  entries = await loadEntries();
  renderSidebars();
});

// Reset: a clean slate. Erases this entry (writing, name and music) instead of keeping it,
// which is the difference from "new entry". Other entries and settings aren't touched.
async function resetEntry() {
  const writer = document.getElementById('writer');
  const hasContent = writer.value.trim() || titleEl.value.trim() || completedCount > 0;
  if (!hasContent) { writer.focus(); return; }
  if (!confirm('Start with a clean slate?\n\nThis erases this entry\'s writing, name and music. Your other entries aren\'t touched.')) return;
  clearTimeout(saveTimer);
  const id = currentId;
  clearSession();
  currentId = null; currentCreatedAt = null;
  showDate(new Date());
  if (id) entries = await deleteEntry(id);
  renderSidebars();
  notifTxt.textContent = 'clean slate — start writing whenever you\'re ready';
  writer.focus();
}
document.getElementById('clear-btn').addEventListener('click', resetEntry);
document.getElementById('new-entry-bottom').addEventListener('click', startNewEntry);
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

// ─── Share to story (Instagram / TikTok / Facebook) ───────────────────────────
const storyEls = {
  section: document.getElementById('story-section'),
  line: document.getElementById('story-line'),
  make: document.getElementById('make-story'),
  result: document.getElementById('story-result'),
  video: document.getElementById('story-preview'),
  image: document.getElementById('story-image'),
  share: document.getElementById('share-story'),
  download: document.getElementById('download-story'),
  note: document.getElementById('story-note'),
};
let story = null;   // { blob, ext, type, url }

function resetStory() {
  if (story) URL.revokeObjectURL(story.url);
  story = null;
  storyEls.result.classList.remove('show');
  storyEls.video.classList.remove('show'); storyEls.video.removeAttribute('src');
  storyEls.image.classList.remove('show'); storyEls.image.removeAttribute('src');
  storyEls.make.textContent = 'make story video';
}

// Editing the line after making the video means the video needs remaking
storyEls.line.addEventListener('input', () => { if (story) { resetStory(); storyEls.make.textContent = 'remake story video'; } });

storyEls.make.addEventListener('click', async () => {
  resetStory();
  const gen = sessionGen;
  storyEls.make.disabled = true; storyEls.line.disabled = true;
  storyEls.make.textContent = 'making your video...';
  try {
    const date = new Date(currentCreatedAt || Date.now()).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const made = await makeStory(sessionTracks, {
      date,
      line: storyEls.line.value.trim(),
      onProgress: p => { storyEls.make.textContent = `making your video... ${Math.round(p * 100)}%`; },
    });
    if (gen !== sessionGen) { storyEls.make.textContent = 'make story video'; return; }   // switched entries meanwhile
    story = { ...made, url: URL.createObjectURL(made.blob) };
    const isVideo = made.type.startsWith('video/');
    const preview = isVideo ? storyEls.video : storyEls.image;
    preview.src = story.url;
    preview.classList.add('show');
    storyEls.download.textContent = isVideo ? 'download video' : 'download picture';
    const canShare = canShareFiles([new File([made.blob], sessionFilename(made.ext), { type: made.type })]);
    storyEls.share.style.display = canShare ? '' : 'none';
    storyEls.note.textContent = canShare
      ? 'Tap "share to story", choose Instagram, TikTok or Facebook, then pick Story.'
      : 'Download it, then post it to your story from your phone.';
    if (!isVideo) storyEls.note.textContent += ' (This browser can\'t make videos, so you get a picture instead.)';
    storyEls.result.classList.add('show');
    storyEls.make.textContent = 'remake story video';
    storyEls.result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    console.error(e);
    storyEls.make.textContent = 'make story video';
    alert(e && e.name === 'StoryInterrupted'
      ? 'The video stopped because you left this screen. Keep the app open for the 20 seconds it takes, then tap make story video again.'
      : 'Sorry, the video couldn\'t be made on this device. Try again, or use a different browser.');
  } finally {
    storyEls.make.disabled = false; storyEls.line.disabled = false;
  }
});

wireButton('share-story', async () => {
  const files = [new File([story.blob], sessionFilename(story.ext), { type: story.type })];
  await navigator.share({ files });
});
wireButton('download-story', async () => saveBlob(story.blob, sessionFilename(story.ext)));

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
  storyEls.section.classList.toggle('show', hasMusic);
  resetStory();
  syncMeta();
  showNotesHelp();
  prepareFiles();
  const panel = document.getElementById('finish-panel');
  panel.classList.add('show');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

initCircle();
initThemes();
initVoice();

// ─── Save to Apple Notes ──────────────────────────────────────────────────────
const notesHelp = document.getElementById('notes-help');
function showNotesHelp() {
  notesHelp.textContent = notesStarted()
    ? 'Tap the button, choose Notes, then tap where it says “New Note” and pick your Morning Frequency note. Today is added underneath, with its own date and title.'
    : 'Tap the button and choose Notes to start your Morning Frequency note. On later days, pick that same note instead of “New Note” and each day is added underneath.';
}
document.getElementById('save-notes').addEventListener('click', async () => {
  const btn = document.getElementById('save-notes');
  const moods = [...new Set(sessionTracks.filter(Boolean).map(t => t.profile.label))];
  const text = notesText({
    date: new Date(currentCreatedAt || Date.now()),
    title: titleEl.value.trim(),
    paragraphs: sessionParagraphs(),
    moods,
  });
  btn.disabled = true;
  try {
    const how = await saveToNotes(text);
    notesHelp.textContent = how === 'copied'
      ? 'Copied. Open Notes, open your Morning Frequency note, tap at the very bottom and paste.'
      : 'Sent. If you picked your Morning Frequency note, today is now at the bottom of it.';
  } catch (e) {
    if (!e || e.name !== 'AbortError') notesHelp.textContent = 'That didn’t work. Try again, or use download pdf.';
  } finally {
    btn.disabled = false;
  }
});

(async () => {
  entries = await loadEntries();
  const today = entries.find(e => dayKey(e.createdAt) === dayKey(new Date()));
  if (today) await openEntry(today); else renderSidebars();
})();

// Desktop: start with the cursor in the writing box. Phones: don't, or the keyboard
// pops up and scrolls past the instructions before anyone reads them.
if (!window.matchMedia('(pointer: coarse)').matches) document.getElementById('writer').focus();
