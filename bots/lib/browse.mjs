// Read a page the way a reporter does: title, running text, and the links that
// lead to the next document. Deliberately no headless browser — the desk runs
// on a free CI runner and most of its sources are plain HTML or PDF.
import { clean } from './feeds.mjs';
import { extractImagesFromHtml, cleanImageUrl, cleanCaptionText } from './media.mjs';

const UA = 'Mozilla/5.0 (compatible; PlainDesk/1.0; +https://plain-news.ch)';

function absolute(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function interesting(href, base) {
  if (!href || /^(javascript:|mailto:|tel:|#)/i.test(href)) return false;
  if (/\.(css|js|png|jpe?g|gif|svg|ico|woff2?)(\?|$)/i.test(href)) return false;
  const url = absolute(href, base);
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    const here = new URL(base).hostname;
    // Same host, or a document host the desk actually cites.
    return (
      host === here ||
      /\.(admin\.ch|parlament\.ch|bger\.ch|bvger\.ch|efk\.admin\.ch|ch)$/i.test(host)
    );
  } catch {
    return false;
  }
}

// Audit reports and court rulings arrive as PDFs; the desk has to read them.
// unpdf wraps pdf.js and works without a browser binary.
async function pdfText(bytes) {
  try {
    const { extractText } = await import('unpdf');
    const { text } = await extractText(bytes, { mergePages: true });
    return String(text || '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return '';
  }
}

/**
 * @returns {Promise<{url:string,title:string,text:string,links:{url:string,text:string}[],image?:string,imageCaption?:string,imageCredit?:string,pdf?:boolean,error?:string}>}
 */
export async function openPage(url, { maxChars = 7000, maxLinks = 30 } = {}) {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    return { url, title: '', text: '', links: [], error: `fetch failed: ${err.message}` };
  }

  const type = res.headers.get('content-type') || '';
  if (!res.ok) return { url, title: '', text: '', links: [], error: `HTTP ${res.status}` };

  // Many authority servers label PDFs as octet-stream, so sniff the bytes.
  const looksPdf = type.includes('pdf') || /\.pdf(\?|$)/i.test(url);
  if (looksPdf) {
    // A 200-page scan can stall the run inside pdf.js; the desk only needs
    // what a human would read in a few minutes.
    const size = Number(res.headers.get('content-length') || 0);
    if (size > 20 * 1024 * 1024) {
      return { url, title: url.split('/').pop(), text: '', links: [], pdf: true, error: `PDF too large (${Math.round(size / 1e6)} MB) — cite the landing page instead` };
    }
    const buf = new Uint8Array(await res.arrayBuffer().catch(() => new ArrayBuffer(0)));
    if (buf.length > 20 * 1024 * 1024) {
      return { url, title: url.split('/').pop(), text: '', links: [], pdf: true, error: 'PDF too large — cite the landing page instead' };
    }
    const head = String.fromCharCode(...buf.slice(0, 5));
    if (buf.length && head === '%PDF-') {
      const text = await pdfText(buf);
      if (!text) {
        return { url, title: url.split('/').pop(), text: '', links: [], pdf: true, error: 'PDF ohne lesbaren Text (Scan?) — nur als Beleg zitieren' };
      }
      return { url, title: url.split('/').pop(), text: text.slice(0, maxChars), links: [], pdf: true };
    }
  }

  const html = await res.text().catch(() => '');
  if (!html) return { url, title: '', text: '', links: [], error: 'empty response' };

  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');

  // The lead photo of the article. A report without a picture looks unfinished,
  // and the desk already pays for the page - the photo comes with it.
  const picture = extractImagesFromHtml(html)
    .sort((a, b) => b.score - a.score)
    .map((candidate) => ({
      url: cleanImageUrl(candidate.url),
      caption: cleanCaptionText(candidate.caption || ''),
      credit: cleanCaptionText(candidate.credit || ''),
    }))
    .find((candidate) => candidate.url);

  const stripped = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const blocks = [];
  for (const m of stripped.matchAll(/<(h[1-3]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = clean(m[2]);
    if (text.length < 40) continue;
    if (/cookie|subscribe|newsletter|sign up|all rights reserved|javascript/i.test(text)) continue;
    blocks.push(text);
  }

  const links = [];
  const seen = new Set();
  for (const m of stripped.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    const label = clean(m[2]);
    if (!label || label.length < 4 || label.length > 90) continue;
    if (!interesting(href, url)) continue;
    const target = absolute(href, url);
    if (!target || seen.has(target)) continue;
    seen.add(target);
    links.push({ url: target, text: label });
    if (links.length >= maxLinks) break;
  }

  const body = blocks.join('\n');
  return {
    url,
    title,
    text: body.slice(0, maxChars),
    // How long the document really is. A reader who saw the first 4000
    // characters of a 9000-character article cannot prove that the article
    // does not say something — the desk has to know the difference.
    length: body.length,
    links,
    ...(picture ? { image: picture.url, imageCaption: picture.caption, imageCredit: picture.credit } : {}),
  };
}
