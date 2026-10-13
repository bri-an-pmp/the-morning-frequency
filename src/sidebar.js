// Left: entry history (like a chat history). Right: calendar of days with entries.
import { moodProfile } from './moods.js';
import { dayKey, entryTitle } from './journal.js';
import { STREAK_MILESTONES } from './audio.js';
import { t, tn, LOCALE } from './i18n.js';

const DAY_MS = 86400000;

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

function groupLabel(createdAt, now = new Date()) {
  const days = Math.round((startOfDay(now) - startOfDay(createdAt)) / DAY_MS);
  if (days <= 0) return t('today');
  if (days === 1) return t('yesterday');
  if (days < 7) return t('prev7');
  if (days < 30) return t('prev30');
  return new Date(createdAt).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
}

function moodColor(entry) {
  const mood = entry.tracks?.find(Boolean)?.moodData?.mood;
  return mood ? moodProfile(mood).color : null;
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

// ─── History list ─────────────────────────────────────────────────────────────
export function renderHistory(listEl, entries, activeId, { onOpen, onDelete }) {
  listEl.replaceChildren();
  if (!entries.length) {
    listEl.append(el('p', 'history-empty', t('historyEmpty')));
    return;
  }
  let lastGroup = null;
  for (const entry of entries) {
    const group = groupLabel(entry.createdAt);
    if (group !== lastGroup) { listEl.append(el('div', 'history-group', group)); lastGroup = group; }

    const row = el('div', 'history-row' + (entry.id === activeId ? ' active' : ''));
    const open = el('button', 'history-item');
    open.type = 'button';
    open.append(el('span', 'history-title', entryTitle(entry)));
    const meta = el('span', 'history-meta');
    const when = new Date(entry.createdAt);
    const days = Math.round((startOfDay(new Date()) - startOfDay(when)) / DAY_MS);
    meta.append(el('span', null, days < 7
      ? when.toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' }) + (days > 1 ? ' · ' + when.toLocaleDateString(LOCALE, { weekday: 'short' }) : '')
      : when.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' })));
    const dots = el('span', 'history-dots');
    (entry.tracks || []).filter(Boolean).slice(0, 5).forEach(tr => {
      const dot = el('i', 'mood-dot');
      dot.style.background = moodProfile(tr.moodData?.mood).color;
      dot.title = tr.moodData?.mood || '';
      dots.append(dot);
    });
    meta.append(dots);
    open.append(meta);
    open.addEventListener('click', () => onOpen(entry));

    const del = el('button', 'history-delete', '×');
    del.type = 'button';
    del.title = t('deleteEntry');
    del.setAttribute('aria-label', t('deleteEntryNamed', { title: entryTitle(entry) }));
    del.addEventListener('click', () => onDelete(entry));

    row.append(open, del);
    listEl.append(row);
  }
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
// The days (as "YYYY-MM-DD") in the current streak, newest first
function streakDayKeys(entries, now = new Date()) {
  const days = new Set(entries.map(e => dayKey(e.createdAt)));
  // Step back one calendar day at a time. (Subtracting 24 hours skips a day when the clocks
  // spring forward, which wrongly broke streaks once a year.)
  const d = startOfDay(now);
  const back = () => d.setDate(d.getDate() - 1);
  if (!days.has(dayKey(d))) back();   // today not written yet doesn't break the streak
  const keys = [];
  while (days.has(dayKey(d)) && keys.length < 10000) { keys.push(dayKey(d)); back(); }
  return keys;
}

export function streakDays(entries, now = new Date()) {
  return streakDayKeys(entries, now).length;
}

// Every entry written during the current streak
export function streakEntries(entries, now = new Date()) {
  const keys = new Set(streakDayKeys(entries, now));
  return entries.filter(e => keys.has(dayKey(e.createdAt)));
}

// The biggest milestone reached (3, 5, 10, 14, 21, 30) or null
export function reachedMilestone(streak) {
  return STREAK_MILESTONES.filter(m => m <= streak).pop() || null;
}

export function renderCalendar(root, entries, month, activeId, { onPickDay, onMonth, onStreak }) {
  const byDay = new Map();
  entries.forEach(e => { const k = dayKey(e.createdAt); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(e); });
  const activeDay = entries.find(e => e.id === activeId);

  root.replaceChildren();
  const head = el('div', 'cal-head');
  const prev = el('button', 'cal-nav', '‹'); prev.type = 'button'; prev.setAttribute('aria-label', t('prevMonth'));
  const next = el('button', 'cal-nav', '›'); next.type = 'button'; next.setAttribute('aria-label', t('nextMonth'));
  prev.addEventListener('click', () => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)));
  next.addEventListener('click', () => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)));
  head.append(prev, el('div', 'cal-title', month.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })), next);
  root.append(head);

  const grid = el('div', 'cal-grid');
  t('weekdays').split(',').forEach(w => grid.append(el('div', 'cal-weekday', w)));
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  for (let i = 0; i < first.getDay(); i++) grid.append(el('div', 'cal-blank'));
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayKey = dayKey(new Date());
  let monthCount = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    const key = dayKey(date);
    const dayEntries = byDay.get(key) || [];
    monthCount += dayEntries.length;
    const cell = el('button', 'cal-day');
    cell.type = 'button';
    cell.append(el('span', 'cal-num', String(day)));
    if (key === todayKey) { cell.classList.add('today'); cell.setAttribute('aria-current', 'date'); }
    if (activeDay && dayKey(activeDay.createdAt) === key) cell.classList.add('selected');
    if (dayEntries.length) {
      cell.classList.add('has-entry');
      const dot = el('i', 'cal-dot');
      dot.style.background = moodColor(dayEntries[0]) || 'var(--accent1)';
      cell.append(dot);
      const label = date.toLocaleDateString(LOCALE, { weekday: 'long', month: 'long', day: 'numeric' });
      cell.setAttribute('aria-label', tn('dayEntries', dayEntries.length, { date: label }));
      cell.addEventListener('click', () => onPickDay(dayEntries[0]));
    } else {
      cell.disabled = true;
    }
    grid.append(cell);
  }
  root.append(grid);

  const streak = streakDays(entries);
  const stats = el('div', 'cal-stats');
  stats.append(el('div', 'cal-stat', streak ? tn('streak', streak) : t('startStreak')));
  const nextMilestone = STREAK_MILESTONES.find(m => m > streak);
  if (nextMilestone) stats.append(el('div', 'cal-stat-sub', t('nextStreakSound', { n: nextMilestone })));
  if (reachedMilestone(streak)) {
    const mix = el('button', 'cal-streak-mix', t('playYourStreakMix'));
    mix.type = 'button';
    mix.addEventListener('click', () => onStreak());
    stats.append(mix);
  }
  stats.append(el('div', 'cal-stat-sub', tn('entriesIn', monthCount, { month: month.toLocaleDateString(LOCALE, { month: 'long' }) })));
  root.append(stats);
}
