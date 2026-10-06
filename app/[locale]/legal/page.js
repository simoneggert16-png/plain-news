import Link from 'next/link';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return {
    title: locale === 'de' ? 'Impressum & Rechtliches | PLAIN.' : 'Legal Notice & Disclaimer | PLAIN.',
  };
}

export default async function LegalPage({ params }) {
  const { locale } = await params;
  const isDe = locale === 'de';

  return (
    <div className="legal-page">
      <h1 className="page-title">{isDe ? 'Impressum & Rechtliche Hinweise' : 'Legal Notice & Disclaimer'}</h1>

      <section className="art-section">
        <h2>{isDe ? '1. Angaben gemäß Schweizer Recht (Art. 3 UWG)' : '1. Information pursuant to Swiss Law'}</h2>
        <p>
          {isDe ? (
            <>
              <strong>Plattform:</strong> PLAIN. ([plain-news.ch](https://plain-news.ch))<br />
              <strong>Herausgeber & Initiator:</strong> Simon Eggert<br />
              <strong>Standort:</strong> Schweiz (CH)<br />
              <strong>Kontakt & Impressum:</strong> <a href="mailto:simoneggert16@gmail.com">simoneggert16@gmail.com</a><br />
              <strong>Charakter:</strong> Nicht-kommerzielles, unabhängiges Open-Source-Informationsprojekt.
            </>
          ) : (
            <>
              <strong>Platform:</strong> PLAIN. ([plain-news.ch](https://plain-news.ch))<br />
              <strong>Founder & Publisher:</strong> Simon Eggert<br />
              <strong>Location:</strong> Switzerland (CH)<br />
              <strong>Contact & Legal:</strong> <a href="mailto:simoneggert16@gmail.com">simoneggert16@gmail.com</a><br />
              <strong>Nature:</strong> Non-commercial, independent open-source information project.
            </>
          )}
        </p>
      </section>

      <section className="art-section">
        <h2>{isDe ? '2. Urheberrecht, Zitatfreiheit & Fair Use' : '2. Copyright & Fair Quotation'}</h2>
        <p>
          {isDe ? (
            <>
              PLAIN. aggregiert und analysiert öffentlich zugängliche Berichterstattung weltweiter Medienhäuser.
              Sämtliche zitierten Textpassagen, Schlagzeilen und Metadaten unterliegen der gesetzlichen Zitatfreiheit
              (Art. 25 Schweizer Urheberrechtsgesetz URG sowie Art. 5 Abs. 3 lit. d der EU-Richtlinie 2001/29/EG).
              Sie dienen ausschließlich dem Zweck der tagesaktuellen Information, der Quellenkritik und dem transparenten
              Vergleich redaktioneller Ausrichtungen. Alle Primärquellen sind mit vollem Namen und Direktlink zur
              Originalpublikation ausgewiesen.
            </>
          ) : (
            <>
              PLAIN. compiles and analyzes publicly accessible reports from international news outlets.
              All quoted text excerpts, headlines, and source references are published under statutory fair quotation
              principles (Art. 25 Swiss Copyright Act and international copyright conventions) exclusively for factual
              reporting, media analysis, and framing comparison. All primary outlets are explicitly credited and linked.
            </>
          )}
        </p>
      </section>

      <section className="art-section">
        <h2>{isDe ? '3. Notice and Takedown (Schutz von Rechteinhabern)' : '3. Notice and Takedown'}</h2>
        <p>
          {isDe ? (
            <>
              Sollten Sie als Medienunternehmen oder Urheber der Ansicht sein, dass eine Verlinkung, ein Zitat oder
              eine Quellenzuordnung Ihre Rechte verletzt, bitten wir um eine formlose Nachricht an{' '}
              <a href="mailto:simoneggert16@gmail.com">simoneggert16@gmail.com</a>. Beanstandete Inhalte werden nach
              Prüfung umgehend angepasst oder entfernt.
            </>
          ) : (
            <>
              If any publisher or rights holder believes that a citation, link, or media reference infringes upon
              their rights, please send an informal notice to{' '}
              <a href="mailto:simoneggert16@gmail.com">simoneggert16@gmail.com</a>. The content in question will be reviewed
              and modified or removed promptly.
            </>
          )}
        </p>
      </section>

      <section className="art-section">
        <h2>{isDe ? '4. Keine Anlageberatung (Finanzmarkt-Disclaimer)' : '4. Financial Markets Disclaimer'}</h2>
        <p>
          {isDe ? (
            <>
              Die auf PLAIN. dargestellten Marktindizes, Kurse, Wechselkurse und Tickerdaten dienen rein der
              allgemeinen wirtschaftlichen Information und Bildung. Sie stellen unter keinen Umständen eine Anlageberatung,
              Finanzanalyse oder Aufforderung zum Kauf/Verkauf von Wertpapieren dar (gemäß Art. 3 Schweizer FIDLEG).
            </>
          ) : (
            <>
              Market indices, stock quotes, and financial indicators displayed on PLAIN. are strictly for educational
              and general informative purposes. Under no circumstances do they constitute investment advice, financial
              recommendations, or solicitation to trade (Swiss FinSA Art. 3).
            </>
          )}
        </p>
      </section>

      <section className="art-section">
        <h2>{isDe ? '5. Datenschutz & Null-Tracking (nDSG / DSGVO)' : '5. Privacy & Zero Tracking'}</h2>
        <p>
          {isDe ? (
            <>
              PLAIN. respektiert die Privatsphäre bedingungslos (gemäß Schweizer Datenschutzgesetz nDSG und DSGVO).
              Es werden keine Werbetracker, keine Analyse-Tools von Drittanbietern und keine Fingerprinting-Skripte eingesetzt.
              Cookies werden ausschließlich technisch notwendig verwendet, um Benutzereinstellungen (Sprachauswahl,
              Themenfilter) zu speichern. Es findet keinerlei Weitergabe oder Verkauf von Daten an Dritte statt.
            </>
          ) : (
            <>
              PLAIN. respects privacy unconditionally (in full compliance with Swiss nDSG and GDPR).
              No advertising trackers, no third-party analytics, and no fingerprinting scripts are deployed.
              Cookies are used strictly for necessary functionality (language selection, topic preferences).
              No data is ever monetized or sold to third parties.
            </>
          )}
        </p>
      </section>
    </div>
  );
}
