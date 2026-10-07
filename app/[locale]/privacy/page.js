import Link from 'next/link';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return {
    title: locale === 'de' ? 'Datenschutzerklärung | PLAIN.' : 'Privacy Policy | PLAIN.',
    description: 'Privacy Policy for PLAIN. News — Zero tracking, zero ads, zero data monetization.',
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
          ? 'Letzte Aktualisierung: 7. Oktober 2026. PLAIN. ist eine gemeinnützige, radikal transparente Nachrichtenplattform. Unsere Grundregel lautet: Wir sammeln, verkaufen und monetarisieren keinerlei persönliche Nutzerdaten.'
          : 'Last updated: 7 October 2026. PLAIN. is a non-commercial, radically transparent news platform. Our founding principle is simple: We do not track, collect, monetize, or sell personal user data.'}
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
            ? 'Beim Zugriff auf die Website speichern unsere Server lediglich minimale, technisch notwendige Verbindungsdaten (wie anonymisierte IP-Adressen zur Abwehr von Denial-of-Service-Angriffen). Diese Logs werden nach 7 Tagen automatisch gelöscht.'
            : 'When accessing the website, our infrastructure only retains minimal technical access logs (e.g., anonymized IP addresses for DDoS mitigation) which are automatically purged after 7 days.'}
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
