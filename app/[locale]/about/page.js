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
    </>
  );
}
