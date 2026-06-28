/* ConvoTranslater — frontend logic */

// ── DOM refs ─────────────────────────────────────────────────────────────────
const targetLangSelect  = document.getElementById('target-lang');
const btnA              = document.getElementById('btn-a');
const btnB              = document.getElementById('btn-b');
const btnBLabel         = document.getElementById('btn-b-label');
const btnAutoA          = document.getElementById('btn-auto-a');
const btnAutoB          = document.getElementById('btn-auto-b');
const btnAutoBLabel     = document.getElementById('btn-auto-b-label');
const btnStop           = document.getElementById('btn-stop');
const btnClear          = document.getElementById('btn-clear');
const statusText        = document.getElementById('status-text');
const pulse             = document.getElementById('pulse');
const conversationEl    = document.getElementById('conversation');
const browserWarning    = document.getElementById('browser-warning');
const modeManualBtn     = document.getElementById('mode-manual');
const modeAutoBtn       = document.getElementById('mode-auto');
const manualButtons     = document.getElementById('manual-buttons');
const autoButtons       = document.getElementById('auto-buttons');
const autoStart         = document.getElementById('auto-start');
const autoRunning       = document.getElementById('auto-running');
const turnA             = document.getElementById('turn-a');
const turnB             = document.getElementById('turn-b');
const vibeButtons       = {
  standard: document.getElementById('vibe-standard'),
  flirty:   document.getElementById('vibe-flirty'),
  slang:    document.getElementById('vibe-slang'),
};

// ── Languages ────────────────────────────────────────────────────────────────
// code → { name, speech: BCP-47 tag for recognition/TTS, flag: ISO 3166-1
// alpha-2 country code for flagcdn.com }. Add new languages here only.
const LANGUAGES = {
  ar: { name: 'Arabic',             speech: 'ar-SA', flag: 'sa' },
  zh: { name: 'Chinese (Mandarin)', speech: 'zh-CN', flag: 'cn' },
  cs: { name: 'Czech',              speech: 'cs-CZ', flag: 'cz' },
  da: { name: 'Danish',             speech: 'da-DK', flag: 'dk' },
  nl: { name: 'Dutch',              speech: 'nl-NL', flag: 'nl' },
  fi: { name: 'Finnish',            speech: 'fi-FI', flag: 'fi' },
  fr: { name: 'French',             speech: 'fr-FR', flag: 'fr' },
  de: { name: 'German',             speech: 'de-DE', flag: 'de' },
  el: { name: 'Greek',              speech: 'el-GR', flag: 'gr' },
  he: { name: 'Hebrew',             speech: 'he-IL', flag: 'il' },
  hi: { name: 'Hindi',              speech: 'hi-IN', flag: 'in' },
  hu: { name: 'Hungarian',          speech: 'hu-HU', flag: 'hu' },
  id: { name: 'Indonesian',         speech: 'id-ID', flag: 'id' },
  it: { name: 'Italian',            speech: 'it-IT', flag: 'it' },
  ja: { name: 'Japanese',           speech: 'ja-JP', flag: 'jp' },
  ko: { name: 'Korean',             speech: 'ko-KR', flag: 'kr' },
  no: { name: 'Norwegian',          speech: 'nb-NO', flag: 'no' },
  pl: { name: 'Polish',             speech: 'pl-PL', flag: 'pl' },
  pt: { name: 'Portuguese',         speech: 'pt-BR', flag: 'pt' },
  ro: { name: 'Romanian',           speech: 'ro-RO', flag: 'ro' },
  ru: { name: 'Russian',            speech: 'ru-RU', flag: 'ru' },
  sk: { name: 'Slovak',             speech: 'sk-SK', flag: 'sk' },
  es: { name: 'Spanish',            speech: 'es-ES', flag: 'es' },
  sv: { name: 'Swedish',            speech: 'sv-SE', flag: 'se' },
  th: { name: 'Thai',               speech: 'th-TH', flag: 'th' },
  tr: { name: 'Turkish',            speech: 'tr-TR', flag: 'tr' },
  uk: { name: 'Ukrainian',          speech: 'uk-UA', flag: 'ua' },
  vi: { name: 'Vietnamese',         speech: 'vi-VN', flag: 'vn' },
};
const langName   = (code) => code === 'en-US' ? 'English' : (LANGUAGES[code]?.name ?? code);
const speechLang = (code) => code === 'en-US' ? 'en-US'   : (LANGUAGES[code]?.speech ?? code);

