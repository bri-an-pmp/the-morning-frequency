import { ROOT_FREQ } from './moods.js';

let audioCtx = null;

// ─── Audio engine v0.5 — choir + organ + chorus + cathedral reverb + two echoes ─────────────

export function ctx() {
  // iPhone: play even when the ring/silent switch is on (Safari 16.4+)
  if (navigator.audioSession && navigator.audioSession.type !== 'playback') {
    try { navigator.audioSession.type = 'playback'; } catch (e) {}
  }
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function vol() { return parseInt(document.getElementById('volume').value) / 100; }
function getTempo(p) { return Math.max(20, p.tempoBase + parseInt(document.getElementById('tempo-offset').value)); }
function getRootFreq(p) {
  const k = document.getElementById('key-pref').value;
  return k === 'auto' ? (ROOT_FREQ[p.root] || 261.63) : (ROOT_FREQ[k] || 261.63);
}
function getTexture(p) {
  const t = document.getElementById('texture-pref').value;
  if (t !== 'auto') return t;
  if (p.energy < 0.3) return 'sparse';
  if (p.energy > 0.75) return 'rhythmic';
  if (p.valence > 0.7) return 'melodic';
  return 'rich';
}

// ── Cathedral reverb IR — longer tail, denser early reflections ───────────────
function buildCathedralReverb(c) {
  const sr = c.sampleRate;
  const decay = 7.0;                        // seconds — long, atmospheric tail
  const preDelay = 0.028;
  const len = Math.ceil(sr * (decay + preDelay + 0.2));
  const ir = c.createBuffer(2, len, sr);
  const preS = Math.ceil(sr * preDelay);

  // Dense early reflection comb — 12 reflections for a large stone space
  const refs = [0.017,0.031,0.043,0.059,0.071,0.089,0.107,0.131,0.163,0.197,0.241,0.293]
    .map(d => Math.ceil(sr * d));

  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    // Late tail: coloured noise — two-pass LP for warmth
    for (let i = preS; i < len; i++) {
      const t = (i - preS) / sr;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t * (2.8 / decay)) * (ch ? 1.0 : 0.94);
    }
    // Two-pass one-pole LP (simulates stone/air absorption at higher freqs)
    let p1 = 0, p2 = 0;
    for (let i = 0; i < len; i++) { d[i] = p1 + 0.18*(d[i]-p1); p1 = d[i]; }
    for (let i = 0; i < len; i++) { d[i] = p2 + 0.12*(d[i]-p2); p2 = d[i]; }
    // Early reflections superimposed
    refs.forEach((pos, idx) => {
      if (pos < len) {
        const amp = 0.72 * Math.exp(-idx * 0.22) * (ch ? 0.88 : 1.0);
        d[pos] += amp; if (pos+1 < len) d[pos+1] += amp * 0.4;
      }
    });
  }
  return ir;
}

