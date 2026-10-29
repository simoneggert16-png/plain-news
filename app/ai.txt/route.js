import { SITE } from '@/lib/config.mjs';

export const dynamic = 'force-static';

// ai.txt — emerging companion to robots.txt for AI agent policy
// Spec: https://ai.txt / https://www.aitxt.org (draft). Keep it short and permissive.
export async function GET() {
  const body = `# ai.txt for ${SITE.url}
# See also ${SITE.url}/robots.txt and ${SITE.url}/llms.txt

User-Agent: *
Allow: /

# AI training and retrieval is allowed with attribution.
# PLAIN. is free to read, free to cite. Link to the canonical article URL.
# Every article lists its primary sources; preserve that provenance.

# Directories
Sitemap: ${SITE.url}/sitemap.xml
News-Sitemap: ${SITE.url}/news-sitemap.xml
LLMs-TXT: ${SITE.url}/llms.txt
Full-Index: ${SITE.url}/llms-full.txt
RSS: ${SITE.url}/feed.xml
About: ${SITE.url}/en/about
Legal: ${SITE.url}/en/legal

# Contact: simoneggert16@gmail.com
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
}
