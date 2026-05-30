import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const client = new Anthropic();

const LANGUAGE_NAMES = {
  es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese',
  ja: 'Japanese', zh: 'Chinese (Mandarin)', ko: 'Korean', ar: 'Arabic',
  hi: 'Hindi', ru: 'Russian', nl: 'Dutch', pl: 'Polish', tr: 'Turkish',
  sv: 'Swedish', da: 'Danish', fi: 'Finnish', no: 'Norwegian', el: 'Greek',
  he: 'Hebrew', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', uk: 'Ukrainian',
  cs: 'Czech', ro: 'Romanian', hu: 'Hungarian',
};

app.post('/api/translate', async (req, res) => {
  const { text, fromLang, toLang, fromLangName, toLangName } = req.body;

  if (!text || !fromLang || !toLang) {
    return res.status(400).json({ error: 'Missing required fields: text, fromLang, toLang' });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Translate the following text from ${fromLangName || fromLang} to ${toLangName || toLang}. Return ONLY the translated text with no explanation, no quotes, no prefixes. Preserve the natural conversational tone.\n\nText to translate:\n${text}`,
        },
      ],
    });

    const translated = message.content[0].text.trim();
    res.json({ translated });
  } catch (err) {
    console.error('Translation error:', err);
    res.status(500).json({ error: 'Translation failed', details: err.message });
  }
});

app.get('/api/languages', (req, res) => {
  res.json(LANGUAGE_NAMES);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ConvoTranslater running at http://localhost:${PORT}`);
});
