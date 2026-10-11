// Saved entries (the journal). Uses Capacitor Preferences: native storage in the iPhone app,
// which iOS won't clear, and localStorage on the website.
import { Preferences } from '@capacitor/preferences';

const KEY = 'tmf_entries';

// Entry shape:
// { id, createdAt, updatedAt, text, completedCount, enterCount,
//   tracks: [{ musicIndex, moodData }] }   — one per counted paragraph; music is regenerated from these

export async function loadEntries() {
  try {
    const { value } = await Preferences.get({ key: KEY });
    const entries = value ? JSON.parse(value) : [];
    return Array.isArray(entries) ? entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  } catch (e) {
    console.warn('Could not read saved entries', e);
    return [];
  }
}

async function writeEntries(entries) {
  await Preferences.set({ key: KEY, value: JSON.stringify(entries) });
}

export async function saveEntry(entry) {
  const entries = await loadEntries();
  const i = entries.findIndex(e => e.id === entry.id);
  if (i === -1) entries.unshift(entry); else entries[i] = entry;
  await writeEntries(entries);
  return loadEntries();
}

export async function deleteEntry(id) {
  await writeEntries((await loadEntries()).filter(e => e.id !== id));
  return loadEntries();
}

export function newEntryId() {
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
}

// Local calendar day, e.g. "2026-10-11", so entries land on the day the writer saw
export function dayKey(date) {
  const d = new Date(date);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function entryTitle(entry) {
  const first = (entry.text || '').split('\n').map(l => l.trim()).find(Boolean) || 'Empty entry';
  return first.length > 48 ? first.slice(0, 46).trimEnd() + '…' : first;
}
