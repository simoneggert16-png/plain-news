import nodemailer from 'nodemailer';

// Supported translations for confirmation emails
const EMAIL_TRANSLATIONS = {
  de: {
    subject: 'PLAIN. — Bestätigung deiner Registrierung',
    preheader: 'Willkommen bei PLAIN. Bitte bestätige deine E-Mail-Adresse.',
    headline: 'WILLKOMMEN BEI PLAIN.',
    greeting: (user) => `Grüezi ${user},`,
    body1: 'vielen Dank für deine Registrierung bei PLAIN. Wir freuen uns, dich als Teil unserer werbefreien, faktenbasierten Leser-Community zu begrüssen.',
    beatsTitle: 'Deine ausgewählten Themen-Schwerpunkte:',
    actionText: 'Klicke auf den folgenden Button, um deine E-Mail-Adresse zu bestätigen und dein Konto vollständig freizuschalten:',
    buttonLabel: 'Konto jetzt bestätigen →',
    altLinkText: 'Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:',
    securityNote: 'Dieser Bestätigungslink ist 24 Stunden gültig. Wenn du diese Registrierung nicht vorgenommen hast, kannst du diese E-Mail einfach ignorieren.',
    footer: 'PLAIN. — Unabhängiger Schweizer Journalismus. Keine Werbung. Kein Tracking.',
  },
  en: {
    subject: 'PLAIN. — Confirm your registration',
    preheader: 'Welcome to PLAIN. Please confirm your email address.',
    headline: 'WELCOME TO PLAIN.',
    greeting: (user) => `Hello ${user},`,
    body1: 'Thank you for registering with PLAIN. Welcome to our independent, ad-free, fact-based news platform.',
    beatsTitle: 'Your selected news beats:',
    actionText: 'Click the button below to verify your email address and activate your account:',
    buttonLabel: 'Confirm Account Now →',
    altLinkText: 'If the button does not work, copy and paste this link into your browser:',
    securityNote: 'This verification link is valid for 24 hours. If you did not create this account, you can safely ignore this email.',
    footer: 'PLAIN. — Independent Swiss Journalism. Zero ads. Zero tracking.',
  },
  fr: {
    subject: 'PLAIN. — Confirmation de votre inscription',
    preheader: 'Bienvenue sur PLAIN. Veuillez confirmer votre adresse e-mail.',
    headline: 'BIENVENUE SUR PLAIN.',
    greeting: (user) => `Bonjour ${user},`,
    body1: 'Merci pour votre inscription à PLAIN. Nous sommes ravis de vous accueillir au sein de notre communauté.',
    beatsTitle: 'Vos centres d’intérêt sélectionnés :',
    actionText: 'Cliquez sur le bouton ci-dessous pour confirmer votre adresse e-mail :',
    buttonLabel: 'Confirmer mon compte →',
    altLinkText: 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
    securityNote: 'Ce lien est valable 24 heures.',
    footer: 'PLAIN. — Journalisme indépendant suisse.',
  },
  it: {
    subject: 'PLAIN. — Conferma della tua registrazione',
    preheader: 'Benvenuto su PLAIN. Conferma il tuo indirizzo email.',
    headline: 'BENVENUTO SU PLAIN.',
    greeting: (user) => `Ciao ${user},`,
    body1: 'Grazie per esserti registrato su PLAIN.',
    beatsTitle: 'I tuoi argomenti selezionati:',
    actionText: 'Clicca sul pulsante qui sotto per verificare la tua email:',
    buttonLabel: 'Conferma Account →',
    altLinkText: 'Se il pulsante non funziona, copia questo link:',
    securityNote: 'Questo link è valido per 24 ore.',
    footer: 'PLAIN. — Giornalismo indipendente svizzero.',
  },
};

