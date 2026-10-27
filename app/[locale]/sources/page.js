import Link from 'next/link';
import { LOCALES, LOCALE_CODES, SITE } from '@/lib/config.mjs';
import { getDict, fmt } from '@/lib/i18n.mjs';
import { FEEDS } from '@/bots/sources.mjs';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALE_CODES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const pageUrl = `${SITE.url}/${locale}/sources`;
  return {
    title: t.sourcesPage.title,
    description: t.sourcesPage.intro,
    alternates: {
      canonical: pageUrl,
      languages: {
        ...Object.fromEntries(LOCALE_CODES.map((c) => [c, `${SITE.url}/${c}/sources`])),
        'x-default': `${SITE.url}/en/sources`,
      },
    },
    openGraph: {
      title: `${t.sourcesPage.title} — ${SITE.name}`,
      description: t.sourcesPage.intro,
      url: pageUrl,
      siteName: SITE.name,
      type: 'website',
    },
  };
}

/* Curated by hand and kept short on purpose: only what the desk actually opens.
   Notes are EN/DE; other locales fall back to English. */
const PRIMARY = [
  ['Elections', [
    ['Bundeswahlleiterin', 'https://www.bundeswahlleiterin.de', 'Official German federal election results, precinct by precinct.', 'Amtliche Ergebnisse der deutschen Bundestagswahl, Wahlbezirk für Wahlbezirk.'],
    ['Swiss Federal Chancellery', 'https://www.bk.admin.ch', 'Every Swiss referendum and initiative result, going back decades.', 'Alle Resultate von Abstimmungen und Initiativen in der Schweiz, seit Jahrzehnten.'],
    ['UK Electoral Commission', 'https://www.electoralcommission.org.uk', 'Regulator of UK elections, donors and campaign spending.', 'Aufsicht über Wahlen, Spender und Wahlkampfausgaben in Grossbritannien.'],
    ['US Federal Election Commission', 'https://www.fec.gov', 'Campaign finance filings for every US federal candidate.', 'Offenlegungen zur Wahlkampffinanzierung aller US-Bundesmandate.'],
    ['Knesset', 'https://main.knesset.gov.il/EN', 'Israeli parliament: bills, votes, committee records.', 'Israelisches Parlament: Gesetze, Abstimmungen, Ausschussprotokolle.'],
  ]],
  ['Statistics', [
    ['Eurostat', 'https://ec.europa.eu/eurostat', 'The EU statistical office: inflation, unemployment, migration.', 'Statistikamt der EU: Inflation, Arbeitslosigkeit, Migration.'],
    ['Destatis', 'https://www.destatis.de/EN', 'German federal statistics, including the GDP and price series.', 'Statistik des Bundes: BIP, Preise, Bevölkerung.'],
    ['Federal Statistical Office (CH)', 'https://www.bfs.admin.ch', 'Swiss numbers: population, prices, wages, canton-level data.', 'Schweizer Zahlen: Bevölkerung, Preise, Löhne, Kantonsdaten.'],
    ['ONS', 'https://www.ons.gov.uk', 'UK statistics authority, with open datasets behind every release.', 'Statistikbehörde Grossbritanniens, mit offenen Datensätzen.'],
    ['US Census Bureau', 'https://www.census.gov', 'Population, households, trade and the American Community Survey.', 'Bevölkerung, Haushalte, Handel und Community Survey der USA.'],
    ['BLS', 'https://www.bls.gov', 'US labour market, wages and the monthly CPI release.', 'US-Arbeitsmarkt, Löhne und die monatlichen Inflationszahlen.'],
    ['World Bank Data', 'https://data.worldbank.org', 'Long-run development indicators for every country.', 'Langfristige Entwicklungsindikatoren für alle Länder.'],
    ['IMF Data', 'https://www.imf.org/en/Data', 'Macro forecasts, fiscal and balance-of-payments data.', 'Konjunkturprognosen, Fiskal- und Zahlungsbilanzdaten.'],
    ['OECD Data', 'https://data.oecd.org', 'Comparable indicators across 38 industrialised economies.', 'Vergleichbare Indikatoren aus 38 Industriestaaten.'],
    ['Our World in Data', 'https://ourworldindata.org', 'Every chart sourced and downloadable. Our first stop for long series.', 'Jede Grafik mit Quelle und Download. Erster Griff für lange Reihen.'],
  ]],
  ['Central banks & money', [
    ['European Central Bank', 'https://www.ecb.europa.eu', 'Rate decisions, statements, and the euro area balance sheet.', 'Zinsentscheide, Statements und Bilanz des Euroraums.'],
    ['Federal Reserve', 'https://www.federalreserve.gov', 'FOMC statements and minutes, published verbatim.', 'FOMC-Statements und Protokolle im Wortlaut.'],
    ['Swiss National Bank', 'https://www.snb.ch', 'Swiss monetary policy, reserves and FX interventions.', 'Geldpolitik, Reserven und Deviseninterventionen der Schweiz.'],
    ['FRED', 'https://fred.stlouisfed.org', '800,000+ economic series, charted and exportable.', 'Über 800.000 Wirtschaftsreihen, als Grafik und zum Export.'],
  ]],
  ['Conflict & humanitarian', [
    ['ReliefWeb (OCHA)', 'https://reliefweb.int', 'UN humanitarian reports as they are filed, per crisis.', 'Humanitäre Lageberichte der UN, pro Krise, im Original.'],
    ['ACLED', 'https://acleddata.com', 'Event-level conflict data, counted rather than described.', 'Konfliktdaten auf Ereignisebene, gezählt statt beschrieben.'],
    ['UNHCR', 'https://www.unhcr.org/refugee-statistics', 'Refugee and displacement figures, updated twice a year.', 'Flüchtlings- und Vertreibungszahlen, zweimal jährlich aktualisiert.'],
    ['IAEA', 'https://www.iaea.org', 'Nuclear safeguards, inspections and reactor status.', 'Nukleare Safeguards, Inspektionen und Reaktorstatus.'],
    ['WHO', 'https://www.who.int', 'Outbreak notices and global health statistics.', 'Ausbruchsmeldungen und globale Gesundheitsstatistik.'],
  ]],
  ['Science & climate', [
    ['NASA', 'https://www.nasa.gov', 'Mission data, imagery and the Goddard climate record.', 'Missionsdaten, Bilder und der Klimadatensatz von Goddard.'],
    ['ESA', 'https://www.esa.int', 'European space missions, launches and earth observation.', 'Europäische Raumfahrt, Starts und Erdbeobachtung.'],
    ['Copernicus', 'https://climate.copernicus.eu', 'The EU climate service: monthly temperature and ice records.', 'Klimadienst der EU: Monatsdaten zu Temperatur und Eis.'],
    ['IPCC', 'https://www.ipcc.ch', 'The assessment reports themselves, not the summaries of them.', 'Die Sachstandsberichte selbst, nicht Zusammenfassungen davon.'],
    ['PubMed', 'https://pubmed.ncbi.nlm.nih.gov', 'Every paper we cite for a health or science claim.', 'Jede Studie, die wir für Gesundheits- und Wissenschaftsthemen zitieren.'],
  ]],
  ['Law & transparency', [
    ['CourtListener', 'https://www.courtlistener.com', 'US court dockets and opinions, searchable and free.', 'US-Gerichtsakten und Urteile, durchsuchbar und kostenlos.'],
    ['CURIA', 'https://curia.europa.eu', 'Court of Justice of the European Union, full judgments.', 'Urteile des Europäischen Gerichtshofs im Volltext.'],
    ['SEC EDGAR', 'https://www.sec.gov/edgar/search', 'Company filings, unedited, as filed.', 'Unternehmensberichte im Original, ungekürzt.'],
    ['Zefix', 'https://www.zefix.ch', 'Swiss commercial register: who is behind a company.', 'Schweizer Handelsregister: wer hinter einer Firma steht.'],
    ['OCCRP Aleph', 'https://aleph.occrp.org', 'Leaked and public records from cross-border investigations.', 'Geleakte und öffentliche Akten aus Grenzüberschreitungs-Recherchen.'],
  ]],
];

