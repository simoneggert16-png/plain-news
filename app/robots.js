import { SITE } from '@/lib/config.mjs';

// Crawlers that matter for classic search, Google News and AI answer engines.
// Keeping this list explicit makes the policy auditable and prevents a
// hosting/firewall rule from silently blocking an AI search agent.
const SEARCH_AND_AI_AGENTS = [
  // Classic search + Google News
  'Googlebot',
  'Googlebot-News',
  'Googlebot-Image',
  'Bingbot',
  'Bingbot-News',
  'DuckDuckBot',
  'YandexBot',
  'Baiduspider',

  // OpenAI / ChatGPT Search
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',

  // Perplexity
  'PerplexityBot',
  'Perplexity-User',

  // Anthropic / Claude
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'Claude-Web',

  // Apple / Spotlight / Siri
  'Applebot',
  'Applebot-Extended',

  // Microsoft Copilot, Meta AI, Amazon, Common Crawl and others
  'Amazonbot',
  'meta-externalagent',
  'FacebookBot',
  'CCBot',
  'cohere-ai',
  'YouBot',
  'Diffbot',
  'Bytespider',

  // Gemini / Vertex grounding controls
  'Google-Extended',
];

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
      {
        userAgent: SEARCH_AND_AI_AGENTS,
        allow: '/',
      },
    ],
    sitemap: [
      `${SITE.url}/sitemap.xml`,
      `${SITE.url}/news-sitemap.xml`,
    ],
    host: SITE.url,
  };
}
