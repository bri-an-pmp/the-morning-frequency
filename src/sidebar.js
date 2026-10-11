// Left: entry history (like a chat history). Right: calendar of days with entries.
import { MOODS } from './moods.js';
import { dayKey, entryTitle } from './journal.js';

const DAY_MS = 86400000;

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

function groupLabel(createdAt, now = new Date()) {
  const days = Math.round((startOfDay(now) - startOfDay(createdAt)) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'Previous 7 days';
  if (days < 30) return 'Previous 30 days';
  return new Date(createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function moodColor(entry) {
  const mood = entry.tracks?.find(Boolean)?.moodData?.mood;
  return mood && MOODS[mood] ? MOODS[mood].color : null;
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
    listEl.append(el('p', 'history-empty', 'Your entries will appear here as you write.'));
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
      ? when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + (days > 1 ? ' · ' + when.toLocaleDateString('en-US', { weekday: 'short' }) : '')
      : when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })));
    const dots = el('span', 'history-dots');
    (entry.tracks || []).filter(Boolean).slice(0, 5).forEach(t => {
      const dot = el('i', 'mood-dot');
      dot.style.background = (MOODS[t.moodData?.mood] || MOODS.neutral).color;
      dot.title = t.moodData?.mood || '';
      dots.append(dot);
    });
    meta.append(dots);
    open.append(meta);
    open.addEventListener('click', () => onOpen(entry));

    const del = el('button', 'history-delete', '×');
    del.type = 'button';
    del.title = 'Delete entry';
    del.setAttribute('aria-label', 'Delete entry: ' + entryTitle(entry));
    del.addEventListener('click', () => onDelete(entry));

    row.append(open, del);
    listEl.append(row);
  }
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
export function streakDays(entries, now = new Date()) {
  const days = new Set(entries.map(e => dayKey(e.createdAt)));
  let d = startOfDay(now);
  if (!days.has(dayKey(d))) d = new Date(d - DAY_MS);   // today not written yet doesn't break the streak
  let n = 0;
  while (days.has(dayKey(d))) { n++; d = new Date(d - DAY_MS); }
  return n;
}

export function renderCalendar(root, entries, month, activeId, { onPickDay, onMonth }) {
  const byDay = new Map();
  entries.forEach(e => { const k = dayKey(e.createdAt); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(e); });
  const activeDay = entries.find(e => e.id === activeId);

  root.replaceChildren();
  const head = el('div', 'cal-head');
  const prev = el('button', 'cal-nav', '‹'); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous month');
  const next = el('button', 'cal-nav', '›'); next.type = 'button'; next.setAttribute('aria-label', 'Next month');
  prev.addEventListener('click', () => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)));
  next.addEventListener('click', () => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)));
  head.append(prev, el('div', 'cal-title', month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })), next);
  root.append(head);

  const grid = el('div', 'cal-grid');
  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(w => grid.append(el('div', 'cal-weekday', w)));
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
    if (key === todayKey) cell.classList.add('today');
    if (activeDay && dayKey(activeDay.createdAt) === key) cell.classList.add('selected');
    if (dayEntries.length) {
      cell.classList.add('has-entry');
      const dot = el('i', 'cal-dot');
      dot.style.background = moodColor(dayEntries[0]) || 'var(--accent1)';
      cell.append(dot);
      const label = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      cell.setAttribute('aria-label', `${label}, ${dayEntries.length} entr${dayEntries.length === 1 ? 'y' : 'ies'}`);
      cell.addEventListener('click', () => onPickDay(dayEntries[0]));
    } else {
      cell.disabled = true;
    }
    grid.append(cell);
  }
  root.append(grid);

  const streak = streakDays(entries);
  const stats = el('div', 'cal-stats');
  stats.append(
    el('div', 'cal-stat', streak ? `${streak}-day streak` : 'Start your streak today'),
    el('div', 'cal-stat-sub', `${monthCount} entr${monthCount === 1 ? 'y' : 'ies'} in ${month.toLocaleDateString('en-US', { month: 'long' })}`),
  );
  root.append(stats);
}
