import Link from 'next/link';
import { SITE, LOCALES } from '@/lib/config.mjs';
import { getDict } from '@/lib/i18n.mjs';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isDe = locale === 'de';
  return {
    title: getDict(locale).about,
    description: isDe
      ? 'Wer PLAIN. betreibt, wie die KI-Redaktion arbeitet, welche Quellenregeln gelten und wie Korrekturen eingereicht werden.'
      : 'Who operates PLAIN., how the AI newsroom works, which sourcing rules apply and how to submit corrections.',
    alternates: {
      canonical: `${SITE.url}/${locale}/about`,
      languages: Object.fromEntries(LOCALES.map((l) => [l.code, `${SITE.url}/${l.code}/about`])),
    },
  };
}

export default async function About({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const isDe = locale === 'de';

  const copy = isDe
    ? {
        whoTitle: 'Wer PLAIN. betreibt',
        who: [
          ['Plattform', 'PLAIN. (plain-news.ch)'],
          ['Betreiber & Gründer', 'Simon Eggert'],
          ['Standort', 'Schweiz (CH)'],
          ['Kontakt', 'simoneggert16@gmail.com'],
          ['Charakter', 'Nicht-kommerzielles, unabhängiges Open-Source-Informationsprojekt.'],
        ],
        processTitle: 'So entsteht eine Story',
        process: [
          ['1. Scout', 'Die Redaktion liest rund 50 internationale RSS-Feeds – öffentlich-rechtliche Sender, Wire-Dienste, Fachmedien und Zeitungen aus verschiedenen Regionen.'],
          ['2. Desk', 'Schlagzeilen werden zu Ereignissen geclustert. In der Regel braucht eine Meldung mindestens zwei unabhängige Quellen. Bei amtlichen Stellen, Fachjournalen oder Unternehmensmitteilungen kann eine autoritative Primärquelle genügen.'],
          ['3. Reporter', 'Ein Reporter-Agent liest die Quelltexte und schreibt einen neutralen Entwurf ausschliesslich aus den vorhandenen Informationen.'],
          ['4. Editor', 'Ein separater Editor-Agent prüft jeden Satz gegen die Quellen, entfernt unbelegte Behauptungen und lehnt dünne oder widersprüchliche Meldungen ab.'],
          ['5. Übersetzung', 'Der geprüfte Artikel wird in alle neun Sprachen übersetzt.'],
          ['6. Publikation', 'Der Artikel wird mit Quellen, Datum und Transparenzhinweisen veröffentlicht.'],
        ],
        aiTitle: 'Einsatz von KI – offen erklärt',
        ai: 'PLAIN. ist eine automatisierte KI-Redaktion. Reporter-, Editor- und Übersetzungsagenten erstellen und prüfen die Artikel. Es gibt keine versteckte menschliche Autorenschaft und keine erfundene Redaktion. Der Betreiber verantwortet die Plattform, die Quellenregeln und die Bearbeitung von Korrekturhinweisen. Jeder Artikel nennt die verwendeten Medien mit Originaltitel und Direktlink.',
        sourcesTitle: 'Quellen, Framing & Korrekturen',
        sources: 'Unter jedem Artikel stehen die Originalquellen mit Medium, Titel und Link. So ist nachvollziehbar, worauf eine Meldung beruht und wie unterschiedliche Medien sie gerahmt haben. Wenn du einen Fehler findest, schreib eine kurze Nachricht mit Artikel-URL und Beleg. Geprüfte Korrekturen werden im Artikel nachgeführt.',
        fundingTitle: 'Finanzierung & Unabhängigkeit',
        funding: 'PLAIN. ist nicht-kommerziell. Es gibt keine Werbung, keine Abos, keine Paywall, kein Tracking und keine bezahlten Inhalte. Das Projekt finanziert sich über den Betrieb durch den Gründer; es besteht keine redaktionelle Abhängigkeit von Werbekunden oder Parteien.',
        cadenceTitle: 'Update-Kadenz',
        cadence: 'Die Redaktion läuft alle fünf Stunden. Pro Lauf sind bis zu fünf neue, verifizierte Stories pro Kategorie vorgesehen. Wenn für eine Kategorie keine ausreichend belegte neue Meldung vorliegt, wird sie nicht mit erfundenen Inhalten aufgefüllt. Qualität und Quellenlage gehen vor Taktung.',
        languagesTitle: 'Sprachen',
        languages: 'Alle Artikel erscheinen in Englisch, Deutsch, Französisch, Spanisch, Italienisch, Portugiesisch, Chinesisch, Japanisch und Koreanisch. Fehlt eine Übersetzung, wird der englische Originaltext angezeigt.',
        corrections: 'Korrektur einreichen',
        legal: 'Impressum & Rechtliches',
        privacy: 'Datenschutz',
      }
    : {
        whoTitle: 'Who operates PLAIN.',
        who: [
          ['Platform', 'PLAIN. (plain-news.ch)'],
          ['Publisher & founder', 'Simon Eggert'],
          ['Location', 'Switzerland (CH)'],
          ['Contact', 'simoneggert16@gmail.com'],
          ['Nature', 'Non-commercial, independent open-source information project.'],
        ],
        processTitle: 'How a story is made',
        process: [
          ['1. Scout', 'The newsroom reads roughly 50 international RSS feeds – public broadcasters, wires, specialist outlets and newspapers from different regions.'],
          ['2. Desk', 'Headlines are clustered into events. As a rule, a report needs at least two independent outlets. For official agencies, peer-reviewed journals or company statements, one authoritative primary source can be sufficient.'],
          ['3. Reporter', 'A reporter agent reads the source texts and writes a neutral draft using only the available information.'],
          ['4. Editor', 'A separate editor agent checks every sentence against the sources, removes unsupported claims and rejects thin or contradictory reports.'],
          ['5. Translation', 'The checked article is translated into all nine languages.'],
          ['6. Publish', 'The article is published with sources, timestamps and transparency notes.'],
        ],
        aiTitle: 'AI use – disclosed',
        ai: 'PLAIN. is an automated AI newsroom. Reporter, editor and translation agents create and check the articles. There is no hidden human authorship and no invented newsroom. The operator is responsible for the platform, the sourcing rules and handling corrections. Every article lists the outlets used, with their original headline and a direct link.',
        sourcesTitle: 'Sources, framing & corrections',
        sources: 'Every article lists its primary sources with outlet, headline and link. This makes it possible to see what a report is based on and how different outlets framed it. If you find an error, send a short message with the article URL and evidence. Verified corrections are updated in the article.',
        fundingTitle: 'Funding & independence',
        funding: 'PLAIN. is non-commercial. There are no ads, no subscriptions, no paywall, no tracking and no paid content. The project is operated and funded by its founder; there is no editorial dependency on advertisers or political parties.',
        cadenceTitle: 'Update cadence',
        cadence: 'The newsroom runs every five hours. Each run targets up to five new verified stories per category. If a category has no sufficiently sourced new event, it is not padded with invented content. Sourcing quality takes priority over cadence.',
        languagesTitle: 'Languages',
        languages: 'All articles are published in English, German, French, Spanish, Italian, Portuguese, Chinese, Japanese and Korean. If a translation is missing, the English original is shown.',
        corrections: 'Submit a correction',
        legal: 'Legal notice',
        privacy: 'Privacy',
      };

  const aboutJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    url: `${SITE.url}/${locale}/about`,
    name: `${t.about} — ${SITE.name}`,
    inLanguage: LOCALES.find((l) => l.code === locale)?.bcp47 || 'en-GB',
    isPartOf: { '@id': `${SITE.url}/#website` },
    mainEntity: {
      '@type': 'NewsMediaOrganization',
      '@id': `${SITE.url}/#organization`,
      name: SITE.name,
      url: SITE.url,
      founder: { '@type': 'Person', name: 'Simon Eggert' },
      publishingPrinciples: `${SITE.url}/${locale}/about`,
      correctionsPolicy: `${SITE.url}/${locale}/about#corrections`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }} />
      <h1 className="page-title">{t.about}</h1>
      <ol className="principles">
        {t.principles.map(([h, p]) => (
          <li key={h}>
            <h3>{h}</h3>
            <p>{p}</p>
          </li>
        ))}
      </ol>

      <section style={{ marginTop: '48px', borderTop: 'var(--rule-thick)', paddingTop: '24px' }}>
        <div className="label" style={{ marginBottom: '10px' }}>{copy.whoTitle}</div>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: '28px', margin: '0 0 12px 0' }}>
          {isDe ? 'Gegründet von Simon Eggert' : 'Founded by Simon Eggert'}
        </h2>
        <dl className="about-facts">
          {copy.who.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {label === 'Kontakt' || label === 'Contact' ? (
                  <a href="mailto:simoneggert16@gmail.com">{value}</a>
                ) : value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="art-section" style={{ marginTop: '40px' }}>
        <h2>{copy.processTitle}</h2>
        <ol className="about-process">
          {copy.process.map(([title, text]) => (
            <li key={title}>
              <strong>{title}</strong>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="art-section">
        <h2>{copy.aiTitle}</h2>
        <p>{copy.ai}</p>
      </section>

      <section className="art-section" id="corrections">
        <h2>{copy.sourcesTitle}</h2>
        <p>{copy.sources}</p>
        <p>
          <a href="mailto:simoneggert16@gmail.com">{copy.corrections}: simoneggert16@gmail.com</a>
        </p>
      </section>

      <section className="art-section" id="funding">
        <h2>{copy.fundingTitle}</h2>
        <p>{copy.funding}</p>
      </section>

      <section className="art-section">
        <h2>{copy.cadenceTitle}</h2>
        <p>{copy.cadence}</p>
      </section>

      <section className="art-section">
        <h2>{copy.languagesTitle}</h2>
        <p>{copy.languages}</p>
      </section>

      <section className="art-section">
        <p>
          <Link href={`/${locale}/legal`}>{copy.legal}</Link>
          {' · '}
          <Link href={`/${locale}/privacy`}>{copy.privacy}</Link>
          {' · '}
          <a href={`${SITE.url}/llms.txt`}>llms.txt</a>
        </p>
      </section>
    </>
  );
}
