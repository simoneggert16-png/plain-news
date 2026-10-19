import fs from 'node:fs';
import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '../lib/supabase-admin.mjs';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.plain-news.ch').replace(/\/$/, '');
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const locales = new Set(['de', 'en', 'fr', 'es', 'it', 'pt', 'zh', 'ja', 'ko']);
const titleText = {
  de: 'Dein tägliches Fakten-Briefing',
  en: 'Your daily fact briefing',
  fr: 'Votre briefing factuel quotidien',
  es: 'Tu resumen factual diario',
  it: 'Il tuo briefing quotidiano',
  pt: 'O seu resumo factual diário',
  zh: '每日事实简报',
  ja: '毎日のファクト・ブリーフィング',
  ko: '오늘의 팩트 브리핑',
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function unsubscribeToken(email) {
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Newsletter unsubscribe signing secret is not configured.');
  return crypto.createHmac('sha256', secret).update(email).digest('hex');
}

async function sendEmail({ to, subject, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }
}

async function main() {
  if (!RESEND_API_KEY || !FROM_EMAIL) {
    throw new Error('Set RESEND_API_KEY and RESEND_FROM_EMAIL to send the newsletter.');
  }
  const { articles = [] } = JSON.parse(fs.readFileSync('content/index.json', 'utf8'));
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = articles
    .filter((article) => Date.parse(article.publishedAt) >= cutoff)
    .slice(0, 5);
  if (!recent.length) {
    console.log('No articles from the last 24 hours; no newsletter sent.');
    return;
  }

  const supabase = getSupabaseAdminClient();
  const oldDate = new Date(cutoff).toISOString();
  const { data: subscribers, error } = await supabase
    .from('newsletter_subscribers')
    .select('email, locale')
    .eq('active', true)
    .or(`last_sent_at.is.null,last_sent_at.lt.${oldDate}`);
  if (error) throw error;
  console.log(`Sending a ${recent.length}-article digest to ${subscribers.length} subscriber(s).`);

  let failed = 0;
  for (const subscriber of subscribers) {
    const locale = locales.has(subscriber.locale) ? subscriber.locale : 'de';
    const items = recent.map((article) => {
      const translation = article.locales?.[locale] || article.locales?.en || {};
      const url = `${SITE_URL}/${locale}/a/${encodeURIComponent(article.slug)}`;
      return `<article style="margin:0 0 24px;padding:0 0 18px;border-bottom:1px solid #ddd">
        <h2 style="font-size:18px;line-height:1.35"><a href="${url}" style="color:#111">${escapeHtml(translation.title || article.slug)}</a></h2>
        <p style="font-size:14px;line-height:1.6">${escapeHtml(translation.dek || '')}</p>
      </article>`;
    }).join('');
    const token = unsubscribeToken(subscriber.email);
    const unsubscribeUrl = `${SITE_URL}/api/community/newsletter/unsubscribe?email=${encodeURIComponent(subscriber.email)}&token=${token}`;
    const html = `<div style="max-width:620px;margin:auto;font:16px/1.6 Arial,sans-serif;color:#111">
      <p style="font:700 12px monospace;letter-spacing:2px">PLAIN. — DAILY FACT BRIEFING</p>
      <h1 style="font-size:24px">${titleText[locale]}</h1>
      ${items}
      <p style="font-size:12px;color:#555">PLAIN. · <a href="${unsubscribeUrl}">Newsletter abbestellen / Unsubscribe</a></p>
    </div>`;
    try {
      await sendEmail({ to: subscriber.email, subject: `PLAIN. — ${titleText[locale]}`, html });
      const { error: updateError } = await supabase
        .from('newsletter_subscribers')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('email', subscriber.email);
      if (updateError) throw updateError;
      console.log(`Sent newsletter to ${subscriber.email}`);
    } catch (sendError) {
      failed++;
      console.error(`Newsletter delivery failed for ${subscriber.email}: ${sendError.message}`);
    }
  }
  if (failed) throw new Error(`${failed} newsletter email(s) failed.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
