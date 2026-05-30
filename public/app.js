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

// ── State ────────────────────────────────────────────────────────────────────
const languages = {
  ar: 'Arabic', zh: 'Chinese (Mandarin)', cs: 'Czech', da: 'Danish',
  nl: 'Dutch', fi: 'Finnish', fr: 'French', de: 'German', el: 'Greek',
  he: 'Hebrew', hi: 'Hindi', hu: 'Hungarian', id: 'Indonesian',
  it: 'Italian', ja: 'Japanese', ko: 'Korean', no: 'Norwegian',
  pl: 'Polish', pt: 'Portuguese', ro: 'Romanian', ru: 'Russian',
  es: 'Spanish', sv: 'Swedish', th: 'Thai', tr: 'Turkish',
  uk: 'Ukrainian', vi: 'Vietnamese',
};

// Full BCP-47 tags iOS needs for both recognition and TTS
const SPEECH_LANG = {
  'en-US': 'en-US',
  ar: 'ar-SA', zh: 'zh-CN', cs: 'cs-CZ', da: 'da-DK',
  nl: 'nl-NL', fi: 'fi-FI', fr: 'fr-FR', de: 'de-DE', el: 'el-GR',
  he: 'he-IL', hi: 'hi-IN', hu: 'hu-HU', id: 'id-ID',
  it: 'it-IT', ja: 'ja-JP', ko: 'ko-KR', no: 'nb-NO',
  pl: 'pl-PL', pt: 'pt-BR', ro: 'ro-RO', ru: 'ru-RU',
  es: 'es-ES', sv: 'sv-SE', th: 'th-TH', tr: 'tr-TR',
  uk: 'uk-UA', vi: 'vi-VN',
};
const speechLang = (code) => SPEECH_LANG[code] || code;

let mode        = 'manual'; // 'manual' | 'auto'
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
  Object.entries(languages)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([code, name]) => `<option value="${code}">${name}</option>`)
    .join('');

// ── Language selection ────────────────────────────────────────────────────────
targetLangSelect.addEventListener('change', () => {
  const code = targetLangSelect.value;
  const name = languages[code] || '';

  btnBLabel.textContent      = code ? `Speak in ${name}` : 'Speak in...';
  btnAutoBLabel.textContent  = code ? `${name} first`    : 'Start with...';
  btnB.disabled      = !code;
  btnA.disabled      = !code;
  btnAutoA.disabled  = !code;
  btnAutoB.disabled  = !code;

  setStatus(code ? `Ready — ${name} selected` : 'Select a language to begin', null);
  showEmpty();
});

// ── Mode toggle ───────────────────────────────────────────────────────────────
function switchMode(newMode) {
  mode = newMode;
  modeManualBtn.classList.toggle('mode-active', mode === 'manual');
  modeAutoBtn.classList.toggle('mode-active', mode === 'auto');
  manualButtons.classList.toggle('hidden', mode !== 'manual');
  autoButtons.classList.toggle('hidden', mode !== 'auto');

  if (mode === 'manual') {
    stopAutoLoop();
  }
}

modeManualBtn.addEventListener('click', () => switchMode('manual'));
modeAutoBtn.addEventListener('click', () => switchMode('auto'));

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
    : `Speaker B (${languages[targetLangSelect.value] || ''})`;

  const bubble = document.createElement('div');
  bubble.className = `bubble${loading ? ' loading' : ''}`;
  if (loading) {
    bubble.innerHTML = `<div class="original"><div class="dots"><span></span><span></span><span></span></div></div>`;
  }

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
  const hasLang = !!targetLangSelect.value;
  btnA.disabled = busy || !hasLang;
  btnB.disabled = busy || !hasLang;
}

// ── Speech recognition ────────────────────────────────────────────────────────
// callbacks: { onReady() — mic actually open; onSpeech() — speech detected }
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

    // iOS sometimes silently fails to open the mic (audio session still in
    // playback mode). onaudiostart fires only when the mic actually activates;
    // if it doesn't within 5 s, reject so the caller can retry silently.
    const audioStartWatchdog = setTimeout(() => {
      settle(reject, new Error('mic-unavailable'));
      try { r.stop(); } catch (_) {}
    }, 5000);

    r.onaudiostart  = () => { clearTimeout(audioStartWatchdog); callbacks.onReady?.(); };
    r.onspeechstart = () => callbacks.onSpeech?.();
    r.onresult = (e) => settle(resolve, e.results[0][0].transcript.trim());
    r.onerror  = (e) => {
      clearTimeout(audioStartWatchdog);
      if (e.error === 'aborted')          settle(reject, new Error('stopped'));
      else if (e.error === 'no-speech')   settle(reject, new Error('No speech detected — try again.'));
      else if (e.error === 'not-allowed') settle(reject, new Error('Microphone access denied.'));
      else if (e.error === 'audio-capture' || e.error === 'service-not-allowed')
                                          settle(reject, new Error('mic-unavailable'));
      else settle(reject, new Error(`Speech error: ${e.error}`));
    };
    r.onend = () => { clearTimeout(audioStartWatchdog); recognition = null; settle(reject, new Error('stopped')); };
    r.start();
  });
}

// ── Text-to-speech ────────────────────────────────────────────────────────────

// Called synchronously inside button click handlers (before any await) so that
// iOS registers our intent to use speech synthesis within the user gesture.
function primeTTS() {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(' '); // non-breaking space
    u.volume = 0;
    u.rate = 10;
    window.speechSynthesis.speak(u);
  } catch (_) {}
}