// ── Signal chain: source → [dry | reverb | delay→reverb] → master ─────────────
// Built once and cached. All voices route into `bus` which feeds the FX graph.
function getChain(c) {
  if (c._chain) return c._chain;

  // Phaser — 6 allpass stages modulated by a slow LFO
  // Allpass filters don't cut frequency, they shift phase — sweeping their
  // center frequencies creates the characteristic comb-filter whoosh
  const PHASER_STAGES = 6;
  const allpassFilters = Array.from({ length: PHASER_STAGES }, () => {
    const ap = c.createBiquadFilter();
    ap.type = 'allpass';
    ap.frequency.value = 1000;   // center — LFO will sweep around this
    ap.Q.value = 0.5;            // gentle — wider Q = more dramatic notches
    return ap;
  });

  // Chain the allpass stages in series
  for (let i = 0; i < PHASER_STAGES - 1; i++) {
    allpassFilters[i].connect(allpassFilters[i + 1]);
  }

  // LFO: slow sweep (0.25 Hz) — subtle, ambient, not seasick
  const phaserLFO = c.createOscillator();
  const phaserLFOGain = c.createGain();
  phaserLFO.type = 'sine';
  phaserLFO.frequency.value = 0.25;     // one full sweep every 4 seconds
  phaserLFOGain.gain.value = 700;       // sweeps ±700Hz around center — musical range
  phaserLFO.connect(phaserLFOGain);
  // Modulate every allpass filter's frequency in sync
  allpassFilters.forEach(ap => phaserLFOGain.connect(ap.frequency));
  phaserLFO.start();

  // Phaser wet/dry mix — blend phased signal back with dry for depth
  const phaserWet  = c.createGain(); phaserWet.gain.value  = 0.5;
  const phaserDry  = c.createGain(); phaserDry.gain.value  = 0.5;
  const phaserOut  = c.createGain(); phaserOut.gain.value  = 1.0;

  // Reverb
  const conv = c.createConvolver();
  conv.buffer = buildCathedralReverb(c);
  const reverbGain = c.createGain();
  reverbGain.gain.value = 2.2;              // cathedral wet mix — very wet

  // Delay (dotted-eighth at tempo 72 ≈ 416ms, scaled per mood)
  const delay = c.createDelay(2.0);
  delay.delayTime.value = 0.38;             // updated per-chord in playMoodMusic
  const delayFB = c.createGain();
  delayFB.gain.value = 0.6;                // feedback — long trail of echoes
  const delayLP = c.createBiquadFilter();  // tame harsh delay repeats
  delayLP.type = 'lowpass'; delayLP.frequency.value = 3200;
  const delayGain = c.createGain();
  delayGain.gain.value = 0.6;              // delay send level — atmospheric

  // Dry path
  const dry = c.createGain();
  dry.gain.value = 0.45;                   // less dry so the space comes forward

  const master = c.createGain();
  master.gain.value = 0.72;

  // Wiring:
  // bus → phaserDry ──────────────────────┐
  //     → allpass[0..5] → phaserWet ──────┴→ phaserOut → dry  → master → destination
  //                                                     → delayGain → delay → ...
  //                                                     → conv → reverbGain → master
  const bus = c.createGain();
  bus.gain.value = 1.0;

  // Bus feeds both legs of phaser blend
  bus.connect(phaserDry);
  bus.connect(allpassFilters[0]);
  allpassFilters[PHASER_STAGES - 1].connect(phaserWet);
  phaserDry.connect(phaserOut);
  phaserWet.connect(phaserOut);

  // phaserOut feeds everything downstream
  phaserOut.connect(dry);
  phaserOut.connect(delayGain);
  phaserOut.connect(conv);

  delayGain.connect(delay);
  delay.connect(delayLP);
  delayLP.connect(delayFB);
  delayFB.connect(delay);          // feedback loop
  delayLP.connect(conv);           // delay also feeds reverb for smear

  conv.connect(reverbGain);

  // Chorus — two short delays whose times wobble slowly, panned left and right.
  // The slightly-out-of-step copies make the voices shimmer and sound wider.
  const chorusOut = c.createGain();
  chorusOut.gain.value = 0.4;
  [[0.018, 0.71, -0.7], [0.025, 0.93, 0.7]].forEach(([base, rate, pan]) => {
    const d = c.createDelay(0.1);
    d.delayTime.value = base;
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = rate;
    depth.gain.value = 0.003;              // ±3ms of wobble
    lfo.connect(depth); depth.connect(d.delayTime); lfo.start();
    const panner = c.createStereoPanner();
    panner.pan.value = pan;
    phaserOut.connect(d); d.connect(panner); panner.connect(chorusOut);
  });
  chorusOut.connect(dry);
  chorusOut.connect(conv);

  // Second echo — slower and softer than the first, a few distant repeats
  const echo = c.createDelay(3.0);
  echo.delayTime.value = 0.62;             // updated per-chord in playMoodMusic
  const echoFB = c.createGain();
  echoFB.gain.value = 0.35;
  const echoLP = c.createBiquadFilter();
  echoLP.type = 'lowpass'; echoLP.frequency.value = 2400;
  const echoSend = c.createGain();
  echoSend.gain.value = 0.3;
  const echoOut = c.createGain();
  echoOut.gain.value = 0.5;
  phaserOut.connect(echoSend);
  echoSend.connect(echo);
  echo.connect(echoLP);
  echoLP.connect(echoFB);
  echoFB.connect(echo);
  echoLP.connect(echoOut);
  echoOut.connect(master);

  dry.connect(master);
  reverbGain.connect(master);
  // Limiter — keeps the doubled reverb from clipping
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 12;
  limiter.attack.value = 0.003; limiter.release.value = 0.25;
  const trim = c.createGain();
  trim.gain.value = 0.85;                  // safety headroom after the limiter
  master.connect(limiter);
  limiter.connect(trim);
  trim.connect(c.destination);

  c._chain = { ctx: c, bus, delay, echo, dry, reverbGain, master };
  return c._chain;
}