// ── State ────────────────────────────────────────────────────────────────────
let mode        = 'manual';
let vibe        = 'standard';
let autoActive  = false;
let isBusy      = false;
let recognition = null;
let voices      = [];

// ── Voice support check ──────────────────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition || !window.speechSynthesis) {
  browserWarning.classList.remove('hidden');
}

// ── Load voices ──────────────────────────────────────────────────────────────
function loadVoices() { voices = window.speechSynthesis.getVoices(); }
loadVoices();
window.speechSynthesis.onvoiceschanged = loadVoices;

// ── Populate language dropdown ────────────────────────────────────────────────
targetLangSelect.innerHTML = '<option value="">— choose language —</option>' +
  Object.entries(LANGUAGES)
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([code, { name }]) => `<option value="${code}">${name}</option>`)
    .join('');

// ── Button state ─────────────────────────────────────────────────────────────
function updateButtons() {
  const hasLang = !!targetLangSelect.value;
  btnA.disabled     = isBusy || !hasLang;
  btnB.disabled     = isBusy || !hasLang;
  btnAutoA.disabled = !hasLang;
  btnAutoB.disabled = !hasLang;
}

// ── Language selection ────────────────────────────────────────────────────────
targetLangSelect.addEventListener('change', () => {
  const code = targetLangSelect.value;
  const name = LANGUAGES[code]?.name || '';
  btnBLabel.textContent     = code ? `Speak in ${name}` : 'Speak in...';
  btnAutoBLabel.textContent = code ? `${name} first`    : 'Start with...';
  updateButtons();
  setStatus(code ? `Ready — ${name} selected` : 'Select a language to begin', null);
  const flag = LANGUAGES[code]?.flag;
  if (flag) {
    conversationEl.style.setProperty('--flag-url', `url('https://flagcdn.com/w640/${flag}.png')`);
    conversationEl.classList.add('has-flag');
  } else {
    conversationEl.style.removeProperty('--flag-url');
    conversationEl.classList.remove('has-flag');
  }
  showEmpty();
});

// ── Mode toggle ───────────────────────────────────────────────────────────────
function switchMode(newMode) {
  mode = newMode;
  modeManualBtn.classList.toggle('toggle-active', mode === 'manual');
  modeAutoBtn.classList.toggle('toggle-active', mode === 'auto');
  manualButtons.classList.toggle('hidden', mode !== 'manual');
  autoButtons.classList.toggle('hidden', mode !== 'auto');
  if (mode === 'manual') stopAutoLoop();
}
modeManualBtn.addEventListener('click', () => switchMode('manual'));
modeAutoBtn.addEventListener('click', () => switchMode('auto'));

// ── Vibe toggle ───────────────────────────────────────────────────────────────
function switchVibe(newVibe) {
  vibe = newVibe;
  for (const [key, btn] of Object.entries(vibeButtons)) {
    btn.classList.toggle('toggle-active', key === vibe);
  }
}
for (const [key, btn] of Object.entries(vibeButtons)) {
  btn.addEventListener('click', () => switchVibe(key));
}

// ── Conversation rendering ────────────────────────────────────────────────────
function showEmpty() {
  conversationEl.innerHTML = `
    <div class="empty-state">
      <div class="icon">&#128172;</div>
      <p>Tap a button below to start speaking.<br>The other person will reply in their language.</p>
    </div>`;
}
showEmpty();

function addMessage({ speaker, loading }) {
  const empty = conversationEl.querySelector('.empty-state');
  if (empty) empty.remove();
  const group  = document.createElement('div');
  group.className = `message-group speaker-${speaker}`;
  const tag    = document.createElement('div');
  tag.className = 'speaker-tag';
  tag.textContent = speaker === 'a'
    ? 'Speaker A (English)'
    : `Speaker B (${langName(targetLangSelect.value)})`;
  const bubble = document.createElement('div');
  bubble.className = `bubble${loading ? ' loading' : ''}`;
  if (loading) bubble.innerHTML = `<div class="original"><div class="dots"><span></span><span></span><span></span></div></div>`;
  group.appendChild(tag);
  group.appendChild(bubble);
  conversationEl.appendChild(group);
  group.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return { group, bubble };
}

