import Link from 'next/link';
import { LOCALES } from '@/lib/config.mjs';
import { getDict } from '@/lib/i18n.mjs';
import { listFor, localize } from '@/lib/content.mjs';
import Card from '@/components/Card';

export async function generateMetadata({ params, searchParams }) {
  const { locale } = await params;
  const sp = await searchParams;
  const q = sp?.q || '';
  return {
    title: q ? `${q} – Suche | PLAIN.` : 'Suche | PLAIN.',
  };
}

export default async function SearchPage({ params, searchParams }) {
  const { locale } = await params;
  const sp = await searchParams;
  const q = (sp?.q || '').trim();
  const t = getDict(locale);
  const bcp = LOCALES.find((l) => l.code === locale)?.bcp47 || 'de-CH';

  const all = listFor();
  const queryLower = q.toLowerCase();

  const results = q
    ? all.filter((a) => {
        const l = localize(a, locale);
        const titleMatch = l.title?.toLowerCase().includes(queryLower);
        const dekMatch = l.dek?.toLowerCase().includes(queryLower);
        const factsMatch = (l.facts || []).some((f) => f.toLowerCase().includes(queryLower));
        const bodyMatch = (l.body || []).some((p) => p.toLowerCase().includes(queryLower));
        return titleMatch || dekMatch || factsMatch || bodyMatch;
      })
    : [];

  return (
    <div className="search-page">
      <header className="search-header">
        <div className="label" style={{ marginBottom: '8px' }}>ARCHIV & RECHERCHE</div>
        <h1 className="page-title">{locale === 'de' ? 'Suche' : 'Search'}</h1>

        <form action={`/${locale}/search`} method="GET" className="search-console">
          <div className="search-input-wrap">
            <svg className="search-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16" y2="16" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder={locale === 'de' ? 'Thema, Person oder Stichwort suchen (z. B. Frankreich, AfD, KI)…' : 'Search topics, people, events (e.g. France, AI, Markets)…'}
              className="search-input"
              autoFocus
            />
          </div>
          <button type="submit" className="search-submit-btn">
            {locale === 'de' ? 'SUCHEN' : 'SEARCH'}
          </button>
        </form>

        <div className="search-quick-tags">
          <span className="label">{locale === 'de' ? 'HÄUFIG GESUCHT:' : 'TRENDING:'}</span>
          {['Frankreich', 'Sachsen-Anhalt', 'Anthropic', 'Paramount', 'NFL'].map((tag) => (
            <Link key={tag} href={`/${locale}/search?q=${encodeURIComponent(tag)}`} className="search-quick-tag">
              {tag}
            </Link>
          ))}
        </div>
      </header>

      {q && (
        <div className="search-results-info">
          {results.length > 0 ? (
            <p className="search-count">
              {locale === 'de'
                ? `${results.length} verifizierte Meldung(en) zu „${q}“`
                : `${results.length} verified story(ies) for “${q}”`}
            </p>
          ) : null}
        </div>
      )}

      {/* RESULTS LIST */}
      {results.length > 0 && (
        <section className="grid">
          {results.map((a) => (
            <Card key={a.slug} a={a} locale={locale} t={t} bcp={bcp} />
          ))}
        </section>
      )}

      {/* NO RESULTS: EDITORIAL EXPLANATION & EXTERNAL REDIRECT TO TRUSTED PROVIDERS */}
      {q && results.length === 0 && (
        <section className="search-fallback-card">
          <div className="search-fallback-badge">PLAIN. FACT GATE</div>
          <h2>
            {locale === 'de'
              ? `Keine bestätigten Meldungen zu „${q}“ im Archiv`
              : `No verified reports for “${q}” in our archive`}
          </h2>
          <p className="search-fallback-desc">
            {locale === 'de'
              ? `PLAIN veröffentlicht eine Story nur, wenn mindestens 2 unabhängige Primärmedien das Ereignis verifizieren. Möglicherweise ist das Thema noch unbestätigt, fällt unter Gerüchte oder wurde von unseren Quellen noch nicht abgedeckt.`
              : `PLAIN only publishes when at least 2 independent wire/news outlets confirm an event. The story might still be unconfirmed, single-sourced, or breaking.`}
          </p>

          <div className="search-fallback-providers">
            <span className="search-fallback-lead">
              {locale === 'de' ? 'Bei etablierten Primäranbietern weitersuchen:' : 'Continue search across primary outlets:'}
            </span>
            <div className="search-fallback-grid">
              <a
                href={`https://news.google.com/search?q=${encodeURIComponent(q)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fallback-btn"
              >
                <span>Google News</span>
                <span className="ext-arrow" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                    <path d="M7 17L17 7M17 7H8M17 7V16" />
                  </svg>
                </span>
              </a>

              <a
                href={`https://www.reuters.com/site-search/?query=${encodeURIComponent(q)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fallback-btn"
              >
                <span>Reuters</span>
                <span className="ext-arrow" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                    <path d="M7 17L17 7M17 7H8M17 7V16" />
                  </svg>
                </span>
              </a>

              <a
                href={`https://www.bbc.co.uk/search?q=${encodeURIComponent(q)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fallback-btn"
              >
                <span>BBC News</span>
                <span className="ext-arrow" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                    <path d="M7 17L17 7M17 7H8M17 7V16" />
                  </svg>
                </span>
              </a>

              <a
                href={`https://apnews.com/search?q=${encodeURIComponent(q)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fallback-btn"
              >
                <span>Associated Press</span>
                <span className="ext-arrow" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                    <path d="M7 17L17 7M17 7H8M17 7V16" />
                  </svg>
                </span>
              </a>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
