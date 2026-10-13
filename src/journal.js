// Saved entries (the journal). Uses Capacitor Preferences: native storage in the iPhone app,
// which iOS won't clear, and localStorage on the website.
import { Preferences } from '@capacitor/preferences';
import { t } from './i18n.js';

const KEY = 'tmf_entries';

// Writes run one at a time. Two saves at once (say, an autosave and a delete) could otherwise
// each read the old list and the second would undo the first.
let queue = Promise.resolve();
function serialized(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const int = (v, min, max) => (Number.isInteger(v) ? Math.min(max, Math.max(min, v)) : min);
const validDate = v => typeof v === 'string' && !Number.isNaN(Date.parse(v));

// Saved data is checked before use: anything malformed is repaired or dropped, so a damaged or
// tampered entry can't crash the page or feed impossible values (like an infinite pitch) to the audio
function cleanTrack(tr) {
  if (!tr || typeof tr !== 'object' || !tr.moodData || typeof tr.moodData !== 'object') return null;
  const n = v => (Number.isFinite(+v) ? Math.min(1, Math.max(0, +v)) : 0.5);
  const k = tr.key;
  const key = k && typeof k === 'object' && Number.isFinite(k.root) && k.root >= 50 && k.root <= 2000
    ? { root: k.root, minor: k.minor === true, name: str(k.name, 4) } : null;
  return {
    musicIndex: int(tr.musicIndex, 0, 3),
    moodData: { mood: str(tr.moodData.mood, 20), energy: n(tr.moodData.energy), valence: n(tr.moodData.valence), reason: str(tr.moodData.reason, 60) },
    key,
  };
}
function cleanEntry(e) {
  if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !validDate(e.createdAt)) return null;
  return {
    id: e.id.slice(0, 64),
    createdAt: e.createdAt,
    updatedAt: validDate(e.updatedAt) ? e.updatedAt : e.createdAt,
    title: str(e.title, 200),
    text: str(e.text, 200000),
    completedCount: int(e.completedCount, 0, 10000),
    enterCount: int(e.enterCount, 0, 100000),
    tracks: Array.isArray(e.tracks) ? e.tracks.slice(0, 1000).map(cleanTrack) : [],
  };
}

// Entry shape:
// { id, createdAt, updatedAt, text, completedCount, enterCount,
//   tracks: [{ musicIndex, moodData }] }   — one per counted paragraph; music is regenerated from these

export async function loadEntries() {
  let value = null;
  try {
    ({ value } = await Preferences.get({ key: KEY }));
    const parsed = value ? JSON.parse(value) : [];
    if (!Array.isArray(parsed)) throw new Error('saved entries are not a list');
    return parsed.map(cleanEntry).filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (e) {
    console.warn('Could not read saved entries', e);
    // Keep a copy of whatever was there before the next save replaces it, so nothing is lost for good
    if (value) {
      try { await Preferences.set({ key: KEY + '_backup_' + Date.now(), value }); } catch (e2) { /* nothing more to do */ }
    }
    return [];
  }
}

async function writeEntries(entries) {
  await Preferences.set({ key: KEY, value: JSON.stringify(entries) });
}

export function saveEntry(entry) {
  return serialized(async () => {
    const entries = await loadEntries();
    const i = entries.findIndex(e => e.id === entry.id);
    if (i === -1) entries.unshift(entry); else entries[i] = entry;
    await writeEntries(entries);
    return loadEntries();
  });
}

export function deleteEntry(id) {
  return serialized(async () => {
    await writeEntries((await loadEntries()).filter(e => e.id !== id));
    return loadEntries();
  });
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
  const named = (entry.title || '').trim();
  if (named) return named.length > 48 ? named.slice(0, 46).trimEnd() + '…' : named;
  const first = (entry.text || '').split('\n').map(l => l.trim()).find(Boolean) || t('emptyEntry');
  return first.length > 48 ? first.slice(0, 46).trimEnd() + '…' : first;
}