// ── CHOIR voice ───────────────────────────────────────────────────────────────
// Simulates a section of singers on one pitch:
//   - 5 detuned unison oscillators (spread ±14 cents) for section width
//   - BiquadFilter vowel formant (bandpass centred on a vocal formant frequency)
//   - Slow attack (breath), long release (legato cut-off)
//   - LFO vibrato via OscillatorNode modulating frequency (kicks in after onset)
function choirVoice(c, bus, freq, startT, dur, gain, formantFreq = 800, vibratoDepth = 3.5) {
  const v = vol();
  let attack = 0.72 + Math.random() * 0.14;   // slower breath — epic swell in
  let release = 0.9;
  // Short notes squeeze the swell and fade to fit, so nothing is scheduled before the note starts
  if (attack + release > dur) { const k = dur / (attack + release); attack *= k; release *= k; }
  const sectionSize = 5;
  const detuneSpreads = [-14, -6, 0, 6, 14];     // cents per singer

  const sectionGain = c.createGain();
  sectionGain.gain.value = (gain * v) / sectionSize;

  // Formant filter — shapes the vowel character
  const formant = c.createBiquadFilter();
  formant.type = 'bandpass';
  formant.frequency.value = formantFreq;
  formant.Q.value = 6.0;

  // Second formant for richer vowel (two resonances = "ah" or "oh")
  const formant2 = c.createBiquadFilter();
  formant2.type = 'bandpass';
  formant2.frequency.value = formantFreq * 2.4;
  formant2.Q.value = 4.5;

  // Envelope
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, startT);
  env.gain.exponentialRampToValueAtTime(1.0, startT + attack);
  env.gain.setValueAtTime(1.0, startT + dur - release);
  env.gain.exponentialRampToValueAtTime(0.0001, startT + dur);

  // LFO vibrato — starts after attack settles
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 5.2 + Math.random() * 0.6; // 5.2–5.8 Hz natural vibrato
  lfoGain.gain.setValueAtTime(0, startT);
  lfoGain.gain.linearRampToValueAtTime(0, startT + attack + 0.18);
  lfoGain.gain.linearRampToValueAtTime(vibratoDepth, startT + attack + 0.55);
  lfo.connect(lfoGain);
  lfo.start(startT); lfo.stop(startT + dur + 0.1);

  // Build each singer oscillator
  detuneSpreads.forEach(cents => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.detune.value = cents;
    lfoGain.connect(osc.frequency);  // vibrato modulates frequency
    osc.connect(sectionGain);
    osc.start(startT); osc.stop(startT + dur + 0.15);
  });

  // Mix: unfiltered sine body + two formant layers
  sectionGain.connect(env);

  const formantMix = c.createGain(); formantMix.gain.value = 0.55;
  sectionGain.connect(formant); formant.connect(formantMix);
  sectionGain.connect(formant2); formant2.connect(formantMix);
  formantMix.connect(env);

  env.connect(bus);
}