export function buildConfirmationHtml({ username, email, confirmUrl, locale = 'de', topics = [] }) {
  const t = EMAIL_TRANSLATIONS[locale] || EMAIL_TRANSLATIONS.de;

  const topicListHtml = topics && topics.length > 0
    ? `<ul style="margin: 12px 0 20px 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #111;">
        ${topics.map((item) => `<li style="margin-bottom: 4px;"><strong>${item}</strong></li>`).join('')}
       </ul>`
    : '';

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <title>${t.subject}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f5; margin: 0; padding: 24px; color: #0a0a0a; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border: 2px solid #000000; box-shadow: 6px 6px 0px #000000; padding: 36px 32px; }
    .badge { display: inline-block; background: #000; color: #fff; font-family: monospace; font-size: 11px; font-weight: bold; padding: 4px 10px; letter-spacing: 1px; margin-bottom: 20px; }
    h1 { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; margin: 0 0 16px 0; text-transform: uppercase; }
    p { font-size: 14.5px; line-height: 1.65; color: #222; margin: 0 0 16px 0; }
    .btn { display: inline-block; background: #000000; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 28px; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 0; border: 2px solid #000000; margin: 18px 0; }
    .btn:hover { background: #e02424; border-color: #e02424; }
    .alt-box { background: #f0f0ed; border-left: 3px solid #000; padding: 12px 16px; font-size: 12px; font-family: monospace; word-break: break-all; margin: 20px 0; }
    .footer { border-top: 1px solid #e0e0dc; padding-top: 18px; margin-top: 28px; font-size: 11px; color: #666; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">PLAIN. VERIFICATION</div>
    <h1>${t.headline}</h1>
    <p><strong>${t.greeting(username)}</strong></p>
    <p>${t.body1}</p>
    
    ${topics.length ? `<p><strong>${t.beatsTitle}</strong></p>${topicListHtml}` : ''}

    <p>${t.actionText}</p>

    <div style="text-align: left; margin: 24px 0;">
      <a href="${confirmUrl}" class="btn" target="_blank">${t.buttonLabel}</a>
    </div>

    <p style="font-size: 12px; color: #555;">${t.altLinkText}</p>
    <div class="alt-box">
      <a href="${confirmUrl}" style="color: #000; text-decoration: underline;">${confirmUrl}</a>
    </div>

    <p style="font-size: 12px; color: #777; margin-top: 24px;">
      ${t.securityNote}
    </p>

    <div class="footer">
      ${t.footer}<br>
      PLAIN News Switzerland &middot; <a href="https://www.plain-news.ch" style="color: #000;">plain-news.ch</a>
    </div>
  </div>
</body>
</html>`;
}

export async function sendConfirmationEmail({ email, username, confirmUrl, locale = 'de', topics = [] }) {
  const t = EMAIL_TRANSLATIONS[locale] || EMAIL_TRANSLATIONS.de;
  const html = buildConfirmationHtml({ username, email, confirmUrl, locale, topics });

  // 1. Check if SMTP configuration exists in process.env
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"PLAIN. News" <noreply@plain-news.ch>',
        to: email,
        subject: t.subject,
        html,
      });

      console.log('[email] SMTP confirmation sent successfully:', info.messageId);
      return { success: true, method: 'smtp', messageId: info.messageId, html };
    } catch (err) {
      console.error('[email] SMTP delivery failed:', err.message);
    }
  }

  // 2. Check if Resend API Key is present
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'PLAIN. <onboarding@resend.dev>',
          to: [email],
          subject: t.subject,
          html,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log('[email] Resend confirmation sent successfully:', data.id);
        return { success: true, method: 'resend', messageId: data.id, html };
      }
    } catch (err) {
      console.error('[email] Resend delivery failed:', err.message);
    }
  }

  // 3. Fallback: Log and return generated confirmation email for in-app delivery / instant verification
  console.log(`[email] Confirmation generated for ${email} (${username}): ${confirmUrl}`);
  return {
    success: true,
    method: 'instant_dispatch',
    simulated: true,
    html,
    confirmUrl,
  };
}
