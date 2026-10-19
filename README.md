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

---

##  Deployment & Automatisierung

### 1. Hosting (Vercel / Next.js)
Das Portal ist für **Vercel** optimiert:
- **Kein Sleep/Inaktivität**: Im Gegensatz zum Render-Free-Tier schläft Vercel nie ein.
- **Global Edge & Static Generation**: Extrem schnelle Ladezeiten weltweit.
- **Git-basiert**: Jedes Mal, wenn die Bots neuen Content pushen, aktualisiert sich die Seite automatisch ohne Downtime.

### 2. Autonome Bots via GitHub Actions
In `.github/workflows/` sind drei Workflows hinterlegt:
- `newsroom.yml`: Läuft **stündlich** (`cron: '17 * * * *'`) und hat keine feste Obergrenze pro Kategorie, pro Lauf oder pro Tag. Wie viele Artikel tatsächlich erscheinen, hängt von aktuellen, ausreichend belegten Meldungen und dem Laufzeitbudget ab. Community-Beiträge sind davon ausgenommen.
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
| `/news-sitemap.xml` | Google-News-Sitemap mit Artikeln der letzten 48 Stunden. |
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

# Wartungs-Bot manuell ausführen
node --env-file=.env bots/maintenance.mjs

# KI-/Crawler-Sichtbarkeit der Production-Domain prüfen
npm run check:ai
```
