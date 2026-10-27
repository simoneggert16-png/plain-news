# PLAIN. — Unbiased, Minimalist News Portal

Ein schnelles, völlig werbe- und abofreies Nachrichtenportal mit kantigem, ästhetischem Beige/Schwarz-Design, automatischer multi-agenten KI-Redaktion und Live-Börsenkursen.

---

##  Prinzipien & Philosophie

1. **Unbiased & Faktenbasiert**: Kein Framing, keine emotionalen Clickbait-Verben (*"slammed"*, *"chaos"*, *"bombshell"*).
2. **Mindestens zwei unabhängige Quellen**: Eine Meldung wird nur publiziert, wenn mindestens 2 verschiedene Medien unabhängig voneinander darüber berichten.
3. **Framing-Transparenz**: Unter jedem Artikel wird aufgelistet, welche Medien mit welchem Original-Titel über das Ereignis berichtet haben.
4. **100% Kostenlos**: Keine Werbung, keine Bezahlschranken, keine Abonnements, kein Tracking.
5. **Mehrsprachig**: Vollständige Unterstützung für 9 Sprachen (**EN, DE, FR, ES, IT, PT, ZH, JA, KO**) mit automatischer Lokalisierung.
6. **Live-Märkte**: Echtzeit-Kurse und historische Charts für Indizes, Aktien, Devisen, Rohstoffe und Krypto via freier Yahoo-Finance API.

---

##  KI-Redaktionsarchitektur (`bots/`)

Das System nutzt NVIDIA NIM APIs (u.a. `nvidia/nemotron-3-super-120b`, `openai/gpt-oss-20b`, `nvidia/nemotron-3.5-lightning`) in einer mehrstufigen Pipeline:

```
[50+ RSS-Feeds] 
       │
       ▼
1. SCOUT       ── Fetcht weltweite Feeds (Reuters, BBC, FAZ, Le Monde, SCMP, etc.)
       │
       ▼
2. DESK        ── Clustert Headlines zu Events, filtert nach Relevanz & Mehrquellen-Pflicht (≥2 Quellen)
       │
       ▼
3. REPORTER    ── Extrahiert Volltexte, verfasst neutralen Faktencheck-Artikel
       │
       ▼
4. EDITOR      ── Separater LLM-Reviewer prüft Artikel streng gegen Quellen & Anti-Slop-Richtlinie
       │
       ▼
5. TRANSLATOR  ── Übersetzt den finalen Artikel in alle 9 Sprachen
       │
       ▼
6. PUBLISH     ── Speichert JSON unter content/articles/ und aktualisiert content/index.json
```

Zusätzlich läuft ein **Wartungs-Bot** (`bots/maintenance.mjs`), der kaputte Artikel aussortiert, Duplikate bereinigt, veraltete News nach 45 Tagen archiviert und unvollständige Übersetzungen heilt.

### Live-Ticker (`bots/live.mjs`)

Ein Liveticker gehört zu **einem** laufenden Ereignis (Wahlnacht, Krieg, Katastrophe, Gerichtsverfahren) und sammelt chronologisch bestätigte Meldungen. Er läuft alle 10 Minuten, solange er offen ist:

```
1. RADAR      Feeds holen und Schlagzeilen gegen laufende Ticker matchen
2. DETECT     Ticker automatisch öffnen, wenn ein Watchlist-Ereignis breit belegt ist
3. WRITE      Meldungen zu Fakten bündeln (ein LLM-Call pro Ticker)
4. GATE       Jedes Update braucht ≥2 unabhängige Medien – als Code-Gate, nicht als Prompt
5. TRANSLATE  Neue Zeilen in alle 9 Sprachen übersetzen (gebündelt pro Sprache)
6. ARTICLE    Laufenden Artikel (EN+DE) neu schreiben, alte Fassung als Version behalten
7. SAVE       Supabase (live, ohne Redeploy) + content/live/*.json (Archiv)
```

