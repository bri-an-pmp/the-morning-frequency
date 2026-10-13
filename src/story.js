// "Share to story": a tall (9:16) video of the session's music with a moving waveform,
// made in the browser with a canvas + MediaRecorder, sized for Instagram, TikTok and
// Facebook stories. Falls back to a still picture where the device can't record video.
import { ctx } from './audio.js';
import { renderTrack } from './export.js';
import { describeKey } from './moods.js';
import { t, moodName } from './i18n.js';

const W = 1080, H = 1920, FPS = 30;
const SEG = 5;          // seconds each paragraph leads before the next one comes in
const LAST = 9;         // seconds the final paragraph rings out
const APP_URL = 'bri-an-pmp.github.io/the-morning-frequency';

const SERIF = '"DM Serif Display", serif';
const MONO = '"DM Mono", monospace';

export function storyVideoType() {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
  // MP4 first: it's what Instagram, TikTok and Facebook accept everywhere
  return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
    .find(t => MediaRecorder.isTypeSupported(t)) || null;
}

// ── Audio: overlap the paragraphs (each fades as the next arrives), ~10–19 seconds ──
async function mixStoryAudio(tracks) {
  const buffers = [];
  for (const t of tracks) buffers.push(await renderTrack(t));
  const sr = buffers[0].sampleRate;
  const starts = buffers.map((_, i) => i * SEG);
  const duration = starts[starts.length - 1] + Math.min(LAST, buffers[buffers.length - 1].duration);
  const frames = Math.ceil(duration * sr);
  const L = new Float32Array(frames), R = new Float32Array(frames);

  buffers.forEach((b, i) => {
    const at = Math.round(starts[i] * sr);
    const fadeFrom = i < buffers.length - 1 ? starts[i + 1] * sr : frames - 2 * sr;
    const fadeLen = (i < buffers.length - 1 ? 1.5 : 2) * sr;
    const bl = b.getChannelData(0), br = b.getChannelData(b.numberOfChannels > 1 ? 1 : 0);
    for (let j = 0; j < b.length && at + j < frames; j++) {
      const f = at + j;
      const g = f < fadeFrom ? 1 : Math.max(0, 1 - (f - fadeFrom) / fadeLen);
      if (g === 0) break;
      L[f] += bl[j] * g; R[f] += br[j] * g;
    }
  });

  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const gain = peak > 0 ? 0.95 / peak : 1;
  const out = new AudioBuffer({ numberOfChannels: 2, length: frames, sampleRate: sr });
  out.getChannelData(0).set(L.map(v => v * gain));
  out.getChannelData(1).set(R.map(v => v * gain));
  return { buffer: out, starts, duration };
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

function wrapLines(g, text, maxWidth, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }
  return lines;
}

function cloud(g, x, y, s) {
  [[0, 0, 1], [-0.9, 0.15, 0.7], [0.9, 0.18, 0.75], [-0.35, -0.35, 0.75], [0.4, -0.3, 0.7]].forEach(([dx, dy, r]) => {
    const cx = x + dx * s, cy = y + dy * s, rad = r * s;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fill();
  });
}

// Everything that doesn't move: sky, title, date, the optional line, footer
function drawBackground(g, { date, line }) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#8fc4f0'); sky.addColorStop(0.35, '#c7e3f9'); sky.addColorStop(0.7, '#e8f3fd'); sky.addColorStop(1, '#ffffff');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  cloud(g, 190, 520, 150); cloud(g, 900, 360, 120); cloud(g, 860, 1500, 170); cloud(g, 160, 1680, 130);

  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#2f74c0';
  g.font = `400 34px ${MONO}`;
  if ('letterSpacing' in g) g.letterSpacing = '8px';
  g.fillText('THE MORNING FREQUENCY', W / 2, 380);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.fillStyle = '#1f3550';
  g.font = `400 64px ${SERIF}`;
  g.fillText(date, W / 2, 470);

  if (line) {
    g.font = `italic 400 54px ${SERIF}`;
    const lines = wrapLines(g, '“' + line + '”', W - 220, 4);
    g.fillStyle = '#1f3550';
    lines.forEach((l, i) => g.fillText(l, W / 2, 1390 + i * 70));
  }

  g.fillStyle = '#4b6482';
  g.font = `400 30px ${MONO}`;
  g.fillText(t('storyCta'), W / 2, 1640);
  g.fillText(APP_URL, W / 2, 1685);
}

