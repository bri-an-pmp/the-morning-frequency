// Circle of fifths key picker. Tap one key to make it home; the rest of the circle fills in:
// numbers show the path each paragraph takes (one step per paragraph), and the home key's
// family — the six chords that always harmonize with it — lights up with Roman numerals.

const MAJORS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
const MINORS = ['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'E♭m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm'];
const MAJOR_PC = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];      // pitch class of each position
const STORE = 'tmf_circle';

let state = { pos: null, minor: false, dir: 1 };   // pos: home position 0–11 (C at the top)
let nextStep = 0;
let els = null;

const mod12 = n => ((n % 12) + 12) % 12;

function load() {
  try { state = { ...state, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch (e) { /* defaults */ }
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
  els.dirBtns.forEach(b => b.classList.toggle('selected', +b.dataset.dir === state.dir));

  if (!hasHome) {
    legend.textContent = 'Tap a key to make it your home key. The rest of the circle fills in to show where your music goes next.';
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

function build(wrap) {
  const R_OUT = 124, R_IN = 80, C = 150;
  const ring = document.createElement('div');
  ring.className = 'cof-ring';
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
      btn.addEventListener('click', () => {
        state.pos = pos; state.minor = minor;
        save(); render();
      });
      ring.append(btn);
    });
  });
  const hub = document.createElement('div');
  hub.className = 'cof-hub';
  hub.textContent = 'circle of fifths';
  ring.append(hub);
  wrap.prepend(ring);
}

export function initCircle() {
  load();
  const select = document.getElementById('key-pref');
  const wrap = document.getElementById('circle-wrap');
  build(wrap);
  els = { wrap, legend: document.getElementById('circle-legend'), dirBtns: [...wrap.querySelectorAll('.cof-dir')] };
  els.dirBtns.forEach(b => b.addEventListener('click', () => { state.dir = +b.dataset.dir; save(); render(); }));

  try { const saved = localStorage.getItem('tmf_key_pref'); if (saved && select.querySelector(`option[value="${saved}"]`)) select.value = saved; } catch (e) { /* default */ }
  const sync = () => {
    wrap.classList.toggle('show', select.value === 'circle');
    try { localStorage.setItem('tmf_key_pref', select.value); } catch (e) { /* not essential */ }
  };
  select.addEventListener('change', sync);
  sync();
  render();
}
