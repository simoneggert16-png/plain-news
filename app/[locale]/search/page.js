import Link from 'next/link';
import { LOCALES } from '@/lib/config.mjs';
import { getDict } from '@/lib/i18n.mjs';
import { entriesForSlugs, searchArticles } from '@/lib/content.mjs';
import { searchCommunity } from '@/lib/communityStore.mjs';
import Card from '@/components/Card';

export async function generateMetadata({ params, searchParams }) {
  const { locale } = await params;
  const sp = await searchParams;
  const q = sp?.q || '';
  return {
    title: q ? `${q} – Suche & Recherche | PLAIN.` : 'Suche & Recherche | PLAIN.',
    // Search result pages are useful to humans but should not compete with the
    // article URLs in search or AI indexes.
    robots: q
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

export default async function SearchPage({ params, searchParams }) {
  const { locale } = await params;
  const sp = await searchParams;
  const q = (sp?.q || '').trim();
  const t = getDict(locale);
  const isDe = locale === 'de';
  const bcp = LOCALES.find((l) => l.code === locale)?.bcp47 || 'de-CH';

  // Full-text search runs in Postgres (fast); community search runs alongside.
  // A community backend that is briefly unavailable must not take the article
  // search down with it.
  const timings = {};
  const timeIt = async (label, promise) => {
    const t0 = Date.now();
    const value = await promise;
    timings[label] = Date.now() - t0;
    return value;
  };
  const [slugs, userResults] = q
    ? await Promise.all([
        timeIt('rpc', searchArticles(q).catch(() => [])),
        timeIt('community', searchCommunity(q).catch(() => ({ comments: [], submissions: [], chatMessages: [] }))),
      ])
    : [[], { comments: [], submissions: [], chatMessages: [] }];

  const tBeforeEntries = Date.now();
  const results = await entriesForSlugs(slugs);
  timings.entries = Date.now() - tBeforeEntries;
  if (sp?.debug === 'timing') {
    const t0 = Date.now();
    await searchArticles(q).catch(() => []);
    timings.rpc2 = Date.now() - t0;
    const t1 = Date.now();
    await searchCommunity(q).catch(() => ({}));
    timings.community2 = Date.now() - t1;
    const base = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    for (const n of [1, 2]) {
      const t2 = Date.now();
      await fetch(`${base}/rest/v1/content_blobs?select=key&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' }).catch(() => {});
      timings[`net${n}`] = Date.now() - t2;
    }
  }
  const timingLine = `rpc1=${timings.rpc}ms rpc2=${timings.rpc2}ms comm1=${timings.community}ms comm2=${timings.community2}ms entries=${timings.entries}ms net1=${timings.net1}ms net2=${timings.net2}ms hits=${results.length}`;
  const totalUserMatches = userResults.comments.length + userResults.submissions.length + userResults.chatMessages.length;

  return (
    <div className="search-page">
      {sp?.debug === 'timing' && <div data-search-timing={timingLine} style={{ display: 'none' }} />}
      <header className="search-header">
        <div className="label" style={{ marginBottom: '8px' }}>ARCHIV, VOLLTEXT & COMMUNITY-RECHERCHE</div>
        <h1 className="page-title">{isDe ? 'Suche & Recherche' : 'Search & Archive'}</h1>

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
              placeholder={isDe ? 'Artikelinhalt, Thema oder Benutzername suchen (z. B. SNB, KI, @Alex, Bern)…' : 'Search article body, topic or username (e.g. SNB, AI, @Alex)…'}
              className="search-input"
              autoFocus
            />
          </div>
          <button type="submit" className="search-submit-btn">
            {isDe ? 'SUCHEN' : 'SEARCH'}
          </button>
        </form>

        <div className="search-quick-tags">
          <span className="label">{isDe ? 'HÄUFIG GESUCHT:' : 'TRENDING:'}</span>
          {['Bundesrat', 'SNB', 'Fussball', 'Anthropic', 'Klimadaten', 'Alex'].map((tag) => (
            <Link key={tag} href={`/${locale}/search?q=${encodeURIComponent(tag)}`} className="search-quick-tag">
              {tag}
            </Link>
          ))}
        </div>
      </header>

      {/* COMMUNITY / USERNAME RESULTS */}
      {q && totalUserMatches > 0 && (
        <section className="search-community-results" style={{ marginBottom: '32px' }}>
          <div className="sec-head">
            <h2>
               {isDe ? `Gefundene Community-Beiträge & Kommentare von „${q}“` : `Community Contributions & Comments by “${q}”`} ({totalUserMatches})
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {userResults.comments.map((c) => (
              <div key={c.id} className="comment-card" style={{ background: 'var(--paper-2)' }}>
                <div className="comment-meta">
                  <span className="comment-author"> Kommentar von <strong>{c.author}</strong></span>
                  <Link href={`/${locale}/a/${c.slug}`} style={{ textDecoration: 'underline', color: 'var(--ink)' }}>
                     {isDe ? 'Zum Artikel' : 'View Article'}
                  </Link>
                </div>
                <p className="comment-content" style={{ margin: '4px 0 0' }}>„{c.content}“</p>
              </div>
            ))}

            {userResults.submissions.map((s) => (
              <div key={s.id} className="comment-card" style={{ background: 'var(--paper-2)' }}>
                <div className="comment-meta">
                  <span className="comment-author"> Primärquelle eingereicht von <strong>{s.author}</strong></span>
                  <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>
                     {isDe ? 'Quelle öffnen' : 'Open Source'}
                  </a>
                </div>
                <h4 style={{ margin: '4px 0 2px' }}>{s.title}</h4>
                <p className="comment-content">{s.summary}</p>
              </div>
            ))}

            {userResults.chatMessages.map((m) => (
              <div key={m.id} className="comment-card" style={{ background: 'var(--paper-2)' }}>
                <div className="comment-meta">
                  <span className="comment-author"> Live-Chat Beitrag von <strong>{m.user}</strong></span>
                  <Link href={`/${locale}/c/community`} style={{ textDecoration: 'underline' }}>
                     {isDe ? 'Zum Chatroom' : 'To Chatroom'}
                  </Link>
                </div>
                <p className="comment-content">„{m.text}“</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ARTICLE FULL-TEXT RESULTS */}
      {q && (
        <div className="search-results-info">
          {results.length > 0 ? (
            <p className="search-count">
              {isDe
                ? `${results.length} verifizierte Meldung(en) mit Volltext-Treffer zu „${q}“`
                : `${results.length} verified report(s) matching article content for “${q}”`}
            </p>
          ) : null}
        </div>
      )}

      {/* RESULTS GRID */}
      {results.length > 0 && (
        <section className="grid grid-top">
          {results.map((a) => (
            <Card key={a.slug} a={a} locale={locale} t={t} bcp={bcp} />
          ))}
        </section>
      )}

      {/* NO RESULTS FALLBACK */}
      {q && results.length === 0 && totalUserMatches === 0 && (
        <section className="search-fallback-card">
          <div className="search-fallback-badge">PLAIN. FACT GATE</div>
          <h2>
            {isDe
              ? `Keine Treffer zu „${q}“ im Volltext-Archiv oder bei Nutzern`
              : `No verified reports or users found for “${q}”`}
          </h2>
          <p className="search-fallback-desc">
            {isDe
              ? `PLAIN durchsucht Titel, Zusammenfassungen, den gesamten Artikeltext und alle Community-Autoren. Möglicherweise ist der gesuchte Begriff noch nicht vorgekommen oder anders formuliert.`
              : `Searched across headlines, body paragraphs, and community handles.`}
          </p>

          <div className="search-fallback-providers">
            <span className="search-fallback-lead">
              {isDe ? 'Bei Primärquellen weitersuchen:' : 'Continue search across primary outlets:'}
            </span>
            <div className="search-fallback-grid">
              <a
                href={`https://news.google.com/search?q=${encodeURIComponent(q)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fallback-btn"
              >
                <span>Google News</span>
                <span className="fallback-arr"></span>
              </a>
              <a
                href={`https://de.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fallback-btn"
              >
                <span>Wikipedia</span>
                <span className="fallback-arr"></span>
              </a>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
