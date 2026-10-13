// Language: English or Central American Spanish (es-419, formal "usted").
// Page text: elements carry data-i18n / data-i18n-html / data-i18n-attr and are translated on load.
// Code text: t('key', { vars }). Switching language saves and reloads the page, so every part
// of the app simply reads the current language when it renders.
const STORE = 'tmf_lang';

export function getLang() {
  try {
    const saved = localStorage.getItem(STORE);
    if (saved === 'en' || saved === 'es') return saved;
  } catch (e) { /* fall through */ }
  return (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
}
export const LANG = getLang();
export const LOCALE = LANG === 'es' ? 'es-419' : 'en-US';
// Speech recognition language: the device's own Spanish if it has one, otherwise Latin American Spanish
export const SPEECH_LANG = LANG === 'es'
  ? ((navigator.language || '').toLowerCase().startsWith('es') ? navigator.language : 'es-MX')
  : (navigator.language || 'en-US');

export function setLang(lang) {
  try { localStorage.setItem(STORE, lang); } catch (e) { /* not essential */ }
}

// ── Text used by the code ────────────────────────────────────────────────────
const T = {
  en: {
    keyNotSet: 'Not set — using word matching.',
    keySaved: 'Saved — Claude is reading the mood of your writing.',
    keyBad: 'That doesn’t look like a Claude key — it should start with sk-ant-. Copy it again from console.anthropic.com.',
    keyRemoved: 'Removed — back to word matching.',
    keyNotUsed: 'Claude wasn’t used just now ({why}), so word matching picked the mood.',
    whyRejected: 'the key was rejected', whyCredit: 'the account may be out of credit', whyBusy: 'too many requests right now',
    whyDown: 'Claude is unavailable right now', whySlow: 'Claude took too long to answer', whyOffline: 'there was no connection to Claude',
    whyDaily: 'today’s safety limit of {n} Claude checks was reached; it resets tomorrow',
    reasonKeyword: 'keyword match', reasonNone: 'no strong signal', reasonBlank: 'blank line', reasonManual: 'manual',
    pipReplayTitle: 'replay paragraph {n} — {mood}', pipReplayLabel: 'Replay paragraph {n}, {mood}', pipEmpty: 'Paragraph {n}, not written yet',
    ringLabel: '{n} of {goal} paragraphs written',
    unlocked1: '♩ paragraph 1 unlocked', unlocked2: '♩♩ paragraph 2 unlocked', unlocked3: '♩♩♩ morning complete',
    paraUpdated: '♩ paragraph {n} updated', newLine: '♩ new line', paraN: '♩ paragraph {n}', replaying: '♩ replaying paragraph {n}',
    title0: 'Start writing.', title1: 'First paragraph done.', title2: 'Two down. One more to go.', title3: 'Morning frequency complete.',
    waiting: 'waiting for your first paragraph...', paraDoneLeft: 'paragraph {n} done — {left} to go',
    goalReached: 'goal reached — well done', keepGoing: '{n} paragraphs — keep going',
    wordsOne: '{n} word', wordsMany: '{n} words', parasOne: '{n} paragraph', parasMany: '{n} paragraphs',
    detectedOne: '{n} paragraph detected', detectedMany: '{n} paragraphs detected',
    welcomeBack: 'welcome back — keep writing', reopened: 'reopened {date} — tap a bar to hear it',
    confirmDelete: 'Delete this entry? This can’t be undone.',
    confirmReset: 'Start with a clean slate?\n\nThis erases this entry’s writing, name and music. Your other entries aren’t touched.',
    cleanSlate: 'clean slate — start writing whenever you’re ready',
    preparing: 'preparing...', preparingPct: 'preparing... {p}%',
    failedNet: 'That didn’t work — check your internet connection and try again.',
    streakNotif: '✦ {n}-day streak — {name}', streakTitle: '✦ {n}-day streak · {name}',
    streakSubCapped: 'Your reward: your streak’s frequencies in one piece — the latest {max} of your {paras} paragraphs over {days} days — ending with your {m}-day streak sound.',
    streakSub: 'Your reward: every frequency from your streak — {paras} over {days} days — in one piece, ending with your {m}-day streak sound.',
    playStreakMix: 'play streak mix', stop: 'stop', mixFailed: 'couldn’t prepare the mix', shareFailed: 'That didn’t work — try download instead.',
    streakFile: '{n}-day streak mix',
    makeStory: 'make story video', remakeStory: 'remake story video', makingStory: 'making your video...', makingStoryPct: 'making your video... {p}%',
    downloadVideo: 'download video', downloadPicture: 'download picture',
    storyShareTip: 'Tap “share to story”, choose Instagram, TikTok or Facebook, then pick Story.',
    storyDownloadTip: 'Download it, then post it to your story from your phone.',
    storyPictureNote: ' (This browser can’t make videos, so you get a picture instead.)',
    storyInterrupted: 'The video stopped because you left this screen. Keep the app open for the 20 seconds it takes, then tap make story video again.',
    storyFailed: 'Sorry, the video couldn’t be made on this device. Try again, or use a different browser.',
    writeFirst: 'write something first, then finish your session',
    finishSub: '{paras}, {words} — download your writing and music, or save them to the cloud.',
    shareMenuNote: '“save to cloud / share” opens your device’s share menu — iCloud Drive, Google Drive, Dropbox, email and more.',
    noMusicYet: 'No music yet — press Enter twice after a paragraph to create some.',
    notesLater: 'Tap the button, choose Notes, then tap where it says “New Note” and pick your Morning Frequency note. Today is added underneath, with its own date and title.',
    notesFirst: 'Tap the button and choose Notes to start your Morning Frequency note. On later days, pick that same note instead of “New Note” and each day is added underneath.',
    notesCopied: 'Copied. Open Notes, open your Morning Frequency note, tap at the very bottom and paste.',
    notesSent: 'Sent. If you picked your Morning Frequency note, today is now at the bottom of it.',
    notesFailed: 'That didn’t work. Try again, or use download pdf.',
    notesDialog: 'Save to Apple Notes', notesMoods: 'Moods',
    // voice
    voiceStart: '🎤 speak instead of typing', voiceStop: '■ stop listening',
    voiceTipPause: 'Listening… When you finish a thought, say “new paragraph”, or just pause for 5 seconds, to hear your music.',
    voiceTip: 'Listening… When you finish a thought, say “new paragraph” to hear your music.',
    voiceHeard: 'hearing: “{text}”', voicePaused: '♪ You paused, so here’s your music. Keep talking for your next paragraph.',
    voiceGotIt: '♪ Got it, here’s your music. Keep talking for your next paragraph.',
    voiceLast: '♪ Here’s the music for your last paragraph. Tap the button to keep talking.',
    voiceNoMic: 'The microphone is turned off for this page. Allow the microphone in your browser or phone settings, then tap the button again.',
    voiceOffline: 'Speaking needs an internet connection. Check your connection and try again.',
    voiceStopped: 'Listening stopped. Tap the button to try again.', voiceCantStart: 'Listening couldn’t start. Tap the button to try again.',
    voiceKeyboardApple: 'Tap the writing box, then tap the microphone key on your keyboard and talk. Say “new paragraph” when you finish a thought, and your music plays.',
    voiceKeyboardOther: 'This browser can’t listen directly. Use the microphone key on your keyboard, and say “new paragraph” when you finish a thought. Or try Chrome or Safari.',
    // circle of fifths
    cofTurnOrTap: 'turn or tap', cofHome: 'home', cofPreview: '▶ hear your path · 5 sec', cofPlaying: '♪ playing…',
    cofPick: 'Turn the wheel or tap a key to choose your home key. The rest of the circle fills in to show where your music goes next.',
    cofHomeLine: '<strong>Home: {key}.</strong> Each paragraph moves one step around the circle ({path} …), so every paragraph flows into the next.',
    cofFamilyLine: '<strong>Highlighted:</strong> your key family ({family}), the chords that always harmonize with {home}.',
    cofNextLine: '<strong>Next paragraph:</strong> {key}.',
    major: 'major', minor: 'minor',
    // history and calendar
    today: 'Today', yesterday: 'Yesterday', prev7: 'Previous 7 days', prev30: 'Previous 30 days',
    historyEmpty: 'Your entries will appear here as you write.', deleteEntry: 'Delete entry', deleteEntryNamed: 'Delete entry: {title}',
    emptyEntry: 'Empty entry', prevMonth: 'Previous month', nextMonth: 'Next month',
    weekdays: 'S,M,T,W,T,F,S', dayEntriesOne: '{date}, 1 entry', dayEntriesMany: '{date}, {n} entries',
    streakOne: '1-day streak', streakMany: '{n}-day streak', startStreak: 'Start your streak today',
    nextStreakSound: 'next streak sound at {n} days', playYourStreakMix: '♫ play your streak mix',
    entriesInOne: '1 entry in {month}', entriesInMany: '{n} entries in {month}',
    // themes and story video
    themeSky: 'sky (original)', themeFollow: 'follow my mood — changes as you write', themeFollowShort: 'follow my mood', themeAria: 'Theme: {name}',
    storyCta: 'write yours →',
  },
  es: {
    keyNotSet: 'Sin clave: se usan palabras clave.',
    keySaved: 'Guardada: Claude está leyendo el ánimo de lo que escribe.',
    keyBad: 'Eso no parece una clave de Claude: debe empezar con sk-ant-. Cópiela de nuevo en console.anthropic.com.',
    keyRemoved: 'Clave quitada: se vuelven a usar palabras clave.',
    keyNotUsed: 'Esta vez no se usó Claude ({why}), así que el ánimo se eligió por palabras clave.',
    whyRejected: 'la clave fue rechazada', whyCredit: 'puede que la cuenta no tenga crédito', whyBusy: 'hay demasiadas solicitudes en este momento',
    whyDown: 'Claude no está disponible en este momento', whySlow: 'Claude tardó demasiado en responder', whyOffline: 'no hubo conexión con Claude',
    whyDaily: 'se alcanzó el límite de seguridad de hoy ({n} consultas a Claude); se reinicia mañana',
    reasonKeyword: 'por palabras clave', reasonNone: 'sin señal clara', reasonBlank: 'línea en blanco', reasonManual: 'elegido por usted',
    pipReplayTitle: 'volver a escuchar el párrafo {n} — {mood}', pipReplayLabel: 'Volver a escuchar el párrafo {n}, {mood}', pipEmpty: 'Párrafo {n}, todavía sin escribir',
    ringLabel: '{n} de {goal} párrafos escritos',
    unlocked1: '♩ párrafo 1 desbloqueado', unlocked2: '♩♩ párrafo 2 desbloqueado', unlocked3: '♩♩♩ mañana completa',
    paraUpdated: '♩ párrafo {n} actualizado', newLine: '♩ nueva línea', paraN: '♩ párrafo {n}', replaying: '♩ repitiendo el párrafo {n}',
    title0: 'Empiece a escribir.', title1: 'Primer párrafo listo.', title2: 'Van dos. Falta uno.', title3: 'Frecuencia de la mañana completa.',
    waiting: 'esperando su primer párrafo...', paraDoneLeft: 'párrafo {n} listo — {left} por escribir',
    goalReached: 'meta cumplida — ¡muy bien!', keepGoing: '{n} párrafos — siga así',
    wordsOne: '{n} palabra', wordsMany: '{n} palabras', parasOne: '{n} párrafo', parasMany: '{n} párrafos',
    detectedOne: '{n} párrafo detectado', detectedMany: '{n} párrafos detectados',
    welcomeBack: '¡hola de nuevo! — siga escribiendo', reopened: 'entrada del {date} — toque una barra para escucharla',
    confirmDelete: '¿Borrar esta entrada? No se puede deshacer.',
    confirmReset: '¿Empezar de cero?\n\nEsto borra lo escrito, el nombre y la música de esta entrada. Sus otras entradas no se tocan.',
    cleanSlate: 'página en blanco — empiece a escribir cuando guste',
    preparing: 'preparando...', preparingPct: 'preparando... {p}%',
    failedNet: 'No funcionó. Revise su conexión a internet e intente de nuevo.',
    streakNotif: '✦ racha de {n} días — {name}', streakTitle: '✦ racha de {n} días · {name}',
    streakSubCapped: 'Su premio: las frecuencias de su racha en una sola pieza — los últimos {max} de sus {paras} párrafos en {days} días — y al final, el sonido de su racha de {m} días.',
    streakSub: 'Su premio: todas las frecuencias de su racha — {paras} en {days} días — en una sola pieza, y al final, el sonido de su racha de {m} días.',
    playStreakMix: 'escuchar la mezcla de su racha', stop: 'detener', mixFailed: 'no se pudo preparar la mezcla', shareFailed: 'No funcionó. Intente descargarla.',
    streakFile: 'mezcla de racha de {n} días',
    makeStory: 'hacer video para historias', remakeStory: 'volver a hacer el video', makingStory: 'haciendo su video...', makingStoryPct: 'haciendo su video... {p}%',
    downloadVideo: 'descargar video', downloadPicture: 'descargar imagen',
    storyShareTip: 'Toque “compartir en historias”, elija Instagram, TikTok o Facebook y luego escoja Historia.',
    storyDownloadTip: 'Descárguelo y luego publíquelo en sus historias desde su celular.',
    storyPictureNote: ' (Este navegador no puede hacer videos, así que recibe una imagen.)',
    storyInterrupted: 'El video se detuvo porque usted salió de esta pantalla. Mantenga la app abierta los 20 segundos que tarda y vuelva a tocar “hacer video para historias”.',
    storyFailed: 'Lo sentimos, no se pudo hacer el video en este aparato. Intente de nuevo o use otro navegador.',
    writeFirst: 'escriba algo primero y luego termine su sesión',
    finishSub: '{paras}, {words} — descargue lo que escribió y su música, o guárdelos en la nube.',
    shareMenuNote: '“guardar en la nube / compartir” abre el menú para compartir de su aparato: iCloud Drive, Google Drive, Dropbox, correo y más.',
    noMusicYet: 'Todavía no hay música: presione Enter dos veces después de un párrafo para crearla.',
    notesLater: 'Toque el botón, elija Notas, luego toque donde dice “Nota nueva” y escoja su nota de The Morning Frequency. El día de hoy se agrega abajo, con su propia fecha y título.',
    notesFirst: 'Toque el botón y elija Notas para empezar su nota de The Morning Frequency. Los días siguientes, escoja esa misma nota en lugar de “Nota nueva” y cada día se agrega abajo.',
    notesCopied: 'Copiado. Abra Notas, abra su nota de The Morning Frequency, toque al final y pegue.',
    notesSent: 'Enviado. Si escogió su nota de The Morning Frequency, el día de hoy ya está al final.',
    notesFailed: 'No funcionó. Intente de nuevo o use descargar PDF.',
    notesDialog: 'Guardar en Notas de Apple', notesMoods: 'Ánimo',
    voiceStart: '🎤 hablar en vez de escribir', voiceStop: '■ dejar de escuchar',
    voiceTipPause: 'Escuchando… Cuando termine una idea, diga “nuevo párrafo”, o simplemente haga una pausa de 5 segundos, para escuchar su música.',
    voiceTip: 'Escuchando… Cuando termine una idea, diga “nuevo párrafo” para escuchar su música.',
    voiceHeard: 'escuchando: “{text}”', voicePaused: '♪ Hizo una pausa, así que aquí está su música. Siga hablando para su próximo párrafo.',
    voiceGotIt: '♪ Listo, aquí está su música. Siga hablando para su próximo párrafo.',
    voiceLast: '♪ Aquí está la música de su último párrafo. Toque el botón para seguir hablando.',
    voiceNoMic: 'El micrófono está desactivado para esta página. Permita el micrófono en la configuración del navegador o del celular y vuelva a tocar el botón.',
    voiceOffline: 'Para hablar se necesita conexión a internet. Revise su conexión e intente de nuevo.',
    voiceStopped: 'Se dejó de escuchar. Toque el botón para intentar de nuevo.', voiceCantStart: 'No se pudo empezar a escuchar. Toque el botón para intentar de nuevo.',
    voiceKeyboardApple: 'Toque el cuadro de escritura, luego la tecla del micrófono en su teclado, y hable. Diga “nuevo párrafo” cuando termine una idea y su música sonará.',
    voiceKeyboardOther: 'Este navegador no puede escuchar directamente. Use la tecla del micrófono de su teclado y diga “nuevo párrafo” cuando termine una idea. O pruebe con Chrome o Safari.',
    cofTurnOrTap: 'gire o toque', cofHome: 'tónica', cofPreview: '▶ escuchar su recorrido · 5 seg', cofPlaying: '♪ sonando…',
    cofPick: 'Gire la rueda o toque una tonalidad para elegir su tónica. El resto del círculo se completa para mostrar hacia dónde va su música.',
    cofHomeLine: '<strong>Tónica: {key}.</strong> Cada párrafo avanza un paso en el círculo ({path} …), así cada párrafo fluye hacia el siguiente.',
    cofFamilyLine: '<strong>Resaltados:</strong> la familia de su tonalidad ({family}), los acordes que siempre armonizan con {home}.',
    cofNextLine: '<strong>Próximo párrafo:</strong> {key}.',
    major: 'mayor', minor: 'menor',
    today: 'Hoy', yesterday: 'Ayer', prev7: 'Últimos 7 días', prev30: 'Últimos 30 días',
    historyEmpty: 'Sus entradas aparecerán aquí mientras escribe.', deleteEntry: 'Borrar entrada', deleteEntryNamed: 'Borrar entrada: {title}',
    emptyEntry: 'Entrada vacía', prevMonth: 'Mes anterior', nextMonth: 'Mes siguiente',
    weekdays: 'D,L,M,M,J,V,S', dayEntriesOne: '{date}, 1 entrada', dayEntriesMany: '{date}, {n} entradas',
    streakOne: 'racha de 1 día', streakMany: 'racha de {n} días', startStreak: 'Empiece su racha hoy',
    nextStreakSound: 'próximo sonido de racha a los {n} días', playYourStreakMix: '♫ escuchar la mezcla de su racha',
    entriesInOne: '1 entrada en {month}', entriesInMany: '{n} entradas en {month}',
    themeSky: 'cielo (original)', themeFollow: 'seguir mi ánimo — cambia mientras escribe', themeFollowShort: 'seguir mi ánimo', themeAria: 'Tema: {name}',
    storyCta: 'escriba la suya →',
  },
};

export function t(key, vars = {}) {
  const s = (T[LANG] && T[LANG][key]) ?? T.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}
// Singular / plural pairs, e.g. tn('words', 1) → "1 word"
export function tn(base, n, vars = {}) {
  return t(base + (n === 1 ? 'One' : 'Many'), { n, ...vars });
}

// ── Moods ─────────────────────────────────────────────────────────────────────
const MOOD_ES = {
  joyful: 'alegre', reflective: 'reflexivo', tense: 'tenso', melancholic: 'melancólico', hopeful: 'esperanzado',
  analytical: 'analítico', nostalgic: 'nostálgico', grateful: 'agradecido', groovy: 'con sabor', loving: 'cariñoso',
  celebratory: 'de fiesta', dreamy: 'soñador', 'alegría': 'alegría', duende: 'duende', ternura: 'ternura',
};
const MEANING_ES = {
  joyful: 'felicidad luminosa', reflective: 'pensamiento tranquilo', tense: 'estrés o preocupación', melancholic: 'tristeza o pérdida',
  hopeful: 'mirar hacia adelante', analytical: 'resolver cosas', nostalgic: 'mirar hacia atrás',
  grateful: 'gratitud, calidez de góspel', groovy: 'funk, energía, movimiento', loving: 'romance o cariño',
  celebratory: 'un logro, una fiesta, un triunfo', dreamy: 'imaginación, flotar, preguntarse',
  'alegría': 'alegría desbordante (flamenco)', duende: 'pasión profunda, alma pura (flamenco)', ternura: 'ternura, cuidado tierno (bolero)',
};
// Third part of each mood's description ("bright arpeggios"…)
const STYLE_ES = {
  'bright arpeggios': 'arpegios brillantes', 'slow sustained pad': 'fondo lento y sostenido', 'staccato pulses': 'pulsos cortos',
  'descending lines': 'líneas que descienden', 'rising phrases': 'frases que suben', 'minimal, sparse': 'mínima y espaciada',
  'waltz-like melody': 'melodía de vals', 'gospel ninths, full organ': 'novenas de góspel, órgano completo',
  'funky clav stabs': 'golpes de clavinet con funk', 'soft major sevenths': 'séptimas mayores suaves',
  'horn-section unison runs': 'corridas de metales al unísono', 'floating major-seven chords': 'acordes de séptima mayor que flotan',
  'flamenco alegrías, bright I–IV–V': 'alegrías flamencas, I–IV–V brillante', 'Andalusian cadence': 'cadencia andaluza',
  'bolero, gentle sixths and ninths': 'bolero, sextas y novenas suaves',
};
const QUALITY_ES = { major: 'mayor', minor: 'menor', dim: 'disminuido', dorian: 'dórico', lydian: 'lidio', phrygian: 'frigio' };

export function moodName(label) { return LANG === 'es' ? (MOOD_ES[label] || label) : label; }
export function moodMeaning(label, english) { return LANG === 'es' ? (MEANING_ES[label] || english) : english; }
export function styleText(text) { return LANG === 'es' ? (STYLE_ES[text] || text) : text; }
export function qualityText(q) { return LANG === 'es' ? (QUALITY_ES[q] || q) : q; }
export function reasonText(reason) {
  const map = { 'keyword match': 'reasonKeyword', 'no strong signal': 'reasonNone', 'blank line': 'reasonBlank', manual: 'reasonManual' };
  return map[reason] ? t(map[reason]) : reason;
}

// Note names: C D E… in English, Do Re Mi… in Spanish (as taught in Central America)
const NOTE_ES = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
export function noteName(name) {
  if (LANG !== 'es' || !name) return name;
  return name.replace(/^([A-G])/, (m, l) => NOTE_ES[l]).replace(/^(\w+?)b$/, '$1♭');
}

const STREAK_ES = {
  'First Light': 'Primera luz', 'Morning Bells': 'Campanas de la mañana', 'Rising Sun': 'Sol naciente',
  Fortnight: 'Quincena', 'Three Weeks': 'Tres semanas', 'Full Frequency': 'Frecuencia completa',
};
export function streakName(name) { return LANG === 'es' ? (STREAK_ES[name] || name) : name; }

// ── Page text ─────────────────────────────────────────────────────────────────
const PAGE_ES = {
  entriesTitle: 'Sus entradas', newEntryTop: '+ nueva entrada', showEntries: 'Mostrar sus entradas', showCalendar: 'Mostrar calendario',
  textSize: 'Tamaño del texto', textSizeLabel: 'tamaño', tsNormal: 'Texto normal', tsLarge: 'Texto grande', tsXL: 'Texto extra grande',
  font: 'Tipo de letra', fontLabel: 'letra', fontSerifTitle: 'Parecida a la letra de lectura de Claude (Source Serif 4)',
  fontSansTitle: 'Parecida a la letra de la interfaz de Claude (Inter)', fontEasy: 'Fácil de leer',
  fontEasyTitle: 'Atkinson Hyperlegible, diseñada para personas con baja visión', langLabel: 'idioma',
  howTo: 'Encienda el sonido y escriba un párrafo abajo, del largo que quiera, aunque sea una palabra. <strong>Presione Enter (intro) dos veces para escuchar su frecuencia y empezar un nuevo párrafo.</strong> Cuando termine 3 párrafos, toque <strong>Terminar sesión</strong> abajo para guardar lo que escribió y su música.',
  ringOf: 'de 3', ringStart: '0 de 3 párrafos escritos', progressTitle: 'Empiece a escribir.',
  progressSub: 'Cada párrafo desbloquea música hecha a la medida de lo que escribió. Complete 3 para su frecuencia de la mañana.',
  pip1: 'Párrafo 1, todavía sin escribir', pip2: 'Párrafo 2, todavía sin escribir', pip3: 'Párrafo 3, todavía sin escribir',
  pipHint: 'toque una barra para volver a escuchar ese párrafo', analyzing: 'leyendo el ánimo...', waiting: 'esperando su primer párrafo...',
  musicSettings: 'ajustes de música', overrideAria: 'Desactivar la detección del ánimo y elegirlo usted', override: 'elegir el ánimo manualmente',
  selectMood: 'elija el ánimo', tempo: 'ajuste de tempo (ppm)', tempoAria: 'Ajuste de tempo en pulsos por minuto', volume: 'volumen', volumeAria: 'Volumen',
  reverb: 'reverberación — espacio de catedral', reverbAria: 'Cantidad de reverberación', delay: 'delay — ecos', delayAria: 'Cantidad de delay',
  keyPref: 'tonalidad', keyPrefAria: 'Tonalidad', optCircle: 'círculo de quintas', optAuto: 'automática (según el ánimo)',
  optC: 'Do mayor / La menor', optG: 'Sol mayor / Mi menor', optD: 'Re mayor / Si menor', optF: 'Fa mayor / Re menor', optBb: 'Si♭ mayor / Sol menor',
  texture: 'textura / voz', textureAria: 'Textura o voz', optTexAuto: 'automática (según el ánimo)', optSparse: 'sencilla — pocas notas',
  optRich: 'rica — acordes completos y fondo', optMelodic: 'melódica — la frase primero', optRhythmic: 'rítmica — con pulso marcado',
  cofDirAria: 'Dirección en el círculo', cofCW: '↻ a favor del reloj — más brillante, cada paso sube una quinta',
  cofCCW: '↺ en contra del reloj — regresa a casa, cada paso baja una quinta', cofPreview: '▶ escuchar su recorrido · 5 seg',
  aiSummary: 'Lectura del ánimo más inteligente con Claude IA', optional: 'opcional',
  aiWhat: '<strong>Qué hace:</strong> por sí sola, la app adivina su ánimo a partir de ciertas palabras como “feliz” o “preocupado”, así que lo que escribe sin esas palabras suele recibir un ánimo genérico. Con una clave de Claude, la inteligencia artificial Claude lee todo su párrafo, y la música refleja lo que de verdad quiere decir.',
  aiCost: '<strong>Cuánto cuesta:</strong> alrededor de una quinta parte de un centavo de dólar por mañana, que se le paga a Anthropic (la empresa que hace Claude), no a nosotros. Anthropic pide $5 de crédito para empezar, lo que alcanza para años de escritura diaria.',
  aiHow: '<strong>Cómo configurarla</strong> (unos 5 minutos):',
  aiStep1: 'Vaya a <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a> y cree una cuenta.',
  aiStep2: 'Abra <strong>Billing</strong> (facturación) y agregue $5 de crédito. Luego, en <strong>Settings → Limits</strong>, ponga un límite de gasto mensual (por ejemplo, $5) para que una clave perdida o robada nunca le cueste más que eso.',
  aiStep3: 'Abra <strong>API Keys</strong>, haga clic en <strong>Create Key</strong> y cópiela (empieza con <code>sk-ant-</code>).',
  aiStep4: 'Péguela abajo y toque <strong>guardar</strong>.',
  yourKey: 'su clave de Claude', keyPlaceholder: 'pegue su clave (sk-ant-...)', keyAria: 'Su clave de API de Claude', save: 'guardar', remove: 'quitar',
  keyNotSet: 'Sin clave: se usan palabras clave.',
  aiPrivacy: 'Su clave se guarda solo en este aparato, y la app nunca la usa más de 60 veces al día. Use una clave hecha solo para esta app, nunca una que use en otro lado. Con clave, cada párrafo se envía a Anthropic para leer su ánimo. Sin clave, lo que escribe nunca sale de su aparato.',
  enterHint: '↵ ↵ &nbsp;Presione Enter (intro) dos veces, o diga “nuevo párrafo”, para escuchar su frecuencia y empezar un nuevo párrafo.',
  entryName: 'Póngale nombre (opcional)', entryNameAria: 'Nombre de la entrada',
  voiceHelp: 'Toque y hable. Cuando termine una idea, diga <strong>“nuevo párrafo”</strong> para escuchar su música<span id="voice-help-pause"> — o simplemente haga una pausa de 5 segundos</span>.',
  voiceAutopause: 'Poner mi música cuando haga una pausa de 5 segundos',
  writingAria: 'Lo que escribe', writingPlaceholder: 'Escriba un párrafo aquí y luego presione Enter (intro) dos veces...',
  words0: '0 palabras', paras0: '0 párrafos detectados',
  streakAria: 'Premio por racha', close: 'Cerrar', streakPlay: 'escuchar la mezcla de su racha', downloadWavShort: 'descargar (.wav)',
  shareCloud: 'guardar en la nube / compartir', goalTitle: 'Frecuencia de la mañana completa.', goalSub: '3 párrafos escritos. Siga escribiendo o regrese mañana.',
  reset: 'reiniciar', resetTitle: 'Borrar lo escrito, el nombre y la música de esta entrada y empezar de cero',
  newEntry: 'nueva entrada', newEntryTitle: 'Guardar esta entrada en su historial y empezar una nueva', finish: 'terminar sesión',
  finishTitle: 'Sesión terminada.', finishSub: 'Descargue lo que escribió y su música, o guárdelos en la nube.', yourWriting: 'lo que escribió',
  downloadDocx: 'descargar Word (.docx)', downloadPdf: 'descargar PDF', saveNotes: 'guardar en Notas de Apple', yourMusic: 'su música',
  downloadWav: 'descargar audio (.wav)', yourStory: 'su historia',
  storySub: 'Un video corto de su música para las historias de Instagram, TikTok o Facebook. Lo que escribe se mantiene privado a menos que agregue una frase.',
  storyLine: 'agregue una frase de lo que escribió (opcional)', storyLineAria: 'Frase opcional para mostrar en su video',
  makeStory: 'hacer video para historias', storyImage: 'Su imagen para historias', shareStory: 'compartir en historias', downloadVideo: 'descargar video',
  calendarAria: 'Calendario', theme: 'Tema de colores', calendar: 'Calendario',
};

export function translatePage() {
  document.documentElement.lang = LANG === 'es' ? 'es-419' : 'en';
  document.documentElement.dataset.lang = LANG;
  if (LANG === 'en') return;   // the page is written in English
  document.querySelectorAll('[data-i18n]').forEach(el => { const s = PAGE_ES[el.dataset.i18n]; if (s) el.textContent = s; });
  // Only our own fixed strings above go in as HTML (never user text)
  document.querySelectorAll('[data-i18n-html]').forEach(el => { const s = PAGE_ES[el.dataset.i18nHtml]; if (s) el.innerHTML = s; });
  document.querySelectorAll('[data-i18n-attr]').forEach(el => {
    el.dataset.i18nAttr.split(';').forEach(pair => {
      const [attr, key] = pair.split('=');
      if (PAGE_ES[key]) el.setAttribute(attr.trim(), PAGE_ES[key]);
    });
  });
}
