// Builds the Word, PDF and WAV files and shares them
import { playMoodMusic, playStreakMusic, STREAK_SOUNDS } from './audio.js';
import { moodProfile } from './moods.js';
import { LOCALE } from './i18n.js';

export function sessionParagraphs() {
  return document.getElementById('writer').value.split('\n').map(p => p.trim()).filter(Boolean);
}

// The open entry's date and name, kept in sync by main.js
let meta = { date: new Date(), title: '' };
export function setSessionMeta(m) { meta = { ...meta, ...m }; }

export function sessionDate() {
  return meta.date.toLocaleDateString(LOCALE,{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}

// The entry's name, or its first line when the writer hasn't named it
export function sessionName() {
  return meta.title || sessionParagraphs()[0] || 'The Morning Frequency';
}

// "2026-10-12 - Sunday Reset.docx": the date, then the name, safe for every file system
export function datedFilename(date, name, ext) {
  const iso = date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
  let safe = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim();
  if (safe.length > 60) safe = safe.slice(0, 60).replace(/\s+\S*$/, '');
  safe = safe.replace(/[. ]+$/, '');
  return iso + (safe ? ' - ' + safe : '') + '.' + ext;
}

export function sessionFilename(ext) {
  return datedFilename(meta.date, sessionName(), ext);
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function makeDocxBlob() {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  const doc = new Document({ sections: [{ children: [
    new Paragraph({ text: meta.title || 'The Morning Frequency', heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: sessionDate() + (meta.title ? ' · The Morning Frequency' : ''), italics: true, color: '666666' })], spacing: { after: 360 } }),
    ...sessionParagraphs().map(t => new Paragraph({ children: [new TextRun({ text: t, size: 24 })], spacing: { after: 240, line: 360 } }))
  ]}]});
  return Packer.toBlob(doc);
}

export async function makePdfBlob() {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 72, width = pdf.internal.pageSize.getWidth() - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - margin;
  let y = margin;
  pdf.setFont('times', 'normal'); pdf.setFontSize(24);
  pdf.splitTextToSize(meta.title || 'The Morning Frequency', width).forEach(line => { pdf.text(line, margin, y); y += 28; });
  y -= 4;
  pdf.setFont('times', 'italic'); pdf.setFontSize(12); pdf.setTextColor(102);
  pdf.text(sessionDate() + (meta.title ? ' · The Morning Frequency' : ''), margin, y); y += 36;
  pdf.setFont('times', 'normal'); pdf.setTextColor(0);
  const lineH = 18;
  sessionParagraphs().forEach(t => {
    pdf.splitTextToSize(t, width).forEach(line => {
      if (y > bottom) { pdf.addPage(); y = margin; }
      pdf.text(line, margin, y); y += lineH;
    });
    y += lineH * 0.75;
  });
  return pdf.output('blob');
}

// ── Audio export: re-render each paragraph's music offline, join, encode as WAV ──
export async function renderTrack(t) {
  const sr = 44100;
  const seconds = 4.0 + (1 - t.profile.energy) * 2.0 + 7.0;   // chord + full fade tail
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oc = new Offline(2, Math.ceil(sr * seconds), sr);
  playMoodMusic(t.profile, t.musicIndex, oc, t.key || null);
  return oc.startRendering();
}

function encodeWav(buffers) {
  const sr = buffers[0].sampleRate;
  // Normalise so the loudest moment sits just under full scale (no clipping)
  let peak = 0;
  buffers.forEach(b => { for (let ch = 0; ch < b.numberOfChannels; ch++) for (const v of b.getChannelData(ch)) peak = Math.max(peak, Math.abs(v)); });
  const gain = peak > 0 ? 0.95 / peak : 1;
  const frames = buffers.reduce((n, b) => n + b.length, 0);
  const view = new DataView(new ArrayBuffer(44 + frames * 4));
  const str = (o, txt) => [...txt].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF'); view.setUint32(4, 36 + frames * 4, true); str(8, 'WAVE');
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, sr, true); view.setUint32(28, sr * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
  str(36, 'data'); view.setUint32(40, frames * 4, true);
  let o = 44;
  buffers.forEach(b => {
    const L = b.getChannelData(0), R = b.getChannelData(b.numberOfChannels > 1 ? 1 : 0);
    for (let i = 0; i < b.length; i++) {
      for (const v of [L[i], R[i]]) {
        const x = Math.max(-1, Math.min(1, v * gain));
        view.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2;
      }
    }
  });
  return new Blob([view], { type: 'audio/wav' });
}

