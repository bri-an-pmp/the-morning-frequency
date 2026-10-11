// ─── Mood profiles ────────────────────────────────────────────────────────────
export const MOODS = {
  joyful:      { label:'joyful',      root:'C',  tempoBase:138, energy:0.85, valence:0.9,  color:'#a77a1f', desc:'C major · 138bpm · bright arpeggios',   scale:[0,2,4,7,9,12],       chord:[0,4,7,12],  pad:[0,7]     },
  reflective:  { label:'reflective',  root:'D',  tempoBase:62,  energy:0.3,  valence:0.5,  color:'#2e8770', desc:'D minor · 62bpm · slow sustained pad',    scale:[0,2,3,5,7,8,10,12],  chord:[0,3,7,12],  pad:[0,7,10]  },
  tense:       { label:'tense',       root:'B',  tempoBase:160, energy:0.9,  valence:0.15, color:'#c04b44', desc:'B dim · 160bpm · staccato pulses',        scale:[0,1,3,4,6,7,9,10,12],chord:[0,3,6,9],   pad:[0,6]     },
  melancholic: { label:'melancholic', root:'G',  tempoBase:52,  energy:0.2,  valence:0.2,  color:'#4c68ad', desc:'G minor · 52bpm · descending lines',      scale:[0,2,3,5,7,8,10,12],  chord:[0,3,7],     pad:[0,3,7,10]},
  hopeful:     { label:'hopeful',     root:'E',  tempoBase:92,  energy:0.65, valence:0.78, color:'#47862f', desc:'E major · 92bpm · rising phrases',        scale:[0,2,4,5,7,9,11,12],  chord:[0,4,7,11],  pad:[0,7]     },
  analytical:  { label:'analytical',  root:'A',  tempoBase:80,  energy:0.5,  valence:0.55, color:'#6c52b6', desc:'A dorian · 80bpm · minimal, sparse',     scale:[0,2,3,5,7,9,10,12],  chord:[0,5,7],     pad:[0,7]     },
  nostalgic:   { label:'nostalgic',   root:'F',  tempoBase:68,  energy:0.4,  valence:0.6,  color:'#a8634a', desc:'F major · 68bpm · waltz-like melody',    scale:[0,2,4,5,7,9,11,12],  chord:[0,4,7],     pad:[0,4,7]   },
  neutral:     { label:'neutral',     root:'C',  tempoBase:72,  energy:0.5,  valence:0.5,  color:'#607189',    desc:'C pentatonic · 72bpm · gentle chord tones',scale:[0,2,4,7,9,12],      chord:[0,4,7,12],  pad:[0,7]     }
};

export const ROOT_FREQ = { C:261.63, D:293.66, E:329.63, F:349.23, G:392.00, A:440.00, B:493.88, Bb:233.08 };

// ─── Mood analysis ────────────────────────────────────────────────────────────
export async function analyzeMood(text, apiKey) {
  if (!apiKey) return heuristicMood(text);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{
          role: 'user',
          content: `Analyze the emotional mood of this paragraph. Reply ONLY with valid JSON — no markdown, no explanation.

"${text.trim().slice(0,600)}"

Format: {"mood":"<joyful|reflective|tense|melancholic|hopeful|analytical|nostalgic|neutral>","energy":<0.0-1.0>,"valence":<0.0-1.0>,"reason":"<3-5 words>"}`
        }]
      })
    });
    const data = await res.json();
    const raw = data.content?.[0]?.text || '';
    const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());
    return MOODS[parsed.mood] ? parsed : heuristicMood(text);
  } catch(e) {
    console.warn('API mood failed, using heuristic', e);
    return heuristicMood(text);
  }
}

export function heuristicMood(text) {
  const t = text.toLowerCase();
  const signals = {
    joyful:      ['happy','joy','laugh','excit','love','wonderful','amazing','celebrat','fun','great'],
    melancholic: ['sad','grief','loss','mourn','depress','alone','lonely','miss','pain','sorrow'],
    tense:       ['stress','anxious','urgent','deadline','panic','crisis','fear','worry','danger'],
    hopeful:     ['hope','future','dream','will','plan','goal','promis','better','progress','forward'],
    reflective:  ['think','wonder','ponder','reflect','consider','maybe','perhaps','memory','remem'],
    analytical:  ['because','therefore','data','result','analysis','research','evidence','conclu'],
    nostalgic:   ['used to','back when','remember','years ago','childhood','old','once','then'],
  };
  const scores = {};
  for (const [mood, words] of Object.entries(signals)) {
    scores[mood] = words.filter(w => t.includes(w)).length;
  }
  const top = Object.entries(scores).sort((a,b) => b[1]-a[1])[0];
  if (top[1] === 0) return { mood:'neutral', energy:0.5, valence:0.5, reason:'no strong signal' };
  const p = MOODS[top[0]];
  return { mood:top[0], energy:p.energy, valence:p.valence, reason:'keyword match' };
}
