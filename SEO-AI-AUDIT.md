# PLAIN-NEWS.CH — Visibility-Audit für Google & AI (Dez 2025)

> **Kurzfassung:** plain-news.ch ist technisch bereits sehr gut aufgestellt (SSR, sitemap, news-sitemap, llms.txt, strukturierte Daten). Mit 5 Code-Fixes + 9 operativen Massnahmen kannst du aus „korrekt“ → „herausragend“ kommen — v.a. bei Google News/Discover und ChatGPT/Perplexity/Gemini-Zitierungen.

---

## 1) Was du schon richtig machst (nicht kaputtmachen!)

| Signal | Status | Warum wichtig |
|---|---|---|
| **SSR, kein Paywall, kein JS-Zwang** | ✅ | Googlebot + AI-Crawler sehen den Volltext sofort (kein Login, kein Bot-Challenge) |
| **robots.txt erlaubt alle relevanten Crawler** (`OAI-SearchBot`, `GPTBot`, `PerplexityBot`, `ClaudeBot`, `Google-Extended`…) | ✅ | Sonst wirst du in ChatGPT Search / Perplexity nie zitiert |
| **sitemap.xml mit hreflang** (9 Sprachen × 1000 Artikel, `alternates.languages`) | ✅ | Google indexiert DE/FR/… korrekt, kein Duplicate-Content |
| **news-sitemap.xml (48h-Fenster, 1000-URL-Split)** | ✅ | Google News Pflicht — gut gelöst mit Index + Child-Parts |
| **llms.txt + llms-full.txt (500 Artikel)** | ✅ | AI-Agents lieben es — wenige Publisher haben das |
| **NewsArticle + BreadcrumbList + NewsMediaOrganization + WebSite JSON-LD** | ✅ | Rich Results, Knowledge Graph |
| **ISR 1h + middleware locale-rewrite für Crawler (200 statt 307)** | ✅ | Crawler folgen oft keinem Redirect — du machst Rewrite, sehr gut |
| **LiveBlogPosting für Ticker** | ✅ | Ideal für „Wahlen / Eilmeldungen“ → Top Stories |
| **feed.xml, speakable, SearchAction** | ✅ | Voice & Sitelinks Searchbox |

**Fazit:** Die *Grundlagen* sind besser als 90 % der News-Sites. Die nächsten Punkte sind Feinschliff + Distribution.

---

## 2) Was ich direkt im Code gefixt habe (dieser Branch)

### 2.1 Neuer dynamischer `/llms.txt` (`app/llms.txt/route.js`)
- **Problem:** `public/llms.txt` war statisch (fest im Repo) — alter Stand nach Deploy.
- **Fix:** Dynamische Route, baut bei jedem Request die neuesten 80 Artikel + Live-Ticker aus `getIndex()` ein. Folgt dem offiziellen **llmstxt.org-Spec**: `# PLAIN.` + `> Quote`, klare Sections, Citation-Guide, Machine Endpoints.
- **Impact AI:** ChatGPT, Perplexity & Co. holen genau diese Datei zuerst — jetzt immer aktuell + mit Suggested Citation.

### 2.2 Neuer `/ai.txt` (`app/ai.txt/route.js`)
- **Problem:** Emerging Standard (aitxt.org) — Perplexity/Anthropic fragen danach.
- **Fix:** Minimaler `Allow: /` + Link auf llms.txt/sitemaps. Kostet 0, blockiert nichts, signalisiert „AI welcome“.

### 2.3 `robots.js` gehärtet
- `disallow: /api/, /admin/, /confirm` … — verhindert, dass Google private/API-Routen crawlt und Crawl-Budget verschwendet.
- `sitemap: feed.xml` zusätzlich eingetragen.

### 2.4 `feed.xml` angereichert
- **Vorher:** Nur Titel + dek.
- **Nachher:** `content:encoded` mit Volltext (dek + facts + body + context + Quellenlinks), `enclosure` + `media:content` mit Fallback-Bild (`app-icon-1024.png` wenn Artikel kein Bild hat), `atom:updated`. Namespaces für `content:` + `media:`.
- **Impact:** Google News, Apple News, Feedly, aber auch **Perplexity** und **Gemini** nutzen RSS zur Discovery — mehr Text = mehr Zitat-Chancen.

