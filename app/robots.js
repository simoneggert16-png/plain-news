import { SITE } from '@/lib/config.mjs';

export default function robots() {
  return { rules: [{ userAgent: '*', allow: '/' }], sitemap: `${SITE.url}/sitemap.xml` };
}
