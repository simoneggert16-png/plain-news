// Central NVIDIA NIM Client for PLAIN AI Features
// Model: meta/llama-3.2-11b-vision-instruct

const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const MODEL = process.env.NVIDIA_MODERATION_MODEL || 'meta/llama-3.2-11b-vision-instruct';

/**
 * Moderate user-generated text using NVIDIA NIM AI.
 * Checks for vulgarity, abusive language, hate speech, spam, and non-factual disruptive trolling.
 */
export async function moderateContent({ text, author = '', type = 'comment', locale = 'de' }) {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!text || !text.trim()) {
    return { approved: false, reason: 'Beitrag ist leer.' };
  }

  // Fast offline regex pre-filter for obvious profanity
  const vulgarRegex = /\b(hurensohn|arschloch|fick|fickt|fotze|bastard|verpiss|spast|nigger|scheissdreck|scheisse|idiot|wichser|cunt|motherfucker|whore|slut)\b/i;
  if (vulgarRegex.test(text)) {
    return {
      approved: false,
      reason: locale === 'de'
        ? 'Der Beitrag enthält vulgäre Sprache oder Beleidigungen und wurde von der PLAIN-Moderation abgewiesen.'
        : 'The submission contains vulgar or abusive language and was rejected by PLAIN moderation.'
    };
  }

  if (!apiKey) {
    // If no API key configured, pass unless flagged by pre-filter
    return { approved: true, reason: '' };
  }

  try {
    const isGerman = locale === 'de';
    const systemPrompt = `You are the AI Content Moderator for PLAIN, an objective Swiss news and debate platform.
Your mandate is to strictly reject:
1. Vulgarity, profanity, crude curses, sexual vulgarities, slurs, insults.
2. Hate speech, discrimination, harassment, defamation, threats of violence.
3. Unrelated spam, scam schemes, crypto pump promotion, affiliate links.
4. Trolling or destructive off-topic noise that ruins respectful discourse.

Accept constructive critique, questions, polite disagreements, and factual context.

You MUST respond strictly with valid JSON:
{"approved": true, "reason": ""}
or
{"approved": false, "reason": "<Concise explanation in ${isGerman ? 'German' : 'English'} why it is rejected>"}`;

    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Type: ${type}\nAuthor: ${author || 'Anonymous'}\nContent:\n${text}` }
        ],
        max_tokens: 150,
        temperature: 0.0,
        response_format: { type: 'json_object' }
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[NVIDIA Moderator] HTTP ${res.status}`);
      // Fallback to approved if API temporarily unavailable, regex already checked
      return { approved: true, reason: '' };
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || '{}';
    try {
      const parsed = JSON.parse(rawContent);
      return {
        approved: Boolean(parsed.approved),
        reason: parsed.reason || (parsed.approved ? '' : (isGerman ? 'Beitrag entspricht nicht den Richtlinien.' : 'Content violates moderation guidelines.'))
      };
    } catch {
      if (rawContent.toLowerCase().includes('"approved": false') || rawContent.toLowerCase().includes('abgelehnt')) {
        return {
          approved: false,
          reason: isGerman ? 'Beitrag wurde von der AI-Moderation abgewiesen.' : 'Content rejected by AI moderation.'
        };
      }
      return { approved: true, reason: '' };
    }
  } catch (err) {
    console.error('[NVIDIA Moderator Error]:', err.message);
    return { approved: true, reason: '' };
  }
}

/**
 * Translate user content in real-time into the target language using NVIDIA NIM AI.
 */
export async function translateContent({ text, targetLocale = 'de' }) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!text || !text.trim()) {
    return { translatedText: text };
  }

  const localeNames = {
    de: 'German',
    en: 'English',
    fr: 'French',
    es: 'Spanish',
    it: 'Italian',
    pt: 'Portuguese',
    zh: 'Simplified Chinese',
    ja: 'Japanese',
    ko: 'Korean'
  };

  const targetLang = localeNames[targetLocale] || 'English';

  if (!apiKey) {
    return { translatedText: text };
  }

  try {
    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are an expert newsroom translation engine for PLAIN. Translate the user's text into ${targetLang}. Return ONLY the direct translation. Do not include quotes, greetings, notes, or explanations.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 400,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[NVIDIA Translate] HTTP ${res.status}`);
      return { translatedText: text };
    }

    const data = await res.json();
    const translatedText = data.choices?.[0]?.message?.content?.trim() || text;
    return { translatedText, targetLang };
  } catch (err) {
    console.error('[NVIDIA Translate Error]:', err.message);
    return { translatedText: text };
  }
}
