import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { text, fromLang, toLang, fromLangName, toLangName, vibe } = await req.json();

    if (!text || !fromLang || !toLang) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const vibeInstruction = vibe === 'flirty'
      ? 'Use a flirty, cheeky, and playfully casual tone — think light-hearted banter with a wink. Keep the core meaning but add charm, warmth, and a little teasing.'
      : 'Preserve the natural conversational tone.';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Translate the following text from ${fromLangName || fromLang} to ${toLangName || toLang}. Return ONLY the translated text with no explanation, no quotes, no prefixes. ${vibeInstruction}\n\nText to translate:\n${text}`,
      }],
    });

    return new Response(
      JSON.stringify({ translated: message.content[0].text.trim() }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Translation error:', err);
    return new Response(
      JSON.stringify({ error: 'Translation failed', details: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const config = {
  path: '/api/translate',
};