- **Quelle zur Laufzeit ist Supabase** (`supabase/live_schema.sql`): Aktualisierungen sind in Sekunden sichtbar, ohne Vercel-Deploy. `content/live/*.json` ist Archiv und Fallback.
- **Der verlinkte Artikel aktualisiert sich live**: Die Seite liefert die committete Fassung serverseitig aus, der Client pollt `/api/live/article/<slug>` und tauscht den Text. Frühere Fassungen bleiben unter „Frühere Versionen“ lesbar (max. 20).
- **Beenden**: Ohne bestätigte Updates über `LIVE_IDLE_END_HOURS` (Standard 12) schließt der Bot den Ticker automatisch (`--end <slug>` geht auch manuell). Beendete Ticker bleiben dauerhaft lesbar.
- **Live-Statistiken**: Für Zahlen gilt die Zwei-Quellen-Regel **nicht**. Ein Wert ist veröffentlicht oder nicht, deshalb genügt **eine vertrauenswürdige Quelle** (Statistikamt, Wahlkommission, Zentralbank, Agentur). Nicht vertrauenswürdige Einzelquellen werden im Code verworfen. Der Snapshot liegt in `ticker.stats` (+ `statsHistory`, max. 60), wird in den Artikel gespiegelt und im Frontend live nachgezogen (`LIVE_STATS=0` schaltet das Feature ab).

| Endpunkt / Route | Zweck |
|---|---|
| `/[locale]/live` | Übersicht: laufende und beendete Ticker |
| `/[locale]/live/<slug>` | Ticker selbst (`force-dynamic`, `LiveBlogPosting`-JSON-LD) |
| `/api/live` | Aktive Ticker für Banner und Übersicht |
| `/api/live/<slug>` | Voller Ticker für das Client-Polling |
| `/api/live/article/<slug>` | Neueste Artikel-Fassung + Versionshistorie |

Der Banner über dem Header ist pro Besucher schließbar (`localStorage`), über die Seite `/live` wieder einschaltbar und global per `NEXT_PUBLIC_LIVE_BANNER=0` abschaltbar.

### Reportagen & lange Texte (`bots/longform.mjs`)

Zwei bis drei große Stücke pro Tag – keine Meinung, sondern die Erklärung, für die im News-Takt sonst kein Platz ist:

```
1. RADAR      Feeds holen, Schlagzeilen zu Themen clustern (≥2 Medien)
2. PLAN       ein LLM-Call wählt die Themen, die 950+ Wörter hergeben
3. MATERIAL   Volltexte lesen + passende eigene Archivartikel als Hintergrund
4. WRITE      4–6 Abschnitte, danach ein strenger Editor-Durchgang
5. TRANSLATE  Übersetzung in EN, DE, FR, ES, IT, PT (andere Sprachen fallen auf EN zurück)
6. PUBLISH    form:"longform" → content/articles + index (mit readingMinutes)
```

- **Länge als Gate**: Unter `LONGFORM_MIN_WORDS` (Standard 950) wird nichts veröffentlicht; der Editor darf das Stück nicht zu einem Nachrichtenartikel kürzen.
- **Kein Füllmaterial**: Alles muss in den Quellen stehen. Was nicht belegt ist, fällt raus – lieber kein Long Read als ein erfundener.
- **Struktur**: `sections: [{ heading, paragraphs[] }]`; das flache `body` bleibt für RSS, `llms-full.txt` und Kompatibilität erhalten.
- **Seiten**: Übersicht `/[locale]/longreads`, Badge „Reportage“ und Lesezeit auf der Artikelseite, Band auf der Startseite.
- **Steuerung**: `LONGFORM_PER_RUN`, `LONGFORM_MIN_WORDS`, `LONGFORM_LOCALES`, `LONGFORM_DRY_RUN=1` (schreibt nichts). Zeitplan: `.github/workflows/longform.yml`, 3× täglich.

### Quellen & Werkzeuge (`/[locale]/sources`)

