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
const newsletterText = {
  de: { edition: 'DAS WICHTIGSTE DES TAGES', read: 'Artikel lesen', unsubscribe: 'Newsletter abbestellen', footer: 'Unabhängige Nachrichten. Klar auf den Punkt.' },
  en: { edition: 'YOUR DAILY EDITION', read: 'Read the story', unsubscribe: 'Unsubscribe', footer: 'Independent news. Clearly explained.' },
  fr: { edition: 'VOTRE ÉDITION DU JOUR', read: 'Lire l’article', unsubscribe: 'Se désabonner', footer: 'Une information indépendante, en toute clarté.' },
  es: { edition: 'TU EDICIÓN DEL DÍA', read: 'Leer el artículo', unsubscribe: 'Cancelar suscripción', footer: 'Noticias independientes, explicadas con claridad.' },
  it: { edition: 'LA TUA EDIZIONE DI OGGI', read: 'Leggi l’articolo', unsubscribe: 'Annulla iscrizione', footer: 'Notizie indipendenti, spiegate con chiarezza.' },
  pt: { edition: 'A SUA EDIÇÃO DE HOJE', read: 'Leia a notícia', unsubscribe: 'Cancelar inscrição', footer: 'Jornalismo independente, explicado com clareza.' },
  zh: { edition: '今日精选', read: '阅读报道', unsubscribe: '取消订阅', footer: '独立新闻，清晰易懂。' },
  ja: { edition: '今日のニュースレター', read: '記事を読む', unsubscribe: '配信停止', footer: '独立したニュースを、わかりやすく。' },
  ko: { edition: '오늘의 브리핑', read: '기사 읽기', unsubscribe: '구독 취소', footer: '독립적인 뉴스를 명확하게 전합니다.' },
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
  const recipientInput = process.env.NEWSLETTER_RECIPIENTS;
  const isDailyDirectSend = process.env.NEWSLETTER_DAILY_SEND === 'true';
  const isDirectSend = recipientInput !== undefined
    || process.env.NEWSLETTER_SEND_ONCE_DATE !== undefined
    || isDailyDirectSend;
  const directRecipients = typeof recipientInput === 'string'
    ? [...new Set(recipientInput.split(/[,\n;]+/).map((email) => email.trim()).filter(Boolean))]
    : [];
  if (isDirectSend) {
    if (directRecipients.length === 0) {
      throw new Error('NEWSLETTER_RECIPIENTS must contain at least one email address.');
    }
    if (directRecipients.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      throw new Error('NEWSLETTER_RECIPIENTS contains an invalid email address.');
    }
    if (isDailyDirectSend) {
      const localTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Zurich',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date());
      if (!localTime.startsWith('07:') || Number(localTime.slice(3)) < 30) {
        console.log(`Daily newsletter is restricted to 07:30 Europe/Zurich; current time is ${localTime}, no email sent.`);
        return;
      }
    } else {
      const targetDate = process.env.NEWSLETTER_SEND_ONCE_DATE;
      if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        throw new Error('A valid NEWSLETTER_SEND_ONCE_DATE is required for a direct send.');
      }
      if (new Date().toISOString().slice(0, 10) !== targetDate) {
        console.log(`One-time newsletter is restricted to ${targetDate} UTC; no email sent.`);
        return;
      }
    }
  }
  const { articles = [] } = JSON.parse(fs.readFileSync('content/index.json', 'utf8'));
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const articleLimit = Number(process.env.NEWSLETTER_ARTICLE_LIMIT || 5);
  if (!Number.isInteger(articleLimit) || articleLimit < 1 || articleLimit > 100) {
    throw new Error('NEWSLETTER_ARTICLE_LIMIT must be an integer between 1 and 100.');
  }
  const recent = articles
    .filter((article) => Date.parse(article.publishedAt) >= cutoff)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, articleLimit);
  if (!recent.length) {
    console.log('No articles from the last 24 hours; no newsletter sent.');
    return;
  }

  let supabase;
  let subscribers;
  if (isDirectSend) {
    subscribers = directRecipients.map((email) => ({ email, locale: 'de' }));
  } else {
    supabase = getSupabaseAdminClient();
    const oldDate = new Date(cutoff).toISOString();
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('email, locale')
      .eq('active', true)
      .or(`last_sent_at.is.null,last_sent_at.lt.${oldDate}`);
    if (error) throw error;
    subscribers = data;
  }
  console.log(`Sending a ${recent.length}-article digest to ${subscribers.length} ${isDirectSend ? 'requested recipient(s)' : 'subscriber(s)'}.`);

  let failed = 0;
  for (const subscriber of subscribers) {
    const locale = locales.has(subscriber.locale) ? subscriber.locale : 'de';
    const copy = newsletterText[locale];
    const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Europe/Zurich' }).format(new Date());
    const items = recent.map((article, index) => {
      const translation = article.locales?.[locale] || article.locales?.en || {};
      const url = `${SITE_URL}/${locale}/a/${encodeURIComponent(article.slug)}`;
      return `<tr>
        <td style="padding:24px 28px;border-bottom:1px solid #e8eaf0">
          <p style="margin:0 0 10px;color:#667085;font:700 11px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1.5px">${String(index + 1).padStart(2, '0')}</p>
          <h2 style="margin:0 0 10px;font:700 20px/1.35 Arial,Helvetica,sans-serif"><a href="${escapeHtml(url)}" style="color:#17233b;text-decoration:none">${escapeHtml(translation.title || article.slug)}</a></h2>
          <p style="margin:0 0 16px;color:#475467;font:15px/1.65 Arial,Helvetica,sans-serif">${escapeHtml(translation.dek || '')}</p>
          <a href="${escapeHtml(url)}" style="display:inline-block;color:#155eef;font:700 13px/1.4 Arial,Helvetica,sans-serif;text-decoration:none">${copy.read} &rarr;</a>
        </td>
      </tr>`;
    }).join('');
    const unsubscribeUrl = isDirectSend
      ? ''
      : `${SITE_URL}/api/community/newsletter/unsubscribe?email=${encodeURIComponent(subscriber.email)}&token=${unsubscribeToken(subscriber.email)}`;
    const footer = isDirectSend
      ? `<p style="margin:0;color:#667085;font:12px/1.6 Arial,Helvetica,sans-serif">Diese Ausgabe wurde direkt an Sie gesendet.</p>`
      : `<p style="margin:0;color:#667085;font:12px/1.6 Arial,Helvetica,sans-serif"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#475467;text-decoration:underline">${copy.unsubscribe}</a></p>`;
    const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(titleText[locale])}</title></head>