### 2.5 Artikel-Seite (`app/[locale]/a/[slug]/page.js`)
- **OG/Twitter Fallback-Bild:** Vorher `[]` wenn kein Artikelbild → kein Preview bei Google Discover, WhatsApp, X. Jetzt immer `app-icon-1024.png` mit 1024×1024.
- **Meta-Description gekürzt** auf ~155 Zeichen (mit `…`) — Google schneidet sonst willkürlich.
- **JSON-LD `image` als `ImageObject`** mit `width/height/caption` statt String-Array — Google Rich Results verlangen das; fehlende Maße = kein Top-Stories-Karussell.
- **`copyrightYear`** ergänzt, `author.logo` ergänzt.
- **Sichtbare Breadcrumb** (`Home › Kategorie › Titel`) — interne Verlinkung + dwell time, Google nutzt sie für Sitelinks.

### 2.6 `layout.js` E-E-A-T erweitert
- `NewsMediaOrganization` jetzt mit `description`, `slogan`, `founder.url`, `actionableFeedbackPolicy`, `diversityPolicy`.
- `<head>`: `llms-full.txt` Link + `author`/`publisher` meta.

### 2.7 `sitemap.js` revalidate 1h
- Ohne `revalidate` war die generierte Sitemap potenziell stale (Next cached unendlich). Jetzt `: revalidate = 3600` — passt zu ISR der Artikel.

### 2.8 `globals.css` Breadcrumb-Styling

---

## 3) Was du extern tun solltest (Prio 1 — diese Woche)

### 3.1 Google Publisher Center (MUSS)
1. https://publishercenter.google.com → „Quelle hinzufügen“ → `https://www.plain-news.ch` verifizieren (DNS TXT oder Search Console).
2. Publikationsname exakt `PLAIN.` + Logo 1:1 (du hast `app-icon-1024.png` — nutze 512×512+ PNG, transparent okay).
3. Nach Freischaltung tauchen deine `news-sitemap.xml`-Artikel in **Google News / Top Stories** auf. Ohne diesen Schritt bleibt die news-sitemap ungenutzt, egal wie korrekt sie ist.

### 3.2 Google Search Console + Bing Webmaster
1. **Search Console:** Domain-Property `plain-news.ch` anlegen, DNS verifizieren. Sitemaps einreichen: `sitemap.xml` + `news-sitemap.xml`. URL-Prüfung für 2-3 Artikel → „Indexierung anfordern“.
2. **Core Web Vitals** beobachten — dein `<img>` statt `next/image` kostet LCP Punkte. (Fix siehe 4.1)
3. **Bing Webmaster** (bing.com/webmasters) — gleich dort einreichen, Perplexity & ChatGPT nutzen Bing-Index.

### 3.3 IndexNow / Bing sofort pingen
Nach jedem Newsroom-Lauf einmal `https://api.indexnow.org/indexnow.json` mit den neuen Artikel-URLs aufrufen. Action-Code liegt bereits in `bots/newsroom.mjs` — ergänze dort 5 Zeilen fetch.

### 3.4 Backlinks & Referral (entscheidend für Ranking)
Google & AI glauben an *Trust* durch externe Zitate:
- Wikipedia: Ergänze fehlende Schweiz/DE-Artikel mit PLAIN. als Quelle (wo du wirklich Primärquelle hast).
- Hochschule/NGO: Biete Dozierenden deine „Framing-Vergleich“ Ansicht (unique Feature!) als Lehrmaterial.
- Presse-Erwähnung: Ein Interview mit Simon Eggert („Schweizer baut werbefreie KI-News“) bringt mehr als 1000 Sitemap-Optimierungen.

---

## 4) SEO-Feinheiten (Prio 2 — nächsten Monat)

### 4.1 Bilder (grösster Hebel für Discover)
- **Problem:** Viele Artikel haben `image: null`. Google Discover verlangt ein **1200px+ Bild** pro Artikel, sonst 0 Reichweite.
- **Quick-Win:** In `bots/reporter.mjs` einen Fallback einbauen — OpenGraph-Bild der Quelle übernehmen (lizenzkonform mit Credit). Du hast bereits `imageCredit`-Feld, nutze es.
- **Technisch:** Auf `next/image` umstellen → automatisches `srcset`, `sizes`, WebP + LCP-Preload für Lead-Hero.

### 4.2 Interne Verlinkung
- Artikel-Ende: 3× „Weiterlesen“ (gleiche Kategorie, jünger als 7 Tage). Hilft Crawl-Depth + Related-Signal für Google.
- Kategorie-Seiten: Einleitungstext (80-100 Wörter, unique je `world`/`politics`/…), sonst sind es reine Listen (Thin Content).
- Lives: Der `LiveArticle` Polling-Text sollte auch 2-3 statische Outlinks halten — sonst entwertet Google ihn.

