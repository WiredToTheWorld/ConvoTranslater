/* ConvoTranslater — frontend logic */

const targetLangSelect = document.getElementById('target-lang');
const btnA = document.getElementById('btn-a');
const btnB = document.getElementById('btn-b');
const btnBLabel = document.getElementById('btn-b-label');
const btnClear = document.getElementById('btn-clear');
const statusText = document.getElementById('status-text');
const pulse = document.getElementById('pulse');
const conversationEl = document.getElementById('conversation');
const browserWarning = document.getElementById('browser-warning');

let languages = {};
let recognition = null;
let isBusy = false;
let utterance = null;
let voices = [];

// ── Voice support check ─────────────────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition || !window.speechSynthesis) {
  browserWarning.classList.remove('hidden');
}

// ── Load voices (async in some browsers) ────────────────────────────────────
function loadVoices() {
  voices = window.speechSynthesis.getVoices();
}
loadVoices();
window.speechSynthesis.onvoiceschanged = loadVoices;

// ── Load languages from server ───────────────────────────────────────────────
async function loadLanguages() {
  try {
    const res = await fetch('/api/languages');
    languages = await res.json();
    targetLangSelect.innerHTML = '<option value="">— choose language —</option>' +
      Object.entries(languages)
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([code, name]) => `<option value="${code}">${name}</option>`)
        .join('');
  } catch (e) {
    setStatus('Failed to load languages', false);
  }
}
loadLanguages();

// ── Language selection ───────────────────────────────────────────────────────
targetLangSelect.addEventListener('change', () => {
  const code = targetLangSelect.value;
  if (!code) {
    btnA.disabled = true;
    btnB.disabled = true;
    btnBLabel.textContent = 'Speak in...';
    setStatus('Select a language to begin', false);
    showEmpty();
    return;
  }
  const name = languages[code];
  btnBLabel.textContent = `Speak in ${name}`;
  btnA.disabled = false;
  btnB.disabled = false;
  setStatus(`Ready — ${name} selected`, false);
  showEmpty();
});

// ── Conversation rendering ───────────────────────────────────────────────────
function showEmpty() {
  conversationEl.innerHTML = `
    <div class="empty-state">
      <div class="icon">&#128172;</div>
      <p>Tap a button below to start speaking.<br>The other person will reply in their language.</p>
    </div>`;
}
showEmpty();

function addMessage({ speaker, original, translation, loading }) {
  // Remove empty state
  const empty = conversationEl.querySelector('.empty-state');
  if (empty) empty.remove();

  const group = document.createElement('div');
  group.className = `message-group speaker-${speaker}`;
  group.dataset.speaker = speaker;

  const tag = document.createElement('div');
  tag.className = 'speaker-tag';
  tag.textContent = speaker === 'a' ? 'Speaker A (English)' : `Speaker B (${languages[targetLangSelect.value] || ''})`;

  const bubble = document.createElement('div');
  bubble.className = `bubble${loading ? ' loading' : ''}`;

  if (loading) {
    bubble.innerHTML = `<div class="original"><div class="dots"><span></span><span></span><span></span></div></div>`;
  } else {
    const isA = speaker === 'a';
    bubble.innerHTML = `
      <div class="original">${escHtml(original)}</div>
      <div class="translation">${isA ? '&#8594;' : '&#8592;'} ${escHtml(translation)}</div>`;
  }

  group.appendChild(tag);
  group.appendChild(bubble);
  conversationEl.appendChild(group);
  group.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return { group, bubble };
}

