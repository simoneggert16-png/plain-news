import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LOCALES, LOCALE_CODES, CATEGORIES, isCategory } from '@/lib/config.mjs';
import { getDict } from '@/lib/i18n.mjs';
import { listFor, localize } from '@/lib/content.mjs';
import { fmtDate } from '@/lib/format.mjs';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALE_CODES.flatMap((locale) => CATEGORIES.map((cat) => ({ locale, cat })));
}

export async function generateMetadata({ params }) {
  const { locale, cat } = await params;
  return { title: getDict(locale).cat[cat] };
}

export default async function CategoryPage({ params }) {
  const { locale, cat } = await params;
  if (!isCategory(cat)) notFound();
  const t = getDict(locale);
  const bcp = LOCALES.find((l) => l.code === locale).bcp47;
  const items = listFor({ category: cat, limit: 60 });

  return (
    <>
      <h1 className="page-title">{t.cat[cat]}</h1>
      {items.length === 0 ? (
        <div className="empty">{t.empty}</div>
      ) : (
        <div className="list">
          {items.map((a) => {
            const l = localize(a, locale);
            return (
              <Link key={a.slug} href={`/${locale}/a/${a.slug}`} className="row">
                <span className="meta">{fmtDate(a.publishedAt, bcp)}<br />{a.sourceCount} {t.sources}</span>
                <h3>{l.title}</h3>
                <p>{l.dek}</p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