Die Seite zeigt, womit die Redaktion tatsächlich arbeitet: alle Medien aus `bots/sources.mjs` (plus die Google-News-Radar-Abfragen), kuratierte Primärquellen (Wahlkommissionen, Statistikämter, Zentralbanken, Gerichte), Recherche- und Verifikationswerkzeuge sowie die Modelle, die schreiben und prüfen. Die Liste ist bewusst kurz und wird von Hand gepflegt – nur was wirklich benutzt wird.


---

##  Deployment & Automatisierung

### 1. Hosting (Vercel / Next.js)
Das Portal ist für **Vercel** optimiert:
- **Kein Sleep/Inaktivität**: Im Gegensatz zum Render-Free-Tier schläft Vercel nie ein.
- **Global Edge & Static Generation**: Extrem schnelle Ladezeiten weltweit.
- **Git-basiert**: Jedes Mal, wenn die Bots neuen Content pushen, aktualisiert sich die Seite automatisch ohne Downtime.

### 2. Autonome Bots via GitHub Actions
In `.github/workflows/` sind vier Workflows hinterlegt:
- `newsroom.yml`: Läuft **stündlich** (`cron: '17 * * * *'`) und hat keine feste Obergrenze pro Kategorie, pro Lauf oder pro Tag. Wie viele Artikel tatsächlich erscheinen, hängt von aktuellen, ausreichend belegten Meldungen und dem Laufzeitbudget ab. Community-Beiträge sind davon ausgenommen.
- `live.yml`: Läuft **alle 10 Minuten** (`cron: '*/10 * * * *'`) und aktualisiert laufende Liveticker. Ohne offenen Ticker beendet er sich in Sekunden.
- `maintenance.yml`: Läuft täglich um 03:40 UTC für Cleanup und Re-Indexing.
- `newsletter.yml`: Sendet täglich um 06:15 UTC ein Briefing mit den wichtigsten neuen Artikeln an bestätigte Abonnenten.

**Einrichtung auf GitHub:**
1. Repository auf GitHub pushen.
2. In den Repository-Einstellungen unter `Settings -> Secrets and variables -> Actions` die Secrets hinterlegen:
   - `NVIDIA_API_KEY`: Dein NVIDIA NIM API Key
   - `OLLAMA_API_KEY`: Dein Ollama-Cloud-Key
3. Optional unter `Settings -> Secrets and variables -> Actions -> Variables` die Parallelität steuern:
   - `EVENT_CONCURRENCY` (Standard `4`)
   - `TRANSLATION_CONCURRENCY` (Standard `8`)

Wichtig: Der Bot priorisiert zuerst Kategorien, die im letzten Stundenfenster noch keine Meldung erhalten haben. Veröffentlicht wird weiterhin nur, wenn mindestens zwei unabhängige Medien oder eine zulässige Primärquelle die Meldung belegen; es werden keine Inhalte erfunden. Die Recherche bleibt durch Feeds und Laufzeitbudget begrenzt. Bei `MAX_STORIES_PER_RUN`, `MAX_PER_CATEGORY`, `TARGET_PER_CATEGORY_PER_CYCLE` und `MAX_ARTICLES_PER_DAY` bedeutet `0`: kein zahlenmäßiges Limit.

### 3. Kostenlose Anmeldung und täglicher Newsletter
Konten und E-Mail-Bestätigungen laufen über Supabase Auth; Newsletter-Adressen liegen in Supabase. Apple-Anmeldung ist entfernt. Google kann optional in Supabase OAuth aktiviert werden. Der Newsletter-Workflow läuft täglich um 06:15 UTC; Resends kostenlose Stufe hat Versandlimits.

