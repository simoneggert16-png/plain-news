import { LOCALE_CODES, SITE } from '@/lib/config.mjs';
import { getDict } from '@/lib/i18n.mjs';
import MavenWorkspace from '@/components/MavenWorkspace';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const url = `${SITE.url}/${locale}/maven`;
  return {
    title: t.maven.title,
    description: t.maven.subtitle,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALE_CODES.map((c) => [c, `${SITE.url}/${c}/maven`])),
        'x-default': `${SITE.url}/en/maven`,
      },
    },
    openGraph: {
      title: t.maven.title,
      description: t.maven.subtitle,
      url,
      siteName: SITE.name,
      type: 'website',
    },
  };
}

export default async function MavenPage({ params, searchParams }) {
  const { locale } = await params;
  const sp = (await searchParams) || {};
  const t = getDict(locale);

  const initialStory = typeof sp.story === 'string' ? sp.story : '';
  const initialLat = typeof sp.lat === 'string' ? sp.lat : '';
  const initialLon = typeof sp.lon === 'string' ? sp.lon : '';

  return (
    <MavenWorkspace
      locale={locale}
      initialStory={initialStory}
      initialLat={initialLat}
      initialLon={initialLon}
      labels={t.maven}
    />
  );
}