function updateMessage(bubble, { original, translation, speaker }) {
  bubble.classList.remove('loading');
  const arrow = speaker === 'a' ? '&#8594;' : '&#8592;';
  bubble.innerHTML = `
    <div class="original">${escHtml(original)}</div>
    <div class="translation">${arrow} ${escHtml(translation)}</div>`;
  bubble.closest('.message-group').scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Status ────────────────────────────────────────────────────────────────────
function setStatus(msg, type) {
  statusText.textContent = msg;
  pulse.className = type ?? 'hidden';
}
function setManualBusy(busy) {
  isBusy = busy;
  updateButtons();
}

// ── Shared AudioContext ───────────────────────────────────────────────────────
// We never call close() — iOS takes 15-20 s to release the audio session after
// close(). suspend()/resume() on a single long-lived context drops that to ~200 ms.
let sharedAC = null;

function initAC() {
  if (sharedAC && sharedAC.state !== 'closed') return;
  try { sharedAC = new (window.AudioContext || window.webkitAudioContext)(); }
  catch (_) { sharedAC = null; }
}

async function activateSpeaker() {
  if (!sharedAC) return;
  try {
    await sharedAC.resume();
    // 100 ms of silence — long enough for iOS to register the audio session switch
    const buf = sharedAC.createBuffer(1, Math.ceil(sharedAC.sampleRate * 0.1), sharedAC.sampleRate);
    const src = sharedAC.createBufferSource();
    src.buffer = buf;
    src.connect(sharedAC.destination);
    src.start(0);
  } catch (_) {}
}

async function suspendSpeaker() {
  if (sharedAC && sharedAC.state === 'running') {
    await sharedAC.suspend().catch(() => {});
  }
}

// Stop everything that holds the audio session: TTS, mic, AudioContext.
function resetAudio() {
  window.speechSynthesis.cancel();
  suspendSpeaker();
  if (recognition) { try { recognition.stop(); } catch (_) {} recognition = null; }
}

// ── Speech recognition ────────────────────────────────────────────────────────
function startListening(lang, callbacks = {}) {
  return new Promise((resolve, reject) => {
    if (!SpeechRecognition) return reject(new Error('No speech recognition'));

    const r = new SpeechRecognition();
    recognition = r;
    r.lang = lang;
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;

    let settled = false;
    const settle = (fn, val) => { if (!settled) { settled = true; fn(val); } };

    // If onaudiostart doesn't fire within 5 s the mic is still blocked
    const watchdog = setTimeout(() => {
      settle(reject, new Error('mic-unavailable'));
      try { r.stop(); } catch (_) {}
    }, 5000);

    r.onaudiostart  = () => { clearTimeout(watchdog); callbacks.onReady?.(); };
    r.onspeechstart = () => callbacks.onSpeech?.();
    r.onresult = (e) => settle(resolve, e.results[0][0].transcript.trim());
    r.onerror  = (e) => {
      clearTimeout(watchdog);
      if (e.error === 'aborted')          settle(reject, new Error('stopped'));
      else if (e.error === 'no-speech')   settle(reject, new Error('No speech detected — try again.'));
      else if (e.error === 'not-allowed') settle(reject, new Error('Microphone access denied.'));
      else if (e.error === 'audio-capture' || e.error === 'service-not-allowed')
                                          settle(reject, new Error('mic-unavailable'));
      else settle(reject, new Error(`Speech error: ${e.error}`));
    };
    r.onend = () => { clearTimeout(watchdog); recognition = null; settle(reject, new Error('stopped')); };
    r.start();
  });
}

// ── Text-to-speech ────────────────────────────────────────────────────────────
function primeTTS() {
  initAC(); // must be called within a user gesture so iOS allows AudioContext
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0; u.rate = 10;
    window.speechSynthesis.speak(u);
  } catch (_) {}
}

function speak(text, lang) {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    activateSpeaker().then(() => {
      setTimeout(() => {
        const u = new SpeechSynthesisUtterance(text);
        const base = lang.split('-')[0];
        const match = voices.find(v => v.lang === lang) ||
                      voices.find(v => v.lang.startsWith(lang)) ||
                      voices.find(v => v.lang.startsWith(base));
        if (match) u.voice = match;
        u.lang = lang;
        u.rate = 0.95;

        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          clearInterval(tick);
          clearTimeout(bail);
          // Cancel any still-playing audio, then wait for AC to suspend before
          // resolving — prevents the next turn's mic from opening while iOS is
          // still in playback mode.
          window.speechSynthesis.cancel();
          suspendSpeaker().then(() => resolve());
        };

        const speakStart = Date.now();
        const tick = setInterval(() => {
          // iOS sometimes pauses synthesis mid-utterance; nudge it along.
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
          // Fallback: if onend never fires (common on iOS for languages without
          // an installed voice), detect completion via speaking going false.
          if (!window.speechSynthesis.speaking && Date.now() - speakStart > 500) done();
        }, 100);

        const bail = setTimeout(done, 4000 + text.length * 70);

        u.onend   = done;
        u.onerror = done;
        window.speechSynthesis.speak(u);
      }, 400);
    });
  });
}

