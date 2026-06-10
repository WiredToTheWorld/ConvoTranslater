// Single source of truth for the translation prompt, shared by the local dev
// server (server.js) and the production Netlify function.
export function buildTranslationPrompt({ text, fromLang, toLang, fromLangName, toLangName, vibe }) {
  const vibeInstruction = vibe === 'flirty'
    ? 'Use a flirty, cheeky, and playfully casual tone — think light-hearted banter with a wink. Keep the core meaning but add charm, warmth, and a little teasing. Do not add any emoji or emoticons.'
    : 'Preserve the natural conversational tone.';

  return `Translate the following text from ${fromLangName || fromLang} to ${toLangName || toLang}. Return ONLY the translated text with no explanation, no quotes, no prefixes. ${vibeInstruction}\n\nText to translate:\n${text}`;
}