const TOOLS = [
  ['Verify & fact-check', [
    ['Google Fact Check Explorer', 'https://toolbox.google.com/factcheck/explorer', 'Search claims that fact-checkers already rated.', 'Durchsucht Aussagen, die Faktenchecker bereits geprüft haben.'],
    ['AFP Fact Check', 'https://factcheck.afp.com', 'Fast, multilingual debunks from the wire agency itself.', 'Schnelle, mehrsprachige Richtigstellungen der Agentur selbst.'],
    ['AP Fact Check', 'https://apnews.com/hub/ap-fact-check', 'US-focused checks with the underlying documents.', 'US-Faktenchecks mit den zugrunde liegenden Dokumenten.'],
    ['Full Fact', 'https://fullfact.org', 'British charity, method transparent down to the spreadsheet.', 'Britische Organisation, Methode bis zur Tabelle offengelegt.'],
    ['CORRECTIV', 'https://correctiv.org', 'German investigative newsroom, open about its methods.', 'Deutsches Recherchebüro, offen über seine Methoden.'],
    ['Bellingcat', 'https://www.bellingcat.com', 'Open-source verification, with the exact steps shown.', 'Open-Source-Verifikation, mit den einzelnen Schritten.'],
  ]],
  ['Read across the spectrum', [
    ['Google News', 'https://news.google.com', 'How we find the second outlet for a story.', 'So finden wir die zweite Quelle für eine Geschichte.'],
    ['Ground News', 'https://ground.news', 'Shows which side of the spectrum is covering a story.', 'Zeigt, welche Seite des Spektrums über ein Thema berichtet.'],
    ['AllSides', 'https://www.allsides.com', 'Left-centre-right placement of US outlets, plus blindspot lists.', 'Einordnung von US-Medien links–Mitte–rechts, inklusive Blindspots.'],
    ['Media Bias/Fact Check', 'https://mediabiasfactcheck.com', 'Second opinion on an outlet we do not know yet.', 'Zweite Meinung zu einem Medium, das wir noch nicht kennen.'],
    ['GDELT', 'https://www.gdeltproject.org', 'Global news event database, queryable by theme and country.', 'Globale Ereignisdatenbank, abfragbar nach Thema und Land.'],
    ['Media Cloud', 'https://www.mediacloud.org', 'Who covered what, and who did not — measurable.', 'Wer worüber berichtet hat — und wer nicht. Messbar.'],
  ]],
  ['Archive & trace', [
    ['Wayback Machine', 'https://web.archive.org', 'Every source we cite is archived in case it changes.', 'Jede Quelle wird archiviert, falls sie sich ändert.'],
    ['archive.today', 'https://archive.ph', 'Second archive, for pages Wayback misses.', 'Zweites Archiv für Seiten, die Wayback nicht erfasst.'],
    ['Wikidata Query Service', 'https://query.wikidata.org', 'Structured facts about people, offices and organisations.', 'Strukturierte Fakten zu Personen, Ämtern und Organisationen.'],
  ]],
  ['Data & companies', [
    ['Pew Research Center', 'https://www.pewresearch.org', 'Survey data with methodology and question wording attached.', 'Umfragedaten mit Methodik und exaktem Wortlaut der Fragen.'],
    ['Gallup', 'https://news.gallup.com', 'Long-running opinion series, some back to the 1930s.', 'Lange Meinungsreihen, teils bis in die 1930er.'],
    ['Trading Economics', 'https://tradingeconomics.com', 'Fast overview of indicators when a release breaks.', 'Schneller Überblick über Indikatoren, wenn Zahlen kommen.'],
    ['Companies House', 'https://find-and-update.company-information.service.gov.uk', 'UK company ownership and accounts.', 'Eigentümer und Abschlüsse britischer Firmen.'],
    ['Handelsregister', 'https://www.handelsregister.de', 'German company register, free and official.', 'Deutsches Handelsregister, kostenlos und amtlich.'],
    ['Statista', 'https://www.statista.com', 'Only to find the original source behind a chart. Never cited itself.', 'Nur um die Originalsquelle einer Grafik zu finden. Nie selbst zitiert.'],
  ]],
];