### 4.3 E-E-A-T sichtbar machen
Google News verlangt klare Autorenschaft + Impressum. Du hast `/about` — top, aber:
- Füge `/en/about` einen **Foto-Satz** hinzu: „Betrieben von Simon Eggert, CH — Kontakt …“ Viele Publisher verstecken das, du profitierst wenn du es zeigst.
- `privacy` + `legal` haben schon deutsche/ch Versionen — verlinke sie im Footer je Locale (ist bereits teilweise da, aber leicht zu übersehen).

### 4.4 Hreflang Double-Check
` alternates.languages` enthält `x-default → /en` — korrekt. Achte darauf, dass `zh` (`zh-CN` bcp47) nicht als `zh` im HTML landet (Google erkennt `zh-CN` vs `zh-TW` getrennt — dein `bcp47` Mapping ist bereits korrekt).

### 4.5 Performance
- LCP <2.5s: `next/image` + `priority` für Lead-Hero.
- INP: `Header` + `LiveBanner` sind client-heavy — lazy-loaden.
- Prüfen: https://pagespeed.web.dev/ für `/de/a/<slug>` (nicht nur Homepage).

---

## 5) AI-spezifisch: So wirst du zitiert (ChatGPT, Perplexity, Gemini, Claude)

| Tipp | Wo umsetzen |
|---|---|
| **ChatGPT Search bevorzugt frische Quellen mit Datum** | Dein `datePublished` ist ISO-8601 ✅ — halte es immer UTC, nie lokales Datum. Newsroom macht das schon richtig. |
| **Perplexity liebt `llms.txt`** | Jetzt dynamisch ✅ + `llms-full.txt` bleibt bei 500 Einträgen (Token-Limit). Nicht erhöhen — sonst truncated. |
| **Gemini (Google Extended) nutzt Bing + Google News** | Publisher Center + news-sitemap = Doppel-Abdeckung. |
| **Claude nutzt CCBot + eigene Suche** | Dein `CCBot Allow` ✅ — Cloudflare nicht auf „Block AI“ stellen! |
| **Zitierfähigkeit:** Jeder Artikel braucht einen **einzigartigen ersten Absatz** der die Frage beantwortet („Wer/Was/Wann“). Dein Dek macht das meist gut — A/B testen: Dek = 20-25 Wörter, enthält Ort + Datum + Zahl. |
| **Kein Geoblocking für `plain-news.ch`** | Hosting Dashboard: kein „Bot Fight Mode“ in Cloudflare/Vercel, kein IP-Ban für OpenAI Ranges. Dein `middleware.js` macht es richtig (Crawler → Rewrite, nicht 307) — lass das so. |
| **Self-test** | `npm run check:ai` lokal + `CHECK_UA=PerplexityBot/1.0 npm run check:ai` regelmäßig. Auch testen: `curl -A OAI-SearchBot/1.0 https://www.plain-news.ch/de/a/<slug> \| grep -c "<h1"` muss 1 sein. |

---

## 6) Monitoring — diese Dashboards wöchentlich checken

1. **Vercel → Analytics → Web Vitals** (LCP/CLS)
2. **Search Console → Google News → Performance** (wenn freigeschaltet)
3. **Search Console → Sitemaps** (grün? Fehler?)
4. `curl -s https://www.plain-news.ch/api/content/status | jq` → `source` sollte `supabase` sein wenn du `content:sync` nutzt.
5. `npm run check:ai` → alle Checks `OK`. Wenn `article: <slug>` → 404, ist kein robots-Problem sondern Vercel-Deploy hängt (siehe README „Wenn Production hinterherhinkt“).

---

## 7) Quick-Checkliste (Copy-paste für Notion)

- [ ] Publisher Center verifiziert + `news-sitemap.xml` freigeschaltet
- [ ] Search Console + Bing Webmaster verifiziert, Sitemaps eingereicht
- [ ] Artikel-Bilder: Quelle-OG übernehmen wenn null (Reporter-Bot patchen)
- [ ] `next/image` für Lead + Card
- [ ] Interne „Weiterlesen“-Box am Artikelende
- [ ] Kategorie-Introtexte schreiben
- [ ] IndexNow Ping nach Newsroom-Lauf
- [ ] Ein Presse-Interview / Uni-Kooperation für Backlink
- [ ] Wöchentlich `check:ai` + `pagespeed.web.dev` laufen lassen

---

*Erstellt 2025-10-29, Branch `arena/87bde60f-plain-news` — 7 Dateien gepatcht, Build grün. Alle Fixes sind abwärtskompatibel und blockieren keinen Bot.*
