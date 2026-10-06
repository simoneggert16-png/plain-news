import Link from 'next/link';
import { localize } from '@/lib/content.mjs';
import { fmtDate } from '@/lib/format.mjs';

export default function Card({ a, locale, t, bcp }) {
  const l = localize(a, locale);
  return (
    <Link href={`/${locale}/a/${a.slug}`} className="card">
      {a.image && (
        <div className="card-thumb-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.image} alt="" className="card-thumb" loading="lazy" />
        </div>
      )}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <span className="label">{t.cat[a.category]}</span>
        {a.video && <span className="badge-video">▶ VIDEO</span>}
      </div>
      <h3>{l.title}</h3>
      <p>{l.dek}</p>
      <span className="meta">{fmtDate(a.publishedAt, bcp)} · {a.sourceCount} {t.sources}</span>
    </Link>
  );
}