// ── ORGAN voice ───────────────────────────────────────────────────────────────
// Additive synthesis: 8 drawbar harmonics at classic Hammond ratios
// Harmonics: 16', 8', 5⅓', 4', 2⅔', 2', 1⅗', 1'
// Drawbar levels per mood are passed in as an 8-element array (0–1)
const ORGAN_DRAWBARS = {
  joyful:      [0.5, 1.0, 0.4, 0.6, 0.2, 0.3, 0.1, 0.05],
  reflective:  [0.8, 1.0, 0.1, 0.3, 0.0, 0.1, 0.0, 0.0 ],
  tense:       [0.3, 0.9, 0.5, 0.4, 0.4, 0.2, 0.1, 0.05],
  melancholic: [0.9, 1.0, 0.0, 0.2, 0.0, 0.1, 0.0, 0.0 ],
  hopeful:     [0.4, 1.0, 0.3, 0.5, 0.2, 0.3, 0.1, 0.0 ],
  analytical:  [0.3, 0.8, 0.2, 0.6, 0.1, 0.4, 0.0, 0.0 ],
  nostalgic:   [0.7, 1.0, 0.2, 0.4, 0.1, 0.2, 0.0, 0.0 ],
  neutral:     [0.5, 1.0, 0.2, 0.4, 0.1, 0.2, 0.0, 0.0 ],
};
const DRAWBAR_RATIOS = [0.5, 1, 1.5, 2, 3, 4, 5, 8]; // harmonic multipliers

function organVoice(c, bus, freq, startT, dur, gain, moodLabel) {
  const v = vol();
  const drawbars = ORGAN_DRAWBARS[moodLabel] || ORGAN_DRAWBARS.neutral;

  // Classic organ: nearly instant attack, no natural decay (held tone)
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, startT);
  env.gain.linearRampToValueAtTime(gain * v, startT + 0.018);
  env.gain.setValueAtTime(gain * v, startT + dur - 0.025);
  env.gain.linearRampToValueAtTime(0.0001, startT + dur);

  // Subtle rotary-speaker chorus: two slightly detuned copies
  const rotaryDepth = 2.2;

  DRAWBAR_RATIOS.forEach((ratio, idx) => {
    const level = drawbars[idx];
    if (level < 0.01) return;
    const harmonicFreq = freq * ratio;

    [0, rotaryDepth, -rotaryDepth * 0.6].forEach((detuneCents, di) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = harmonicFreq;
      osc.detune.value = detuneCents;
      const hGain = c.createGain();
      hGain.gain.value = level * (di === 0 ? 0.6 : 0.2);
      osc.connect(hGain);
      hGain.connect(env);
      osc.start(startT);
      osc.stop(startT + dur + 0.05);
    });
  });

  env.connect(bus);
}

// ── Chord voicings per mood — rich extensions ─────────────────────────────────
const CHORD_VOICINGS = {
  joyful:      [ [0,4,7,11,14],    [0,4,7,11,16],   [0,5,7,11,14]   ],
  reflective:  [ [0,3,7,10,14],    [0,3,7,10,17],   [0,3,7,10,13]   ],
  tense:       [ [0,3,6,9],        [0,3,6,10],      [0,1,6,10]      ],
  melancholic: [ [0,3,7,10,13],    [0,3,7,10],      [0,2,3,7,10]    ],
  hopeful:     [ [0,4,7,11,14],    [0,4,7,9,14],    [0,4,7,11,16]   ],
  analytical:  [ [0,2,7,10],       [0,2,7,14],      [0,5,7,10]      ],
  nostalgic:   [ [0,4,7,9,14],     [0,4,7,12,16],   [0,4,7,9,12]    ],
  neutral:     [ [0,4,7,12],       [0,2,4,7],       [0,4,7,9]       ],
};

// Choir formant frequencies per voicing note index (root=low, upper=bright)
const FORMANTS = [280, 460, 640, 800, 920, 1080, 1200];