// ── Translation API ───────────────────────────────────────────────────────────
async function translate(text, fromLang, toLang) {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text, fromLang, toLang,
      fromLangName: langName(fromLang),
      toLangName: langName(toLang),
      vibe,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Translation failed');
  }
  return (await res.json()).translated;
}

// ── Core turn ─────────────────────────────────────────────────────────────────
async function executeTurn(speaker) {
  const targetCode = targetLangSelect.value;
  if (!targetCode) return false;

  const isA      = speaker === 'a';
  const fromCode = isA ? 'en-US' : targetCode;
  const toCode   = isA ? targetCode : 'en-US';

  try {
    // Cancel any lingering TTS, suspend AC, then give iOS time to release the
    // audio session before opening the mic.
    window.speechSynthesis.cancel();
    setStatus('Preparing mic…', null);
    await suspendSpeaker();
    await delay(500);

    let spoken = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) { setStatus('Preparing mic…', null); await delay(600); }
        spoken = await startListening(speechLang(fromCode), {
          onReady:  () => setStatus(`Listening for ${langName(fromCode)}…`, ''),
          onSpeech: () => setStatus('Got you, processing…', 'translating'),
        });
        break;
      } catch (err) {
        if (err.message !== 'mic-unavailable') throw err;
      }
    }
    if (!spoken) throw new Error('Microphone unavailable — please try again.');

    setStatus('Translating…', 'translating');
    const { bubble } = addMessage({ speaker, loading: true });
    const translated = await translate(spoken, fromCode, toCode);
    updateMessage(bubble, { original: spoken, translation: translated, speaker });

    setStatus(`Speaking ${langName(toCode)}…`, 'speaking');
    await speak(translated, speechLang(toCode));

    return true;
  } catch (err) {
    if (err.message !== 'stopped') setStatus(err.message || 'Something went wrong', null);
    return false;
  }
}

// ── Manual mode ───────────────────────────────────────────────────────────────
async function handleManualTurn(speaker) {
  if (isBusy || mode !== 'manual') return;
  primeTTS();
  setManualBusy(true);
  const btn = speaker === 'a' ? btnA : btnB;
  btn.classList.add('active');
  try {
    await executeTurn(speaker);
  } finally {
    btn.classList.remove('active');
    setManualBusy(false);
    setStatus('Ready', null);
  }
}

btnA.addEventListener('click', () => handleManualTurn('a'));
btnB.addEventListener('click', () => handleManualTurn('b'));

// ── Auto mode ─────────────────────────────────────────────────────────────────
function setTurnIndicator(speaker) {
  turnA.classList.toggle('hidden', speaker !== 'a');
  turnB.classList.toggle('hidden', speaker !== 'b');
  turnB.textContent = `${langName(targetLangSelect.value)} listening`;
}

async function startAutoLoop(firstSpeaker) {
  if (!targetLangSelect.value || autoActive) return;
  primeTTS();
  autoActive = true;
  autoStart.classList.add('hidden');
  autoRunning.classList.remove('hidden');

  let speaker = firstSpeaker;
  while (autoActive) {
    setTurnIndicator(speaker);
    const ok = await executeTurn(speaker);
    if (!autoActive) break;
    if (!ok) { await delay(900); continue; }
    speaker = speaker === 'a' ? 'b' : 'a';
    if (autoActive) { setStatus('Next speaker…', null); await delay(800); }
  }

  autoStart.classList.remove('hidden');
  autoRunning.classList.add('hidden');
  setStatus(targetLangSelect.value ? 'Ready' : 'Select a language to begin', null);
}

function stopAutoLoop() {
  if (!autoActive) return;
  autoActive = false;
  resetAudio();
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

btnAutoA.addEventListener('click', () => startAutoLoop('a'));
btnAutoB.addEventListener('click', () => startAutoLoop('b'));
btnStop.addEventListener('click', stopAutoLoop);

// ── Clear ─────────────────────────────────────────────────────────────────────
btnClear.addEventListener('click', () => {
  autoActive = false;
  resetAudio();
  isBusy = false;
  btnA.classList.remove('active');
  btnB.classList.remove('active');
  updateButtons();
  setStatus(targetLangSelect.value ? 'Ready' : 'Select a language to begin', null);
  showEmpty();
});