function makeFrameDrawer(g, opts) {
  const bg = document.createElement('canvas');
  bg.width = W; bg.height = H;
  drawBackground(bg.getContext('2d'), opts);
  const { tracks, starts } = opts;
  const colors = tracks.map(t => t.profile.color);
  const wave = new Uint8Array(512);

  return function draw(t, analyser) {
    g.drawImage(bg, 0, 0);

    // Which paragraph is playing, with a short color crossfade between them
    let i = 0;
    while (i < starts.length - 1 && t >= starts[i + 1]) i++;
    const into = t - starts[i];
    const color = i > 0 && into < 1 ? mixHex(colors[i - 1], colors[i], into) : colors[i];
    const { profile, key } = tracks[i];

    let level = 0;
    if (analyser) {
      analyser.getByteTimeDomainData(wave);
      for (const v of wave) level = Math.max(level, Math.abs(v - 128) / 128);
    }

    // Glow
    const cx = W / 2, cy = 900, R = 250;
    const glow = g.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 1.9);
    glow.addColorStop(0, rgba(color, 0.28 + level * 0.4));
    glow.addColorStop(1, rgba(color, 0));
    g.fillStyle = glow;
    g.beginPath(); g.arc(cx, cy, R * 1.9, 0, Math.PI * 2); g.fill();

    // The frequency ring: a circle bent by the live waveform
    [[1, 0.9, 7], [1.12, 0.35, 4], [1.24, 0.15, 3]].forEach(([scale, alpha, width], k) => {
      g.strokeStyle = rgba(color, alpha);
      g.lineWidth = width;
      g.beginPath();
      const n = 180;
      for (let s = 0; s <= n; s++) {
        const a = (s / n) * Math.PI * 2 - Math.PI / 2;
        // Mirror the waveform left/right so the ring closes without a seam at the top
        const m = Math.min(s, n - s);
        const sample = analyser ? (wave[m * 4 + k * 40] - 128) / 128 : 0;
        const r = R * scale + sample * 110 * (1 + k * 0.4) + Math.sin(a * 3 + t * 0.8) * 6;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        s ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
      g.stroke();
    });

    // Mood in the middle of the ring
    g.textAlign = 'center';
    g.fillStyle = color;
    g.font = `400 72px ${SERIF}`;
    g.fillText(moodName(profile.label), cx, cy + 12);
    g.fillStyle = '#4b6482';
    g.font = `400 28px ${MONO}`;
    g.fillText(describeKey(profile, key), cx, cy + 62);

    // One dot per paragraph; the playing one is bigger
    const gap = 70, x0 = cx - ((tracks.length - 1) * gap) / 2;
    colors.forEach((c, k) => {
      g.fillStyle = k === i ? c : rgba(c, 0.45);
      g.beginPath(); g.arc(x0 + k * gap, 1260, k === i ? 18 : 12, 0, Math.PI * 2); g.fill();
    });
  };
}

async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load(`400 64px ${SERIF}`),
      document.fonts.load(`italic 400 54px ${SERIF}`),
      document.fonts.load(`400 30px ${MONO}`),
    ]);
  } catch (e) { /* draw with fallback fonts */ }
}

function newCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  // Kept in the page (invisibly) so every browser keeps producing frames
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;';
  document.body.appendChild(canvas);
  return canvas;
}

// Returns { blob, ext, type }. onProgress(0..1) is called while recording.
export async function makeStory(sessionTracks, { date, line = '', onProgress = () => {} }) {
  const tracks = sessionTracks.filter(Boolean);
  await loadFonts();
  const canvas = newCanvas();
  const g = canvas.getContext('2d');
  try {
    const type = storyVideoType();
    if (!type) {
      makeFrameDrawer(g, { date, line, tracks, starts: [0] })(0, null);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      return { blob, ext: 'png', type: 'image/png' };
    }

    const { buffer, starts, duration } = await mixStoryAudio(tracks);
    const draw = makeFrameDrawer(g, { date, line, tracks, starts });

    // Record in real time. The music goes only into the recording, not the speakers.
    const c = ctx();
    if (c.state === 'suspended') await c.resume();
    const src = c.createBufferSource();
    src.buffer = buffer;
    const analyser = c.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    const dest = c.createMediaStreamDestination();
    src.connect(analyser); src.connect(dest);

    draw(0, analyser);
    const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 160_000 });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((res, rej) => { recorder.onstop = res; recorder.onerror = e => rej(e.error || e); });

    recorder.start(1000);
    const t0 = c.currentTime + 0.05;
    src.start(t0);
    // If the page is hidden (another app, a locked phone) the picture freezes while the sound
    // carries on, which would make a broken video. Stop and say so instead.
    let interrupted = false;
    const onHide = () => { if (document.hidden) interrupted = true; };
    document.addEventListener('visibilitychange', onHide);
    try {
      await new Promise(res => {
        const timer = setInterval(() => {
          const t = Math.max(0, c.currentTime - t0);
          if (interrupted) { clearInterval(timer); res(); return; }
          draw(Math.min(t, duration), analyser);
          onProgress(Math.min(1, t / duration));
          if (t >= duration + 0.3) { clearInterval(timer); res(); }
        }, 1000 / FPS);
      });
    } finally {
      document.removeEventListener('visibilitychange', onHide);
    }
    recorder.stop();
    await stopped;
    stream.getTracks().forEach(tr => tr.stop());
    try { src.stop(); } catch (e) { /* already finished */ }
    src.disconnect();
    if (interrupted) {
      const err = new Error('The page was hidden while the video was being made');
      err.name = 'StoryInterrupted';
      throw err;
    }

    const base = type.split(';')[0];
    return { blob: new Blob(chunks, { type: base }), ext: base === 'video/mp4' ? 'mp4' : 'webm', type: base };
  } finally {
    canvas.remove();
  }
}