// ── Melody lines per mood ─────────────────────────────────────────────────────
const MELODIES = {
  joyful:      [[0,2,4,7,9,7,4],[4,7,9,11,12,11,9],[7,9,11,12,14,12,11]],
  reflective:  [[0,3,5,7,5,3,0],[3,5,7,10,7,5,3],[5,7,10,12,10,7,5]],
  tense:       [[0,1,3,6,3,1,0],[1,3,6,9,6,3,1],[0,3,6,9,10,9,6]],
  melancholic: [[0,2,3,5,3,2,0],[2,3,5,7,5,3,2],[0,3,5,7,10,7,5]],
  hopeful:     [[0,2,4,5,7,9,7],[2,4,5,7,9,11,9],[4,5,7,9,11,12,11]],
  analytical:  [[0,2,5,7,5,2,0],[2,5,7,9,7,5,2],[0,5,7,10,7,5,0]],
  nostalgic:   [[0,2,4,7,4,2,0],[2,4,7,9,7,4,2],[4,7,9,12,9,7,4]],
  neutral:     [[0,2,4,7,4,2,0],[2,4,7,9,7,4,2],[0,4,7,9,7,4,0]],
};

// ── Main music renderer ───────────────────────────────────────────────────────
// c defaults to the live speakers; pass an OfflineAudioContext to render to a file
export function playMoodMusic(profile, paraIndex, c = ctx()) {
  const chain = getChain(c);
  const root = getRootFreq(profile);
  const texture = getTexture(profile);
  const beat = 60 / getTempo(profile);
  const T = c.currentTime + 0.12;

  // Set delay time to dotted-eighth at current tempo (feels musical not slapback)
  chain.delay.delayTime.setValueAtTime(beat * 0.75, T);
  chain.echo.delayTime.setValueAtTime(Math.min(2.5, beat * 1.5), T);   // second echo: a dotted quarter

  // ── Epic master fade-in: bus swells from silence over 1.4s ───────────────
  chain.bus.gain.cancelScheduledValues(T);
  chain.bus.gain.setValueAtTime(0.0001, T);
  chain.bus.gain.exponentialRampToValueAtTime(1.0, T + 1.4);

  // ── Master fade-out: longer tail — 3.8s dissolve into reverb ────────────
  const chordDur = 4.0 + (1 - profile.energy) * 2.0;
  const fadeOutStart = T + chordDur - 0.2;
  const fadeOutEnd   = T + chordDur + 6.5;   // long enough to hear the reverb + echo tail
  chain.master.gain.cancelScheduledValues(T);
  chain.master.gain.setValueAtTime(0.75, T);              // headroom for the heavy reverb
  chain.master.gain.setValueAtTime(0.75, fadeOutStart);
  chain.master.gain.exponentialRampToValueAtTime(0.0001, fadeOutEnd);

  // ── Octave bounce — three stabs in the last second before silence ─────────
  // root → root+8va → root+15ma, each a quick breathy choir hit
  const bounceStart = T + chordDur + 2.5;  // fires deep in the fade tail
  [0, 12, 24].forEach((octSemi, i) => {
    const bf = root * Math.pow(2, octSemi / 12);
    const bt = bounceStart + i * 0.28;
    const bDur = 0.55;
    // One choir voice per bounce — fast attack, short duration, gentle gain
    const bosc = c.createOscillator();
    const benv = c.createGain();
    bosc.type = 'sine';
    bosc.frequency.value = bf;
    benv.gain.setValueAtTime(0.0001, bt);
    benv.gain.exponentialRampToValueAtTime(0.06 * vol(), bt + 0.04);
    benv.gain.exponentialRampToValueAtTime(0.0001, bt + bDur);
    bosc.connect(benv);
    benv.connect(chain.bus);
    bosc.start(bt);
    bosc.stop(bt + bDur + 0.05);
    // Detuned companion for width
    const bosc2 = c.createOscillator();
    const benv2 = c.createGain();
    bosc2.type = 'sine';
    bosc2.frequency.value = bf;
    bosc2.detune.value = 9;
    benv2.gain.setValueAtTime(0.0001, bt);
    benv2.gain.exponentialRampToValueAtTime(0.03 * vol(), bt + 0.05);
    benv2.gain.exponentialRampToValueAtTime(0.0001, bt + bDur);
    bosc2.connect(benv2);
    benv2.connect(chain.bus);
    bosc2.start(bt);
    bosc2.stop(bt + bDur + 0.05);
  });

  const voicings = CHORD_VOICINGS[profile.label] || CHORD_VOICINGS.neutral;
  const voicing  = voicings[paraIndex % voicings.length];

  // ── Bass foundation — deep organ sub-tone ────────────────────────────────
  organVoice(c, chain.bus, root / 2, T, chordDur * 1.15, 0.09, profile.label);

  // ── Per-note rendering: choir + organ layered on each chord tone ──────────
  voicing.forEach((semi, i) => {
    const freq   = root * Math.pow(2, semi / 12);
    const noteT  = T + (texture === 'rhythmic' ? i * 0.07 : 0); // stagger for rhythmic
    const formant = FORMANTS[Math.min(i, FORMANTS.length - 1)];

    // Choir — primary voice, pushed up in the mix
    const choirGain = texture === 'sparse' ? 0.17 : 0.14;
    choirVoice(c, chain.bus, freq, noteT, chordDur, choirGain, formant, profile.energy * 4.5);

    // Organ — supporting foundation, pulled back
    const orgGain = texture === 'sparse' ? 0.028 : 0.038;
    organVoice(c, chain.bus, freq, noteT, chordDur, orgGain, profile.label);
  });

  // ── Texture-specific additions ────────────────────────────────────────────
  if (texture === 'melodic' || texture === 'rich') {
    // Upper choir octave for brightness
    const topSemi = voicing[voicing.length - 1];
    choirVoice(c, chain.bus, root * Math.pow(2, (topSemi + 12) / 12),
      T + 0.18, chordDur * 0.9, 0.05, 1200, 2.5);
  }

  if (texture === 'melodic') {
    // Melody sung by choir, one octave up, lighter vibrato
    const mel = (MELODIES[profile.label] || MELODIES.neutral)[paraIndex % 3];
    const noteLen = beat * 0.62;
    mel.forEach((semi, i) => {
      const mf = root * Math.pow(2, (semi + 12) / 12);
      choirVoice(c, chain.bus, mf, T + i * beat * 0.40, noteLen, 0.08, 900, 2.8);
    });
  }

  if (texture === 'rhythmic') {
    // Punchy organ accents on beat subdivisions
    [0, beat * 0.5, beat, beat * 1.5].forEach(offset => {
      organVoice(c, chain.bus, root * 2, T + 0.55 + offset, beat * 0.22, 0.06, profile.label);
    });
  }

  if (texture === 'sparse') {
    // Just root + fifth choir, very open voicing, max reverb bloom
    // Already handled above — add a solo delayed colour note
    const colourFreq = root * Math.pow(2, voicing[voicing.length - 1] / 12);
    choirVoice(c, chain.bus, colourFreq, T + 1.6, chordDur - 1.0, 0.06, 700, 3.0);
  }

  // ── Paragraph 3 finale: full choir swell + resolution chord ──────────────
  if (paraIndex === 2) {
    const finaleVoicing = [0, 4, 7, 11, 14, 17]; // maj11 — maximum richness
    const fT = T + chordDur * 0.62;
    finaleVoicing.forEach((semi, i) => {
      const ff = root * Math.pow(2, semi / 12);
      choirVoice(c, chain.bus, ff, fT + i * 0.055, chordDur * 1.35, 0.09,
        FORMANTS[Math.min(i, FORMANTS.length-1)], 3.5);
      organVoice(c, chain.bus, ff, fT + i * 0.055, chordDur * 1.35, 0.05, profile.label);
    });
    // Sub-bass swell into the finale
    organVoice(c, chain.bus, root / 4, fT, chordDur * 1.4, 0.07, profile.label);
  }
}
