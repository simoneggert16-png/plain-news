import { getDict } from '@/lib/i18n.mjs';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return { title: getDict(locale).about };
}

export default async function About({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  return (
    <>
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
        <div className="label" style={{ marginBottom: '10px' }}>INITIATIVE & REDAKTION</div>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: '28px', margin: '0 0 12px 0' }}>
          {locale === 'de' ? 'Gegründet von Simon Eggert' : 'Founded by Simon Eggert'}
        </h2>
        <p style={{ maxWidth: '65ch', color: 'var(--ink-2)', lineHeight: '1.6' }}>
          {locale === 'de'
            ? 'PLAIN. entstand als Antwort auf reißerische Schlagzeilen, Clickbait, algorithmische Echokammern und überladene Werbeseiten. Simon Eggert konzipierte diese Plattform als unabhängigen, radikal faktenbasierten und gemeinnützigen Gegenentwurf: Zwei-Quellen-Zwang, offengelegtes Framing konkurrierender Medien und absolute Transparenz.'
            : 'PLAIN. was founded by Simon Eggert as an antidote to clickbait, sensory overload, and algorithmic outrage. Operating strictly non-commercial and open source, PLAIN. guarantees zero tracking, zero advertising, and adversarial fact-verification.'}
        </p>
      </section>
    </>
  );
}
