// Color themes for the page, named after the moods. "sky" is the original blue;
// "follow my mood" changes the page to each paragraph's mood color as you write.
import { MOODS, isMood } from './moods.js';

const STORE = 'tmf_theme';
let current = 'sky';

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {   // t = how much of b
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(v * (1 - t) + B[i] * t).toString(16).padStart(2, '0')).join('');
}

// Every color the page uses, worked out from one accent color
function paletteFor(color) {
  const [r, g, b] = hexToRgb(color);
  return {
    '--accent1': color,
    '--accent2': mix(color, '#ffffff', 0.3),
    '--accent3': mix(color, '#000000', 0.2),
    '--sky1': mix(color, '#ffffff', 0.55),
    '--sky2': mix(color, '#ffffff', 0.75),
    '--sky3': mix(color, '#ffffff', 0.9),
    '--bg': mix(color, '#ffffff', 0.9),
    '--border': mix(color, '#ffffff', 0.8),
    '--border2': mix(color, '#ffffff', 0.65),
    '--text': mix(color, '#141c28', 0.8),
    '--muted': mix(color, '#4f5d70', 0.75),
    '--muted2': mix(color, '#3f4c5e', 0.75),
    '--shadow': `0 12px 40px rgba(${r}, ${g}, ${b}, 0.16)`,
    '--focus-ring': `rgba(${r}, ${g}, ${b}, 0.14)`,
  };
}

function paint(color) {
  const root = document.documentElement;
  const vars = color ? paletteFor(color) : null;
  ['--accent1', '--accent2', '--accent3', '--sky1', '--sky2', '--sky3', '--bg', '--border', '--border2',
    '--text', '--muted', '--muted2', '--shadow', '--focus-ring'].forEach(v => {
    if (vars) root.style.setProperty(v, vars[v]); else root.style.removeProperty(v);   // sky = the stylesheet's own colors
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = vars ? vars['--sky1'] : '#a9d2f5';
}

function choose(name, save = true) {
  current = name;
  if (name === 'sky' || name === 'follow') paint(null);
  else paint(isMood(name) ? MOODS[name].color : null);
  if (save) { try { localStorage.setItem(STORE, name); } catch (e) { /* not essential */ } }
  document.querySelectorAll('.theme-swatch').forEach(s => s.setAttribute('aria-pressed', s.dataset.theme === name ? 'true' : 'false'));
  const label = document.getElementById('theme-name');
  if (label) label.textContent = name === 'sky' ? 'sky (original)' : name === 'follow' ? 'follow my mood — changes as you write' : name;
}

// Called whenever a paragraph's mood is shown
export function followMood(moodName) {
  if (current === 'follow' && isMood(moodName)) paint(MOODS[moodName].color);
}

export function initThemes() {
  const box = document.getElementById('theme-swatches');
  const make = (name, background, title) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-swatch';
    b.dataset.theme = name;
    b.style.background = background;
    b.title = title;
    b.setAttribute('aria-label', 'Theme: ' + title);
    b.addEventListener('click', () => choose(name));
    return b;
  };
  const moodColors = Object.values(MOODS).map(p => p.color);
  box.append(
    make('sky', `linear-gradient(160deg, #9fcdf3, #ffffff)`, 'sky (original)'),
    make('follow', `conic-gradient(${moodColors.join(', ')}, ${moodColors[0]})`, 'follow my mood'),
    ...Object.values(MOODS).map(p => make(p.label, `linear-gradient(160deg, ${p.color}, ${mix(p.color, '#ffffff', 0.7)})`, p.label)),
  );
  let saved = 'sky';
  try { saved = localStorage.getItem(STORE) || 'sky'; } catch (e) { /* default */ }
  choose(saved === 'sky' || saved === 'follow' || isMood(saved) ? saved : 'sky', false);
}
