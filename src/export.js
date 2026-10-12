// Builds the Word, PDF and WAV files and shares them
import { playMoodMusic } from './audio.js';

export function sessionParagraphs() {
  return document.getElementById('writer').value.split('\n').map(p => p.trim()).filter(Boolean);
}

export function sessionDate() {
  return new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}

export function sessionFilename(ext) {
  const d = new Date();
  const iso = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  return 'the-morning-frequency-' + iso + '.' + ext;
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
    new Paragraph({ text: 'The Morning Frequency', heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: sessionDate(), italics: true, color: '666666' })], spacing: { after: 360 } }),
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
  pdf.text('The Morning Frequency', margin, y); y += 24;
  pdf.setFont('times', 'italic'); pdf.setFontSize(12); pdf.setTextColor(102);
  pdf.text(sessionDate(), margin, y); y += 36;
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
  playMoodMusic(t.profile, t.musicIndex, oc);
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

export async function makeWavBlob(sessionTracks) {
  const tracks = sessionTracks.filter(Boolean);
  const buffers = [];
  for (const t of tracks) buffers.push(await renderTrack(t));
  return encodeWav(buffers);
}

export function canShareFiles(files) {
  try { return !!(navigator.canShare && navigator.canShare({ files })); } catch (e) { return false; }
}

export async function shareFile(blob, filename, type) {
  const files = [new File([blob], filename, { type })];
  if (!canShareFiles(files)) { saveBlob(blob, filename); return; }
  await navigator.share({ files, title: 'The Morning Frequency' });
}