const pickNote = (note, locale) => (typeof note === 'string' ? note : note[locale] || note.en);

/* Mirrors the chains in bots/lib/llm.mjs — first entry is what runs by default.
   Kept as plain data here so the page does not pull the LLM client into the build. */
const ROLES = [
  ['desk', 'openai/gpt-oss-20b', 'Clusters the radar into candidate events.', 'Bündelt das Radar zu Kandidaten-Ereignissen.'],
  ['writer', 'openai/gpt-oss-20b', 'Writes the first draft from the sources.', 'Schreibt den ersten Entwurf aus den Quellen.'],
  ['editor', 'openai/gpt-oss-20b', 'Checks every sentence against those sources.', 'Prüft jeden Satz gegen dieselben Quellen.'],
  ['translator', 'openai/gpt-oss-20b', 'Translates into nine languages.', 'Übersetzt in neun Sprachen.'],
  ['live', 'nvidia/nemotron-3-super-120b-a12b', 'Runs the tickers and the live numbers.', 'Betreibt Ticker und Live-Zahlen.'],
];

/* Fallback chain, in the order the bots walk it when a model is unavailable. */
const FALLBACKS = [
  'nvidia/nemotron-3-super-120b-a12b',
  'google/gemma-4-31b-it',
  'nvidia/nemotron-3-ultra-550b-a55b',
];