1. Erstelle ein kostenloses Supabase-Projekt und führe `supabase/schema.sql` im SQL Editor aus.
2. In Supabase → Authentication → URL Configuration setze die Site URL auf `https://www.plain-news.ch` und erlaube `https://www.plain-news.ch/**` sowie `http://localhost:3000/**`. Aktiviere E-Mail-Bestätigung. Lege bei Bedarf in Supabase → Authentication → SMTP Settings Resend als SMTP-Anbieter fest.
3. Lege in Vercel `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` an. Der Service-Role-Key darf nur serverseitig verwendet werden.
4. Für Bestätigungs-/Reset-Mails und den täglichen Newsletter richte ein kostenloses Resend-Konto ein, verifiziere deine Absenderdomain und setze Resend-SMTP in Supabase. Hinterlege `RESEND_API_KEY` als GitHub Actions Secret und `RESEND_FROM_EMAIL` als Actions Variable.
5. Dieselben Supabase-URL- und Service-Role-Werte sowie `RESEND_API_KEY` und `RESEND_FROM_EMAIL` als GitHub Actions Secrets/Variable für den Workflow `Daily newsletter` hinterlegen. `NEWSLETTER_UNSUBSCRIBE_SECRET` kann ein eigener zufälliger Secret-Wert sein; ohne ihn wird der Service-Role-Key zum Signieren der Abmeldelinks genutzt.

Die Newsletter-Anmeldung wird nur mit gesetztem Opt-in und nach bestätigter E-Mail aktiviert. Jede Ausgabe enthält einen Abmeldelink. Für Google-OAuth muss zusätzlich der Google-Provider in Supabase eingerichtet und dort die Supabase-Callback-URL beim Google OAuth Client eingetragen werden.

---

##  Auffindbarkeit für Suchmaschinen & KI

PLAIN. liefert alle Inhalte als serverseitig gerendertes HTML. Es gibt keinen Login, keine Paywall und keine Bot-Challenge vor Artikeln. Zusätzlich sind folgende Endpunkte aktiv:

| Endpunkt | Zweck |
|---|---|
| `/robots.txt` | Erlaubt Such- und KI-Crawler explizit, u. a. `OAI-SearchBot`, `GPTBot`, `PerplexityBot`, `ClaudeBot`, `Googlebot`, `Bingbot`. |
| `/sitemap.xml` | Alle Sprachversionen, Kategorien und Artikel (max. 1000 Stories). |
| `/news-sitemap.xml` | Google-News-Sitemap-Index (max. 1.000 URLs pro Kind-Datei unter `/news-sitemap/<n>.xml`). |
| `/llms.txt` | Kurzer Leitfaden für LLM- und Retrieval-Agenten. |
| `/llms-full.txt` | Maschinenlesbarer Index der letzten 500 Artikel mit kanonischen URLs. |
| `/feed.xml` | RSS-2.0-Feed mit den letzten 100 Artikeln. |
| `/[locale]/about` | Betreiber, Redaktionsprozess, KI-Einsatz, Quellen- und Korrekturregeln. |

Jeder Artikel enthält `NewsArticle`-JSON-LD mit Headline, Dek, Artikeltext, Wortzahl, ISO-Timestamps, Sprache, Quellen (`isBasedOn` / `citation`) und Publisher-Referenz. Die Website-weite `NewsMediaOrganization`- und `WebSite`-Auszeichnung liegt im Layout.

**Wichtig für das Hosting:** `robots.txt` allein reicht nicht, wenn eine Firewall oder ein Bot-Schutz auf Vercel/Cloudflare die Anfragen blockiert. Prüfe im Hosting-Dashboard:
- Kein „Deployment Protection“ / Passwortschutz für die Produktionsdomain.
- Kein Bot-Firewall-Regelwerk, das `OAI-SearchBot`, `GPTBot`, `PerplexityBot` oder `ClaudeBot` blockiert.
- Für OpenAI zusätzlich die veröffentlichten IP-Bereiche zulassen, falls eine IP-Firewall aktiv ist.

Nach dem Deployment prüfen:

