// Single source of truth for the translation prompt, shared by the local dev
// server (server.js) and the production Netlify function.
export function buildTranslationPrompt({ text, fromLang, toLang, fromLangName, toLangName, vibe }) {
  const vibeInstructions = {
    flirty: 'Use a flirty, cheeky, and playfully casual tone — think light-hearted banter with a wink. Keep the core meaning but add charm, warmth, and a little teasing. Do not add any emoji or emoticons.',
    slang: 'Use very casual, colloquial, "street" language — the way locals actually talk with friends, full of slang, contractions, and idiomatic expressions rather than textbook phrasing. Keep the core meaning but make it sound relaxed and informal. Do not add any emoji or emoticons.',
  };
  const vibeInstruction = vibeInstructions[vibe] || 'Preserve the natural conversational tone.';

  return `Translate the following text from ${fromLangName || fromLang} to ${toLangName || toLang}. Return ONLY the translated text with no explanation, no quotes, no prefixes. ${vibeInstruction}\n\nText to translate:\n${text}`;
}
