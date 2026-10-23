import { SITE, LOCALES } from '@/lib/config.mjs';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return {
    title: locale === 'de' ? 'Datenschutzerklärung | PLAIN.' : 'Privacy Policy | PLAIN.',
    description: 'Privacy Policy for PLAIN. News — no ads, no third-party tracking, no data monetization.',
    alternates: {
      canonical: `${SITE.url}/${locale}/privacy`,
      languages: Object.fromEntries(LOCALES.map((l) => [l.code, `${SITE.url}/${l.code}/privacy`])),
    },
  };
}

export default async function PrivacyPage({ params }) {
  const { locale } = await params;
  const isDe = locale === 'de';

  return (
    <div className="legal-page" style={{ maxWidth: 880, margin: '0 auto', padding: '40px 20px' }}>
      <h1 className="page-title" style={{ fontSize: 44, fontWeight: 900, marginBottom: 24 }}>
        {isDe ? 'Datenschutzerklärung' : 'Privacy Policy'}
      </h1>

      <p style={{ fontSize: 18, color: '#555', marginBottom: 40, lineHeight: 1.6 }}>
        {isDe
          ? 'Letzte Aktualisierung: 23. Oktober 2026. PLAIN. ist eine gemeinnützige, radikal transparente Nachrichtenplattform. Wir verkaufen und monetarisieren keine Nutzerdaten, setzen keine Werbe- oder Drittanbieter-Tracker ein und erstellen keine Profile. Für die eigene Reichweitenmessung verarbeitet der Betreiber technische Zugriffsdaten (Details in Abschnitt 4).'
          : 'Last updated: 23 October 2026. PLAIN. is a non-commercial, radically transparent news platform. We do not sell or monetize user data, run no advertising or third-party trackers, and build no profiles. For our own audience measurement the operator processes technical access data (details in section 4).'}
      </p>

      <section className="art-section" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
          {isDe ? '1. Verantwortliche Stelle' : '1. Data Controller'}
        </h2>
        <p style={{ lineHeight: 1.6 }}>
          {isDe ? (
            <>
              <strong>Plattform:</strong> PLAIN. (plain-news.ch)<br />
              <strong>Betreiber & Gründer:</strong> Simon Eggert<br />
              <strong>Standort:</strong> Schweiz (CH)<br />
              <strong>Kontakt:</strong> <a href="mailto:simoneggert16@gmail.com">simoneggert16@gmail.com</a>
            </>
          ) : (
            <>
              <strong>Platform:</strong> PLAIN. (plain-news.ch)<br />
              <strong>Publisher & Founder:</strong> Simon Eggert<br />
              <strong>Location:</strong> Switzerland (CH)<br />
              <strong>Contact:</strong> <a href="mailto:simoneggert16@gmail.com">simoneggert16@gmail.com</a>
            </>
          )}
        </p>
      </section>

      <section className="art-section" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
          {isDe ? '2. Keine Tracking-Cookies & keine Werbenetzwerke' : '2. Zero Tracking Cookies & Zero Ad Networks'}
        </h2>
        <p style={{ lineHeight: 1.6 }}>
          {isDe
            ? 'PLAIN. verwendet keinerlei Tracking-Pixel, Werbe-IDs (IDFA/GAID), Google Analytics, Meta-Pixel oder kommerzielle Drittanbieter-Skripte. Es werden keine Nutzerprofile für verhaltensbasierte Werbung erstellt.'
            : 'PLAIN. employs zero tracking pixels, advertising identifiers, Google Analytics, Meta pixels, or third-party behavioral trackers. We do not profile users for commercial targeting.'}
        </p>
      </section>

      <section className="art-section" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
          {isDe ? '3. Drittanbieter-Integrationen (TikTok, Meta, Google)' : '3. Social Platforms & API Integrations'}
        </h2>
        <p style={{ lineHeight: 1.6 }}>
          {isDe
            ? 'Wenn Sie mit unseren Inhalten auf Drittplattformen (wie TikTok, Instagram, Facebook oder YouTube) interagieren, unterliegt diese Nutzung den Datenschutzrichtlinien der jeweiligen Plattformbetreiber. Bei der Nutzung von API-Schnittstellen zur Inhaltsverteilung werden ausschließlich von Entwicklern autorisierte API-Tokens verwendet; es werden keine personenbezogenen Daten von Endnutzern an Dritte übertragen.'
            : 'When interacting with our content on third-party networks (such as TikTok, Instagram, Facebook, or YouTube), data processing is governed by the respective platform policies. Automated publishing integrations only utilize developer-authorized API credentials; no personal end-user data is collected or transmitted.'}
        </p>
      </section>

      <section className="art-section" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
          {isDe ? '4. Server-Logs & Sicherheit' : '4. Server Logs & Infrastructure'}
        </h2>
        <p style={{ lineHeight: 1.6 }}>
          {isDe
            ? 'Beim Zugriff auf die Website speichert unsere Infrastruktur technisch notwendige Verbindungsdaten. Für die Reichweitenmessung erfassen wir zusätzlich: IP-Adresse, Land und Region (aus den von Vercel übermittelten Geo-Headern), aufgerufener Pfad, Referrer und User-Agent. Die IP-Adresse wird zusätzlich mit einem Salt gehasht; die Roh-IP wird nach spätestens 90 Tagen gelöscht. Rechtsgrundlage ist unser berechtigtes Interesse an der Sicherheit und der Messung der Reichweite unseres nicht-kommerziellen Angebots (Art. 31 DSG bzw. Art. 6 Abs. 1 lit. f DSGVO). Es findet kein Profiling, keine Weitergabe an Werbenetzwerke und kein Cross-Site-Tracking statt. Die Auswertung ist ausschliesslich intern zugänglich.'
            : 'When you access the website, our infrastructure retains technically necessary connection data. For audience measurement we additionally record: IP address, country and region (from the geo headers provided by Vercel), requested path, referrer and user agent. The IP address is also hashed with a salt; raw IPs are deleted after 90 days at the latest. The legal basis is our legitimate interest in the security and reach measurement of this non-commercial offering (Art. 31 FADP / Art. 6(1)(f) GDPR). There is no profiling, no sharing with ad networks and no cross-site tracking. The evaluation is accessible internally only.'}
        </p>
      </section>

      <section className="art-section" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
          {isDe ? '5. Ihre Rechte' : '5. Your Rights'}
        </h2>
        <p style={{ lineHeight: 1.6 }}>
          {isDe
            ? 'Gemäß Schweizer Datenschutzgesetz (DSG) sowie der DSGVO haben Sie jederzeit das Recht auf Auskunft, Berichtigung oder Löschung Ihrer Daten. Kontaktieren Sie uns jederzeit unter simoneggert16@gmail.com.'
            : 'Under Swiss Federal Data Protection Act (FADP) and GDPR, you have the right to access, rectify, or request deletion of any personal data. Contact us directly at simoneggert16@gmail.com.'}
        </p>
      </section>
    </div>
  );
}