function updateMessage(group, bubble, { original, translation, speaker }) {
  bubble.classList.remove('loading');
  const isA = speaker === 'a';
  bubble.innerHTML = `
    <div class="original">${escHtml(original)}</div>
    <div class="translation">${isA ? '&#8594;' : '&#8592;'} ${escHtml(translation)}</div>`;
  group.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Status helpers ───────────────────────────────────────────────────────────
function setStatus(msg, busy, type) {
  statusText.textContent = msg;
  pulse.className = busy ? (type || '') : 'hidden';
  isBusy = busy;
  const hasLang = !!targetLangSelect.value;
  btnA.disabled = busy || !hasLang;
  btnB.disabled = busy || !hasLang;
}

// ── Speech recognition ───────────────────────────────────────────────────────
function startListening(lang) {
  return new Promise((resolve, reject) => {
    if (!SpeechRecognition) return reject(new Error('No speech recognition'));

    const r = new SpeechRecognition();
    recognition = r;
    r.lang = lang;
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      const text = e.results[0][0].transcript.trim();
      resolve(text);
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech') reject(new Error('No speech detected. Try again.'));
      else if (e.error === 'not-allowed') reject(new Error('Microphone access denied.'));
      else reject(new Error(`Speech error: ${e.error}`));
    };
    r.onend = () => { recognition = null; };
    r.start();
  });
}

// ── Text-to-speech ───────────────────────────────────────────────────────────
function speak(text, lang) {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    utterance = u;

    // Find best matching voice for language
    const match = voices.find(v => v.lang.startsWith(lang)) ||
                  voices.find(v => v.lang.startsWith(lang.split('-')[0]));
    if (match) u.voice = match;
    u.lang = lang;
    u.rate = 0.95;

    u.onend = () => { utterance = null; resolve(); };
    u.onerror = () => { utterance = null; resolve(); };
    window.speechSynthesis.speak(u);
  });
}

// ── Translation API ──────────────────────────────────────────────────────────
async function translate(text, fromLang, toLang) {
  const fromName = fromLang === 'en-US' ? 'English' : (languages[fromLang] || fromLang);
  const toName = toLang === 'en-US' ? 'English' : (languages[toLang] || toLang);
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, fromLang, toLang, fromLangName: fromName, toLangName: toName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Translation failed');
  }
  const data = await res.json();
  return data.translated;
}

// ── Core flow: speak → transcribe → translate → read aloud ──────────────────
async function handleTurn(speaker) {
  const targetCode = targetLangSelect.value;
  if (!targetCode || isBusy) return;

  const isA = speaker === 'a';
  const listenLang = isA ? 'en-US' : targetCode;
  const translateToLang = isA ? targetCode : 'en-US';
  const btn = isA ? btnA : btnB;

  btn.classList.add('active');

  try {
    // 1. Listen
    setStatus('Listening...', true);
    pulse.className = '';  // red pulse = recording
    const spoken = await startListening(listenLang);

    if (!spoken) throw new Error('Nothing heard. Try again.');

    // 2. Show loading bubble
    setStatus('Translating...', true, 'translating');
    const { group, bubble } = addMessage({ speaker, loading: true });

    // 3. Translate
    const translated = await translate(spoken, listenLang, translateToLang);

    // 4. Update bubble with content
    updateMessage(group, bubble, { original: spoken, translation: translated, speaker });

    // 5. Read translation aloud
    setStatus('Speaking...', true, 'speaking');
    const speakLang = isA ? targetCode : 'en-US';
    await speak(translated, speakLang);

    setStatus('Ready', false);
  } catch (err) {
    setStatus(err.message || 'Something went wrong', false);
  } finally {
    btn.classList.remove('active');
  }
}

// ── Button handlers ──────────────────────────────────────────────────────────
btnA.addEventListener('click', () => handleTurn('a'));
btnB.addEventListener('click', () => handleTurn('b'));

btnClear.addEventListener('click', () => {
  window.speechSynthesis.cancel();
  if (recognition) { try { recognition.stop(); } catch (_) {} recognition = null; }
  isBusy = false;
  btnA.classList.remove('active');
  btnB.classList.remove('active');
  setStatus(targetLangSelect.value ? 'Ready' : 'Select a language to begin', false);
  showEmpty();
});