```bash
# Prüft robots, Sitemaps, llms.txt und eine echte Artikelseite mit OAI-SearchBot-UA
npm run check:ai

# Optional mit einem anderen Crawler
CHECK_UA=PerplexityBot/1.0 npm run check:ai
```

Zusätzlich lohnt sich die URL-Prüfung in der Google Search Console für eine konkrete Artikelseite. Ein garantierter „KI-Schalter“ existiert nicht; die Grundlagen sind Crawl-Zugriff, Indexierbarkeit, lesbarer Text, strukturierte Daten und transparente Quellen.

### Wenn Production hinterherhinkt

Wenn `npm run check:ai` bei einer frisch publizierten Artikelseite `404` meldet, liegt das meistens nicht an `robots.txt`, sondern an der Auslieferung:

1. **GitHub Actions → Newsroom**: Letzten Lauf prüfen. Sind `OLLAMA_API_KEY` und `NVIDIA_API_KEY` gesetzt? Wurde der Lauf grün?
2. **GitHub Actions → Maintenance**: Der Build-Schritt muss erfolgreich sein.
3. **Vercel → Deployments**: Der letzte Commit muss ein erfolgreiches Production-Deployment ausgelöst haben.
4. **Sitemap abgleichen**: Die neueste Artikel-URL aus `content/index.json` muss in `https://www.plain-news.ch/sitemap.xml` auftauchen. Wenn nicht, ist die Production-Deployment-ID veraltet.
5. **Hosting-Schutz**: Deployment Protection, Passwortschutz oder eine Bot-Firewall für die Production-Domain deaktivieren bzw. die genannten Crawler erlauben.

Erst wenn die Artikelseite in Production mit HTTP `200` und lesbarem HTML antwortet, können Such- und KI-Systeme sie zitieren.

---

##  Speicher & Deployment-Größe

Vercel Hobby hat 10 GB Deployment-Storage, und jede Version zählt mit. Deshalb gilt:

- **Artikelseiten sind ISR** (`revalidate = 3600`), nicht vorgerendert. Vorher wurden 776 Artikel × 9 Sprachen ≈ 7.000 HTML-Dateien pro Deployment gebaut (~700 MB und täglich ~85 MB mehr).
- **Medien bleiben im Repo, aber nicht im Deployment** (`.vercelignore`): `public/audio`, `public/footage*`, `social_content`, `remotion`, `scripts`. Das sind ~62 MB pro Version, die nur die Offline-Videoproduktion braucht.
- **Inhalte können aus Supabase kommen** statt aus dem Deployment. Einmalig `supabase/schema.sql` im SQL-Editor ausführen, danach spiegelt jeder Newsroom-Lauf die Artikel automatisch nach Supabase (`npm run content:sync`). Status prüfen:

```bash
npm run content:verify
curl https://www.plain-news.ch/api/content/status   # { source, articles, newest }
```

Wenn dort `source: supabase` mit vollständiger Artikelzahl steht, in `.vercelignore` die Zeile `content/` aktivieren – dann enthält kein Deployment mehr Artikel-JSON. Git bleibt die Quelle und Historie; die Website liest die aktuelle Fassung aus Supabase.

##  Lokale Entwicklung



```bash
# Abhängigkeiten installieren
npm install

# Lokalen Dev-Server starten (http://localhost:3000)
npm run dev

# Produktions-Build testen
npm run build

# Newsroom-Bot manuell ausführen
node --env-file=.env bots/newsroom.mjs

# Liveticker-Bot manuell ausführen (ohne Flags = normaler Lauf)
node --env-file=.env bots/live.mjs
node --env-file=.env bots/live.mjs --create "Title" --keywords "israel,knesset,wahl"

# Reportagen-Bot manuell ausführen (LONGFORM_DRY_RUN=1 schreibt nichts)
node --env-file=.env bots/longform.mjs

# Wartungs-Bot manuell ausführen
node --env-file=.env bots/maintenance.mjs

# KI-/Crawler-Sichtbarkeit der Production-Domain prüfen
npm run check:ai
```
