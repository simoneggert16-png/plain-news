import { Suspense } from 'react';
import { getDict } from '@/lib/i18n.mjs';
import MarketsBoard from '@/components/MarketsBoard';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return { title: getDict(locale).markets };
}

export default async function MarketsPage({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  return (
    <>
      <h1 className="page-title">{t.markets}</h1>
      <Suspense>
        <MarketsBoard locale={locale} t={t} />
      </Suspense>
      <p className="note">{t.marketsNote}</p>
    </>
  );
}
