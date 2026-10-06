import Link from 'next/link';
import { localize } from '@/lib/content.mjs';
import { fmtDate } from '@/lib/format.mjs';

export default function Card({ a, locale, t, bcp }) {
  const l = localize(a, locale);
  return (
    <Link href={`/${locale}/a/${a.slug}`} className="card">
      <span className="label">{t.cat[a.category]}</span>
      <h3>{l.title}</h3>
      <p>{l.dek}</p>
      <span className="meta">{fmtDate(a.publishedAt, bcp)} · {a.sourceCount} {t.sources}</span>
    </Link>
  );
}
