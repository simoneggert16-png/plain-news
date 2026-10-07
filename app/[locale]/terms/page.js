import Link from 'next/link';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return {
    title: locale === 'de' ? 'Nutzungsbedingungen (Terms of Service) | PLAIN.' : 'Terms of Service | PLAIN.',
    description: 'Terms of Service for PLAIN. News — The architecture of truth.',
  };
}

export default async function TermsPage({ params }) {
  const { locale } = await params;
  const isDe = locale === 'de';

  return (
    <div className="legal-page" style={{ maxWidth: 880, margin: '0 auto', padding: '40px 20px' }}>
      <h1 className="page-title" style={{ fontSize: 44, fontWeight: 900, marginBottom: 24 }}>
        {isDe ? 'Nutzungsbedingungen (Terms of Service)' : 'Terms of Service'}
      </h1>

      <p style={{ fontSize: 18, color: '#555', marginBottom: 40, lineHeight: 1.6 }}>
        {isDe
          ? 'Gültig ab: 7. Oktober 2026. Willkommen bei PLAIN. Durch den Zugriff auf unsere Website oder unsere autorisierten Schnittstellen stimmen Sie diesen Bedingungen zu.'
          : 'Effective date: 7 October 2026. Welcome to PLAIN. By accessing our platform, applications, or authorized services, you agree to these Terms of Service.'}
      </p>

      <section className="art-section" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
          {isDe ? '1. Zweck & Dienstleistungsangebot' : '1. Purpose & Core Service'}
        </h2>
        <p style={{ lineHeight: 1.6 }}>
          {isDe
            ? 'PLAIN. ist ein unabhängiges Nachrichtenmedium mit Sitz in der Schweiz. Unser Ziel ist es, verifizierte Weltnachrichten frei von Spekulation, Framing, Werbung und Bezahlschranken bereitzustellen. Alle Inhalte basieren auf dem Two-Source-Rule-Prinzip und transparenten Quellenangaben.'
            : 'PLAIN. is an independent, non-commercial news organization based in Switzerland. Our mission is delivering verified global news stripped of editorial spin, sensationalism, paywalls, and advertisements. All reporting adheres to the Two-Source Rule and explicit primary attribution.'}
        </p>
      </section>

      <section className="art-section" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
          {isDe ? '2. Urheberrecht & Zitate' : '2. Intellectual Property & Fair Quotation'}
        </h2>
        <p style={{ lineHeight: 1.6 }}>
          {isDe
            ? 'Alle von PLAIN. synthetisierten Zusammenfassungen, Analysen und grafischen Aufbereitungen sind urheberrechtlich geschützt. Zitate und Auszüge aus Primärquellen unterliegen den gesetzlichen Zitatregeln (Art. 25 URG).'
            : 'Original analytical syntheses and editorial designs created by PLAIN. are protected under applicable copyright law. Primary source quotes and excerpts are published strictly under fair quotation doctrines with explicit attribution.'}
        </p>
      </section>

      <section className="art-section" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
          {isDe ? '3. Haftungsausschluss' : '3. Disclaimer of Warranties'}
        </h2>
        <p style={{ lineHeight: 1.6 }}>
          {isDe
            ? 'Obwohl wir modernste mehrstufige Prüfmechanismen einsetzen, wird der Dienst „wie besehen“ zur Verfügung gestellt. PLAIN. übernimmt keine Haftung für kurzfristige Unterbrechungen oder Übertragungsfehler von Drittagenturen.'
            : 'While our newsroom employs rigorous multi-stage verification protocols, services are provided "as is". PLAIN. disclaims all warranties regarding continuous uptime or third-party primary wire discrepancies.'}
        </p>
      </section>

      <section className="art-section" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
          {isDe ? '4. Anwendbares Recht & Gerichtsstand' : '4. Governing Law & Jurisdiction'}
        </h2>
        <p style={{ lineHeight: 1.6 }}>
          {isDe
            ? 'Es gilt das Recht der Schweizerischen Eidgenossenschaft. Gerichtsstand ist die Schweiz.'
            : 'These terms are governed by the laws of Switzerland. The place of jurisdiction is Switzerland.'}
        </p>
      </section>
    </div>
  );
}
