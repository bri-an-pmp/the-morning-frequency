// Circle of fifths key picker. Tap one key to make it home; the rest of the circle fills in:
// numbers show the path each paragraph takes (one step per paragraph), and the home key's
// family — the six chords that always harmonize with it — lights up with Roman numerals.

import { playKeyPreview } from './audio.js';

const MAJORS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
const MINORS = ['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'E♭m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm'];
const MAJOR_PC = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];      // pitch class of each position
const STORE = 'tmf_circle';

let state = { pos: null, minor: false, dir: 1 };   // pos: home position 0–11 (C at the top)
let nextStep = 0;
let els = null;
let angle = 0;              // how far the wheel is turned, in degrees
let suppressClick = false;  // a drag that ends on a key shouldn't also count as a tap

const mod12 = n => ((n % 12) + 12) % 12;

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || '{}') || {};
    state = {
      pos: Number.isInteger(s.pos) && s.pos >= 0 && s.pos < 12 ? s.pos : null,
      minor: s.minor === true,
      dir: s.dir === -1 ? -1 : 1,
    };
  } catch (e) { /* defaults */ }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* not essential */ }
}

// Root frequency for a pitch class, kept between G♯3 and G4 so keys don't jump octaves
function freq(pc) {
  const f = 261.63 * Math.pow(2, pc / 12);
  return pc >= 8 ? f / 2 : f;
}

function keyAt(pos, minor) {
  const p = mod12(pos);
  const pc = minor ? mod12(MAJOR_PC[p] + 9) : MAJOR_PC[p];
  return { root: freq(pc), minor, name: minor ? MINORS[p].replace('m', '') : MAJORS[p] };
}

export function isCircleMode() {
  return document.getElementById('key-pref').value === 'circle' && state.pos !== null;
}

// The key for paragraph number `step` (0 = home), or null when the circle isn't in use
export function keyForStep(step) {
  if (!isCircleMode()) return null;
  return keyAt(state.pos + state.dir * step, state.minor);
}

// Which paragraph comes next, so its key can be highlighted
export function setCircleStep(step) {
  nextStep = step;
  if (els) render();
}

function familyLabels() {
  // Neighbours on both rings: IV I V outside + ii vi iii inside (major home), or the minor equivalents
  const h = state.pos;
  const outer = state.minor ? ['VI', 'III', 'VII'] : ['IV', 'I', 'V'];
  const inner = state.minor ? ['iv', 'i', 'v'] : ['ii', 'vi', 'iii'];
  const out = {};
  [-1, 0, 1].forEach((d, i) => {
    out['o' + mod12(h + d)] = outer[i];
    out['i' + mod12(h + d)] = inner[i];
  });
  return out;
}

function render() {
  const { wrap, legend } = els;
  const hasHome = state.pos !== null;
  const family = hasHome ? familyLabels() : {};
  const nextPos = hasHome ? mod12(state.pos + state.dir * nextStep) : null;

  wrap.querySelectorAll('.cof-key').forEach(btn => {
    const pos = +btn.dataset.pos, minor = btn.dataset.ring === 'i';
    const tag = (minor ? 'i' : 'o') + pos;
    const onHomeRing = hasHome && minor === state.minor;
    const isHome = onHomeRing && pos === state.pos;
    btn.classList.toggle('home', isHome);
    btn.classList.toggle('family', !!family[tag] && !isHome);
    btn.classList.toggle('next', onHomeRing && pos === nextPos && !isHome);
    btn.querySelector('.cof-num').textContent = family[tag] || '';
    const step = onHomeRing ? mod12((pos - state.pos) * state.dir) + 1 : '';
    btn.querySelector('.cof-step').textContent = step;
    btn.setAttribute('aria-pressed', isHome ? 'true' : 'false');
  });
  wrap.classList.toggle('chosen', hasHome);
  els.preview.disabled = !hasHome;
  const homeKey = hasHome ? keyAt(state.pos, state.minor) : null;
  els.hub.innerHTML = hasHome
    ? `<span class="cof-hub-label">home</span><span class="cof-hub-key">${homeKey.name}${state.minor ? 'm' : ''}</span>`
    : 'turn or tap';
  els.dirBtns.forEach(b => b.classList.toggle('selected', +b.dataset.dir === state.dir));

  if (!hasHome) {
    legend.textContent = 'Turn the wheel or tap a key to choose your home key. The rest of the circle fills in to show where your music goes next.';
    return;
  }
  const home = keyAt(state.pos, state.minor);
  const path = [0, 1, 2, 3].map(s => keyAt(state.pos + state.dir * s, state.minor).name + (state.minor ? 'm' : '')).join(' → ');
  const fam = Object.keys(family).map(k => (k[0] === 'i' ? MINORS : MAJORS)[+k.slice(1)]).join(', ');
  const next = keyAt(nextPos, state.minor);
  legend.innerHTML = '';
  [
    `<strong>Home: ${home.name} ${state.minor ? 'minor' : 'major'}.</strong> Each paragraph moves one step around the circle (${path} …), so every paragraph flows into the next.`,
    `<strong>Highlighted:</strong> your key family (${fam}), the chords that always harmonize with ${home.name}${state.minor ? 'm' : ''}.`,
    `<strong>Next paragraph:</strong> ${next.name} ${state.minor ? 'minor' : 'major'}.`,
  ].forEach(html => { const p = document.createElement('p'); p.innerHTML = html; legend.append(p); });
}