// Loudness in 50ms windows, so we can find where each paragraph's music starts and ends
function envelope(b, win) {
  const chans = [...Array(b.numberOfChannels)].map((_, ch) => b.getChannelData(ch));
  const env = [];
  for (let i = 0; i < b.length; i += win) {
    let m = 0;
    for (const d of chans) for (let j = i; j < Math.min(i + win, b.length); j++) m = Math.max(m, Math.abs(d[j]));
    env.push(m);
  }
  return env;
}

// Join the paragraphs with no pauses: skip any silence before each one, and start the next
// paragraph as soon as the current one's music fades, letting its echo ring on underneath.
// Paragraphs are added one at a time and then let go, so long recordings don't fill the memory.
function seamlessJoiner() {
  let sr = 0, win = 0, cap = 0, used = 0, at = 0;
  let out = [new Float32Array(0), new Float32Array(0)];
  const grow = need => {
    if (need <= cap) return;
    cap = Math.max(need, Math.ceil(cap * 1.5), sr * 30);
    out = out.map(old => { const a = new Float32Array(cap); a.set(old.subarray(0, used)); return a; });
  };
  return {
    add(b) {
      if (!sr) { sr = b.sampleRate; win = Math.round(sr * 0.05); }
      const env = envelope(b, win);
      const peak = Math.max(...env) || 1;
      const lead = Math.max(0, env.findIndex(v => v > peak * 0.01));
      let musicEnd = env.length - 1;
      while (musicEnd > lead && env[musicEnd] < peak * 0.15) musicEnd--;
      let tailEnd = env.length - 1;
      while (tailEnd > musicEnd && env[tailEnd] < peak * 0.003) tailEnd--;
      const from = lead * win, to = Math.min(b.length, (tailEnd + 1) * win);
      grow(at + (to - from));
      for (let ch = 0; ch < 2; ch++) {
        const src = b.getChannelData(Math.min(ch, b.numberOfChannels - 1)), dst = out[ch];
        for (let j = from; j < to; j++) dst[at + j - from] += src[j];
      }
      used = Math.max(used, at + (to - from));
      at += (musicEnd + 1 - lead) * win;
    },
    finish() {
      // Short fade at the very end so it doesn't click
      const fade = Math.min(used, Math.round(sr * 0.5));
      for (let ch = 0; ch < 2; ch++) for (let j = 0; j < fade; j++) out[ch][used - 1 - j] *= j / fade;
      return { sampleRate: sr, length: used, numberOfChannels: 2, getChannelData: ch => out[ch].subarray(0, used) };
    },
  };
}

export async function makeWavBlob(sessionTracks) {
  const tracks = sessionTracks.filter(Boolean);
  const joiner = seamlessJoiner();
  for (const t of tracks) joiner.add(await renderTrack(t));
  return encodeWav([joiner.finish()]);
}

export function canShareFiles(files) {
  try { return !!(navigator.canShare && navigator.canShare({ files })); } catch (e) { return false; }
}

export async function shareFile(blob, filename, type) {
  const files = [new File([blob], filename, { type })];
  if (!canShareFiles(files)) { saveBlob(blob, filename); return; }
  await navigator.share({ files, title: 'The Morning Frequency' });
}

// ── Streak mix: every paragraph's music from every day of the streak, oldest first,
// joined seamlessly, ending with the milestone's own sound ──
async function renderStreakSound(days) {
  const s = STREAK_SOUNDS[days];
  const sr = 44100;
  const seconds = 2 + s.arp.length * s.step + s.hold + 6.5;
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oc = new Offline(2, Math.ceil(sr * seconds), sr);
  playStreakMusic(days, oc);
  return oc.startRendering();
}

// streakEntries: the entries in the streak (any order). onProgress(done, total)
// Long streaks use the most recent STREAK_MIX_MAX paragraphs (about five minutes), which keeps
// the file a sensible size and stops phones running out of memory while it's made.
export const STREAK_MIX_MAX = 60;
export async function makeStreakWavBlob(streakEntries, milestone, onProgress = () => {}) {
  const tracks = [...streakEntries]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .flatMap(e => (e.tracks || []).filter(Boolean))
    .slice(-STREAK_MIX_MAX)
    .map(t => ({ musicIndex: t.musicIndex, key: t.key || null, profile: moodProfile(t.moodData?.mood) }));
  const total = tracks.length + (milestone ? 1 : 0);
  const joiner = seamlessJoiner();
  let done = 0;
  for (const t of tracks) {
    joiner.add(await renderTrack(t));
    onProgress(++done, total);
  }
  if (milestone) joiner.add(await renderStreakSound(milestone));
  onProgress(total, total);
  return encodeWav([joiner.finish()]);
}