function speak(text, lang) {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();

    // iOS keeps the audio session in "voice input" mode after mic use, which
    // silently routes TTS output nowhere. An AudioContext buffer forces a
    // switch to playback mode. We hold it open until TTS finishes, then close
    // it with a 300ms grace period so iOS can release the session before the
    // mic tries to open on the next turn.
    let ac = null;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ac.createBuffer(1, 1, ac.sampleRate);
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(ac.destination);
      src.start(0);
      ac.resume();
    } catch (_) { ac = null; }

    const closeAC = () => { if (ac) { ac.close().catch(() => {}); ac = null; } };

    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(text);
      const base = lang.split('-')[0];
      const match = voices.find(v => v.lang === lang) ||
                    voices.find(v => v.lang.startsWith(lang)) ||
                    voices.find(v => v.lang.startsWith(base));
      if (match) u.voice = match;
      u.lang = lang;
      u.rate = 0.95;

      // iOS silently pauses speechSynthesis mid-utterance; keep nudging it
      const nudge = setInterval(() => {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      }, 100);

      // Last-resort bail so the app never freezes
      const bail = setTimeout(() => {
        clearInterval(nudge);
        closeAC();
        setTimeout(resolve, 600);
      }, 4000 + text.length * 70);

      const done = () => {
        clearInterval(nudge);
        clearTimeout(bail);
        closeAC();
        // 600ms lets iOS fully release the playback session before the mic opens
        setTimeout(resolve, 600);
      };
      u.onend   = done;
      u.onerror = done;
      window.speechSynthesis.speak(u);
    }, 500);
  });
}

// ── Translation API ───────────────────────────────────────────────────────────
async function translate(text, fromLang, toLang) {
  const fromName = fromLang === 'en-US' ? 'English' : (languages[fromLang] || fromLang);
  const toName   = toLang   === 'en-US' ? 'English' : (languages[toLang]   || toLang);
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, fromLang, toLang, fromLangName: fromName, toLangName: toName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Translation failed');
  }
  return (await res.json()).translated;
}

// ── Core turn (shared by both modes) ─────────────────────────────────────────
async function executeTurn(speaker) {
  const targetCode = targetLangSelect.value;
  if (!targetCode) return false;

  const isA          = speaker === 'a';
  const listenLang   = speechLang(isA ? 'en-US' : targetCode);
  const speakLang    = speechLang(isA ? targetCode : 'en-US');
  const translateTo  = isA ? targetCode : 'en-US';
  const speakerName  = isA ? 'English' : languages[targetCode];

  try {
    // iOS audio session switching is slow — retry mic start silently.
    // Only show "Listening" once onaudiostart fires so the user knows
    // not to speak before the mic is actually open.
    let spoken = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        setStatus('Preparing mic…', null);
        if (attempt > 0) await delay(700);
        spoken = await startListening(listenLang, {
          onReady:  () => setStatus(`Listening for ${speakerName}…`, ''),
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

    const translated = await translate(spoken, listenLang, translateTo);
    updateMessage(bubble, { original: spoken, translation: translated, speaker });

    setStatus(`Speaking ${isA ? languages[targetCode] : 'English'}…`, 'speaking');
    await speak(translated, speakLang);

    return true;
  } catch (err) {
    if (err.message !== 'stopped') {
      setStatus(err.message || 'Something went wrong', null);
    }
    return false;
  }
}

// ── Manual mode ───────────────────────────────────────────────────────────────
async function handleManualTurn(speaker) {
  if (isBusy || mode !== 'manual') return;
  primeTTS(); // iOS: register TTS intent within user gesture before any await
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
  const name = languages[targetLangSelect.value] || '';
  turnB.textContent = `${name} listening`;
}

async function startAutoLoop(firstSpeaker) {
  if (!targetLangSelect.value || autoActive) return;
  primeTTS(); // iOS: register TTS intent within user gesture before any await
  autoActive = true;

  autoStart.classList.add('hidden');
  autoRunning.classList.remove('hidden');

  let speaker = firstSpeaker;
  while (autoActive) {
    setTurnIndicator(speaker);
    const ok = await executeTurn(speaker);
    if (!autoActive) break;

    if (!ok) {
      // Retry same speaker after brief pause
      await delay(900);
      continue;
    }

    speaker = speaker === 'a' ? 'b' : 'a';
    // Pause between turns — iOS needs time to release playback session for mic
    if (autoActive) {
      setStatus('Next speaker…', null);
      await delay(1800);
    }
  }

  autoStart.classList.remove('hidden');
  autoRunning.classList.add('hidden');
  setStatus(targetLangSelect.value ? 'Ready' : 'Select a language to begin', null);
}

function stopAutoLoop() {
  if (!autoActive) return;
  autoActive = false;
  window.speechSynthesis.cancel();
  if (recognition) { try { recognition.stop(); } catch (_) {} recognition = null; }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

btnAutoA.addEventListener('click', () => startAutoLoop('a'));
btnAutoB.addEventListener('click', () => startAutoLoop('b'));
btnStop.addEventListener('click', stopAutoLoop);

// ── Clear ─────────────────────────────────────────────────────────────────────
btnClear.addEventListener('click', () => {
  stopAutoLoop();
  window.speechSynthesis.cancel();
  if (recognition) { try { recognition.stop(); } catch (_) {} recognition = null; }
  isBusy = false;
  btnA.classList.remove('active');
  btnB.classList.remove('active');
  const hasLang = !!targetLangSelect.value;
  btnA.disabled = !hasLang;
  btnB.disabled = !hasLang;
  setStatus(hasLang ? 'Ready' : 'Select a language to begin', null);
  showEmpty();
});
