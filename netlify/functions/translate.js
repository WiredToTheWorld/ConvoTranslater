import Anthropic from '@anthropic-ai/sdk';
import { buildTranslationPrompt } from '../../lib/prompt.js';

const client = new Anthropic();

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await req.json();

    if (!body.text || !body.fromLang || !body.toLang) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildTranslationPrompt(body) }],
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