function Group({ title, note, children }) {
  return (
    <section className="src-group">
      <h2 className="src-group-title">{title}</h2>
      {note && <p className="src-group-note">{note}</p>}
      {children}
    </section>
  );
}

function LinkList({ items, locale }) {
  return (
    <ul className="src-list">
      {items.map(([name, url, en, de]) => (
        <li key={url} className="src-item">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <span className="src-name">{name}</span>
            <span className="src-arrow" aria-hidden="true">↗</span>
          </a>
          <p className="src-desc">{pickNote({ en, de }, locale)}</p>
        </li>
      ))}
    </ul>
  );
}

export default async function SourcesPage({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const sp = t.sourcesPage;

  // The radar: every outlet our scout bots poll, minus the aggregator queries.
  const outlets = [...new Set(FEEDS.filter((f) => !f.kind).map((f) => f.outlet))].sort((a, b) =>
    a.localeCompare(b, 'en', { sensitivity: 'base' })
  );
  const radarQueries = FEEDS.filter((f) => f.kind === 'aggregator').length;

  // Which model does what — straight from the code, not from a press release.
  const roles = ROLES;

  return (
    <>
      <header className="src-head">
        <p className="lr-kicker">{sp.kicker}</p>
        <h1 className="page-title">{sp.title}</h1>
        <p className="lr-intro">{sp.intro}</p>
      </header>

      <Group title={sp.feeds} note={fmt(sp.feedsNote, { n: outlets.length })}>
        <ul className="src-chips">
          {outlets.map((o) => <li key={o} className="src-chip">{o}</li>)}
        </ul>
        <p className="src-foot">
          {radarQueries} {locale === 'de' ? 'Google-News-Radar-Abfragen' : 'Google News radar queries'}
          {' · '}
          {fmt(sp.count, { n: outlets.length + radarQueries })}
        </p>
      </Group>

      <Group title={sp.primary} note={sp.primaryNote}>
        {PRIMARY.map(([groupName, items]) => (
          <div className="src-sub" key={groupName}>
            <h3 className="src-sub-title">{groupName}</h3>
            <LinkList items={items} locale={locale} />
          </div>
        ))}
      </Group>

      <Group title={sp.tools} note={sp.toolsNote}>
        {TOOLS.map(([groupName, items]) => (
          <div className="src-sub" key={groupName}>
            <h3 className="src-sub-title">{groupName}</h3>
            <LinkList items={items} locale={locale} />
          </div>
        ))}
      </Group>

      <Group title={sp.models} note={sp.modelsNote}>
        <ul className="src-models">
          {roles.map(([role, model, en, de]) => (
            <li key={role}>
              <span className="src-role">{role}</span>
              <code className="src-model">{model}</code>
              <span className="src-role-desc">{pickNote({ en, de }, locale)}</span>
            </li>
          ))}
        </ul>
        <p className="src-foot">
          {locale === 'de' ? 'Ausweichkette' : 'Fallback chain'}: {FALLBACKS.join(' → ')}
        </p>
      </Group>

      <p className="src-foot src-foot-end">
        <Link href={`/${locale}`}>{SITE.name}</Link>
        {' · '}
        <Link href={`/${locale}/longreads`}>{t.longreads.nav}</Link>
        {' · '}
        <Link href={`/${locale}/live`}>{t.live.nav}</Link>
        {' · '}
        <a href="mailto:simoneggert16@gmail.com">
          {locale === 'de' ? 'Quelle vorschlagen' : 'Suggest a source'}
        </a>
      </p>
    </>
  );
}
