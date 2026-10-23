import { getSupabaseAdminClient } from '@/lib/supabase-admin.mjs';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Besucher-Log',
  robots: { index: false, follow: false, nocache: true },
};

const DAY = 86400000;

const SQL_SETUP = `create table if not exists public.visits (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  ip text,
  ip_masked text,
  ip_hash text,
  country text,
  region text,
  city text,
  path text,
  referrer text,
  ua text
);
alter table public.visits enable row level security;
create index if not exists visits_ts_idx on public.visits (ts desc);
create index if not exists visits_hash_idx on public.visits (ip_hash, ts desc);
create index if not exists visits_country_idx on public.visits (country, ts desc);`;

function deviceOf(ua = '') {
  if (/iPad|Tablet/i.test(ua)) return 'Tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'Mobil';
  return 'Desktop';
}

function browserOf(ua = '') {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\/|CriOS/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  if (/curl|python|bot|Bot/i.test(ua)) return 'Script';
  return 'andere';
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} h`;
  return `vor ${Math.round(h / 24)} d`;
}

function hostOf(url) {
  if (!url) return 'direkt';
  try {
    return new URL(url).hostname;
  } catch {
    return '—';
  }
}

const cell = { padding: '7px 10px', borderBottom: '1px solid var(--paper-3)', verticalAlign: 'top' };
const head = { ...cell, fontFamily: 'var(--mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', textAlign: 'left' };
const mono = { fontFamily: 'var(--mono)', fontSize: '12px' };

export default async function VisitsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const days = Math.min(Math.max(Number.parseInt(sp.days, 10) || 7, 1), 90);
  const country = String(sp.country || '').toUpperCase().slice(0, 2);
  const since = new Date(Date.now() - days * DAY).toISOString();

  let rows = [];
  let error = null;

  try {
    const sb = getSupabaseAdminClient();
    let q = sb
      .from('visits')
      .select('ts,ip,ip_masked,ip_hash,country,region,city,path,referrer,ua')
      .gte('ts', since)
      .order('ts', { ascending: false })
      .limit(5000);
    if (country) q = q.eq('country', country);
    const res = await q;
    if (res.error) error = res.error;
    else rows = res.data || [];
  } catch (e) {
    error = e;
  }

  const byCountry = new Map();
  const byVisitor = new Map();

  for (const r of rows) {
    const c = r.country || '??';
    byCountry.set(c, (byCountry.get(c) || 0) + 1);

    const key = r.ip || `${r.ip_masked || '?'}·${r.ip_hash || ''}`;
    const v = byVisitor.get(key) || {
      ip: r.ip || r.ip_masked || '—',
      hash: r.ip_hash || '',
      country: r.country || '??',
      city: r.city || '',
      visits: 0,
      first: r.ts,
      last: r.ts,
      paths: new Map(),
      ua: r.ua || '',
    };
    v.visits += 1;
    if (new Date(r.ts) < new Date(v.first)) v.first = r.ts;
    if (new Date(r.ts) > new Date(v.last)) {
      v.last = r.ts;
      v.ua = r.ua || v.ua;
      if (r.city) v.city = r.city;
    }
    v.paths.set(r.path, (v.paths.get(r.path) || 0) + 1);
    byVisitor.set(key, v);
  }

  const visitors = [...byVisitor.values()].sort((a, b) => new Date(b.last) - new Date(a.last));
  const countries = [...byCountry.entries()].sort((a, b) => b[1] - a[1]);
  const chCount = byCountry.get('CH') || 0;
  const tableMissing = error && /does not exist|PGRST205|42P01/i.test(`${error.code || ''} ${error.message || ''}`);

  return (
    <div className="wrap" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <h1 className="page-title" style={{ fontSize: 'clamp(32px, 6vw, 64px)' }}>Besucher-Log</h1>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px', ...mono }}>
        {[1, 7, 30, 90].map((d) => (
          <a
            key={d}
            href={`?days=${d}${country ? `&country=${country}` : ''}`}
            style={{
              border: '1px solid var(--ink)',
              padding: '5px 12px',
              textDecoration: 'none',
              color: 'var(--ink)',
              background: d === days ? 'var(--ink)' : 'transparent',
              ...(d === days ? { color: 'var(--paper)' } : {}),
            }}
          >
            {d} T
          </a>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>
          {visitors.length} IPs · {rows.length} Aufrufe · {days} Tage
        </span>
      </div>

      {error && (
        <div style={{ border: '1px solid var(--down)', padding: '16px', marginBottom: '24px', background: 'var(--paper-2)' }}>
          <strong>{tableMissing ? 'Tabelle `visits` fehlt noch.' : 'Fehler beim Lesen.'}</strong>
          <p style={{ ...mono, margin: '8px 0' }}>{String(error.message || error)}</p>
          {tableMissing && (
            <pre style={{ ...mono, whiteSpace: 'pre-wrap', background: 'var(--paper-3)', padding: '12px', overflowX: 'auto' }}>
              {SQL_SETUP}
            </pre>
          )}
        </div>
      )}

      {!error && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', background: 'var(--ink)', border: '1px solid var(--ink)', marginBottom: '32px' }}>
            {[
              ['Aufrufe', rows.length],
              ['Unique (Hash)', new Set(rows.map((r) => r.ip_hash)).size],
              ['Länder', countries.length],
              ['aus CH', chCount],
              ['CH-Anteil', rows.length ? `${Math.round((chCount / rows.length) * 100)} %` : '–'],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--paper)', padding: '14px 16px' }}>
                <div className="label" style={{ color: 'var(--muted)', fontSize: '10px' }}>{label}</div>
                <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-.02em' }}>{value}</div>
              </div>
            ))}
          </div>

          <section style={{ marginBottom: '36px' }}>
            <div className="label" style={{ marginBottom: '8px' }}>Länder</div>
            <div style={{ ...mono, display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {countries.map(([c, n]) => (
                <a
                  key={c}
                  href={`?days=${days}&country=${c}`}
                  style={{ border: '1px solid var(--paper-3)', padding: '4px 10px', textDecoration: 'none', color: c === country ? 'var(--paper)' : 'var(--ink)', background: c === country ? 'var(--ink)' : 'transparent' }}
                >
                  {c} <strong>{n}</strong>
                </a>
              ))}
              {country && <a href={`?days=${days}`} style={{ ...mono, color: 'var(--muted)' }}>Filter weg</a>}
            </div>
          </section>

          <section style={{ marginBottom: '36px', overflowX: 'auto' }}>
            <div className="label" style={{ marginBottom: '8px' }}>IPs (neueste zuerst)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
              <thead>
                <tr>
                  {['IP', 'Hash', 'Land', 'Stadt', 'Aufrufe', 'Zuletzt', 'Top-Seite', 'Gerät'].map((h) => (
                    <th key={h} style={head}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visitors.slice(0, 200).map((v) => {
                  const topPath = [...v.paths.entries()].sort((a, b) => b[1] - a[1])[0];
                  return (
                    <tr key={`${v.ip}-${v.hash}`}>
                      <td style={{ ...cell, ...mono }}>{v.ip}</td>
                      <td style={{ ...cell, ...mono, color: 'var(--muted)' }}>{(v.hash || '').slice(0, 10)}</td>
                      <td style={cell}>{v.country}</td>
                      <td style={cell}>{v.city || '–'}</td>
                      <td style={{ ...cell, ...mono }}>{v.visits}</td>
                      <td style={{ ...cell, ...mono, whiteSpace: 'nowrap' }}>{timeAgo(v.last)}</td>
                      <td style={{ ...cell, ...mono, maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topPath?.[0]}</td>
                      <td style={{ ...cell, ...mono }}>{browserOf(v.ua)} · {deviceOf(v.ua)}</td>
                    </tr>
                  );
                })}
                {visitors.length === 0 && (
                  <tr><td style={cell} colSpan={8}>Noch keine Aufrufe im Zeitraum.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          <section style={{ overflowX: 'auto' }}>
            <div className="label" style={{ marginBottom: '8px' }}>Letzte 100 Ereignisse</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '680px' }}>
              <thead>
                <tr>{['Zeit', 'IP', 'Land', 'Stadt', 'Pfad', 'Referrer'].map((h) => <th key={h} style={head}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={`${r.ts}-${i}`}>
                    <td style={{ ...cell, ...mono, whiteSpace: 'nowrap' }}>{new Date(r.ts).toLocaleString('de-CH', { timeZone: 'Europe/Zurich' })}</td>
                    <td style={{ ...cell, ...mono }}>{r.ip || r.ip_masked}</td>
                    <td style={cell}>{r.country || '??'}</td>
                    <td style={cell}>{r.city || '–'}</td>
                    <td style={{ ...cell, ...mono }}>{r.path}</td>
                    <td style={{ ...cell, ...mono, color: 'var(--muted)' }}>{hostOf(r.referrer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p style={{ ...mono, color: 'var(--muted)', marginTop: '24px' }}>
            IPs werden als <code>ip_hash</code> (SHA-256 + Salt) und <code>ip_masked</code> (/24) gespeichert.
            Volltext-IP nur wenn <code>VISITS_FULL_IP=1</code> gesetzt ist.
          </p>
        </>
      )}
    </div>
  );
}
