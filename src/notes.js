// Save to Apple Notes. Each day goes in as its own section with a divider, the date and the
// entry name, so the writer can keep adding to the same note: the first time they save a new
// note, and after that they pick that same note in the share menu.
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { t, LOCALE } from './i18n.js';

const STARTED = 'tmf_notes_started';

export function notesStarted() {
  try { return localStorage.getItem(STARTED) === '1'; } catch (e) { return false; }
}

// date: Date; title: the entry name ('' if unnamed); paragraphs: [string]; moods: [string]
export function notesText({ date, title, paragraphs, moods }) {
  const day = date.toLocaleDateString(LOCALE, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const lines = [];
  if (!notesStarted()) lines.push('The Morning Frequency', '');   // the new note's title, the first time only
  lines.push('━━━━━━━━━━━━━━━━', day);
  if (title) lines.push(title);
  if (moods.length) lines.push(t('notesMoods') + ': ' + moods.join(' · '));
  lines.push('', paragraphs.join('\n\n'), '');
  return lines.join('\n');
}

// Returns 'shared' or 'copied'. Throws AbortError if the writer closes the share menu.
export async function saveToNotes(text) {
  if (Capacitor.isNativePlatform()) {
    await Share.share({ text, dialogTitle: t('notesDialog') });
  } else if (navigator.share) {
    await navigator.share({ text });
  } else {
    await navigator.clipboard.writeText(text);
    try { localStorage.setItem(STARTED, '1'); } catch (e) { /* not essential */ }
    return 'copied';
  }
  try { localStorage.setItem(STARTED, '1'); } catch (e) { /* not essential */ }
  return 'shared';
}