<body style="margin:0;padding:0;background:#f3f5f8;color:#17233b;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(titleText[locale])} · ${recent.length} stories, ${date}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f5f8">
    <tr><td align="center" style="padding:32px 14px">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5e8ef">
        <tr><td style="padding:26px 28px;background:#17233b">
          <p style="margin:0;color:#ffffff;font:800 21px/1 Arial,Helvetica,sans-serif;letter-spacing:3px">PLAIN<span style="color:#f4b544">.</span></p>
          <p style="margin:12px 0 0;color:#cbd5e1;font:700 10px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1.8px">${copy.edition}</p>
        </td></tr>
        <tr><td style="padding:30px 28px 24px">
          <p style="margin:0 0 10px;color:#667085;font:13px/1.5 Arial,Helvetica,sans-serif">${escapeHtml(date)}</p>
          <h1 style="margin:0;color:#17233b;font:700 27px/1.25 Arial,Helvetica,sans-serif">${escapeHtml(titleText[locale])}</h1>
        </td></tr>
        ${items}
        <tr><td style="padding:22px 28px;background:#f8f9fb">
          <p style="margin:0 0 10px;color:#17233b;font:700 14px/1.5 Arial,Helvetica,sans-serif">PLAIN.</p>
          <p style="margin:0 0 14px;color:#667085;font:13px/1.6 Arial,Helvetica,sans-serif">${copy.footer}</p>
          ${footer}
        </td></tr>
      </table>
      <p style="margin:16px 0 0;color:#98a2b3;font:11px/1.5 Arial,Helvetica,sans-serif">plain-news.ch</p>
    </td></tr>
  </table>
</body></html>`;
    try {
      await sendEmail({ to: subscriber.email, subject: `PLAIN. — ${titleText[locale]}`, html });
      if (!isDirectSend) {
        const { error: updateError } = await supabase
          .from('newsletter_subscribers')
          .update({ last_sent_at: new Date().toISOString() })
          .eq('email', subscriber.email);
        if (updateError) throw updateError;
      }
      console.log(isDirectSend ? 'Sent one-time newsletter to a requested recipient.' : `Sent newsletter to ${subscriber.email}`);
    } catch (sendError) {
      failed++;
      const errorMessage = isDirectSend
        ? sendError.message.replaceAll(subscriber.email, '[redacted]')
        : sendError.message;
      console.error(`Newsletter delivery failed${isDirectSend ? ' for a requested recipient' : ` for ${subscriber.email}`}: ${errorMessage}`);
    }
  }
  if (failed) throw new Error(`${failed} newsletter email(s) failed.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