// Turn the wheel (keys stay upright). animate: glide into place instead of following the finger.
function setAngle(a, animate) {
  angle = a;
  const ease = animate ? 'transform .35s cubic-bezier(.2,.8,.3,1)' : 'none';
  els.rotor.style.transition = ease;
  els.rotor.style.transform = `rotate(${a}deg)`;
  els.rotor.querySelectorAll('.cof-key').forEach(b => {
    b.style.transition = animate ? ease + ', background .2s, border-color .2s' : 'background .2s, border-color .2s';
    b.style.transform = `translate(-50%, -50%) rotate(${-a}deg)`;
  });
}

// Bring a position to the top marker the short way round
function turnTo(pos) {
  let a = -pos * 30;
  while (a - angle > 180) a -= 360;
  while (a - angle < -180) a += 360;
  setAngle(a, true);
}

function choose(pos, minor) {
  state.pos = mod12(pos);
  state.minor = minor;
  save();
  turnTo(state.pos);
  render();
}

// Five keys along the path, one second each, lighting up as they sound
let previewTimers = [];
function preview() {
  if (state.pos === null) return;
  const keys = [0, 1, 2, 3, 4].map(s => keyAt(state.pos + state.dir * s, state.minor));
  playKeyPreview(keys);
  previewTimers.forEach(clearTimeout);
  const ring = state.minor ? 'i' : 'o';
  const light = pos => els.rotor.querySelectorAll('.cof-key').forEach(b =>
    b.classList.toggle('sounding', pos !== null && b.dataset.ring === ring && +b.dataset.pos === pos));
  previewTimers = keys.map((_, s) => setTimeout(() => light(mod12(state.pos + state.dir * s)), 80 + s * 1000));
  previewTimers.push(setTimeout(() => light(null), 80 + keys.length * 1000));
  els.preview.textContent = '♪ playing…';
  previewTimers.push(setTimeout(() => { els.preview.textContent = '▶ hear your path · 5 sec'; }, keys.length * 1000 + 300));
}

function enableTurning(ring) {
  let start = null, dragging = false;
  const pointerAngle = e => {
    const r = ring.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  };
  ring.addEventListener('pointerdown', e => {
    start = { x: e.clientX, y: e.clientY, a0: angle, p0: pointerAngle(e), id: e.pointerId };
    dragging = false;
  });
  ring.addEventListener('pointermove', e => {
    if (!start || e.pointerId !== start.id) return;
    if (!dragging) {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
      dragging = true;
      ring.setPointerCapture(e.pointerId);
      ring.classList.add('turning');
    }
    let d = pointerAngle(e) - start.p0;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    start.p0 += d; start.a0 += d;     // accumulate so the wheel can go round more than once
    setAngle(start.a0, false);
  });
  const finish = () => {
    if (!start) return;
    if (dragging) {
      // Click into place: the key nearest the top becomes home
      const steps = Math.round(-angle / 30);
      setAngle(-steps * 30, true);
      state.pos = mod12(steps);
      save(); render();
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 60);
      ring.classList.remove('turning');
    }
    start = null; dragging = false;
  };
  ring.addEventListener('pointerup', finish);
  ring.addEventListener('pointercancel', finish);
}

function build(wrap) {
  const R_OUT = 124, R_IN = 80, C = 150;
  const ring = document.createElement('div');
  ring.className = 'cof-ring';
  const rotor = document.createElement('div');
  rotor.className = 'cof-rotor';
  ring.append(rotor);
  [false, true].forEach(minor => {
    (minor ? MINORS : MAJORS).forEach((label, pos) => {
      const a = (pos / 12) * Math.PI * 2 - Math.PI / 2;
      const r = minor ? R_IN : R_OUT;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cof-key ' + (minor ? 'minor' : 'major');
      btn.dataset.pos = pos;
      btn.dataset.ring = minor ? 'i' : 'o';
      btn.style.left = (C + Math.cos(a) * r) + 'px';
      btn.style.top = (C + Math.sin(a) * r) + 'px';
      btn.setAttribute('aria-label', label.replace('m', ' minor') + (minor ? '' : ' major'));
      btn.innerHTML = `<span class="cof-name">${label}</span><span class="cof-num"></span><span class="cof-step"></span>`;
      btn.addEventListener('click', () => { if (!suppressClick) choose(pos, minor); });
      rotor.append(btn);
    });
  });
  const hub = document.createElement('div');
  hub.className = 'cof-hub';
  hub.textContent = 'turn or tap';
  const marker = document.createElement('div');
  marker.className = 'cof-marker';
  marker.setAttribute('aria-hidden', 'true');
  ring.append(hub, marker);
  wrap.prepend(ring);
  enableTurning(ring);
  return { rotor, hub };
}

export function initCircle() {
  load();
  const select = document.getElementById('key-pref');
  const wrap = document.getElementById('circle-wrap');
  const { rotor, hub } = build(wrap);
  els = { wrap, rotor, hub, legend: document.getElementById('circle-legend'), dirBtns: [...wrap.querySelectorAll('.cof-dir')],
    preview: document.getElementById('cof-preview') };
  els.dirBtns.forEach(b => b.addEventListener('click', () => { state.dir = +b.dataset.dir; save(); render(); }));
  els.preview.addEventListener('click', preview);
  setAngle(state.pos === null ? 0 : -state.pos * 30, false);

  // The circle is the default, so new writers are invited to choose a key
  select.value = 'circle';
  try { const saved = localStorage.getItem('tmf_key_pref'); if (saved && select.querySelector(`option[value="${saved}"]`)) select.value = saved; } catch (e) { /* default */ }
  const sync = () => {
    wrap.classList.toggle('show', select.value === 'circle');
    try { localStorage.setItem('tmf_key_pref', select.value); } catch (e) { /* not essential */ }
  };
  select.addEventListener('change', sync);
  sync();
  render();
}
