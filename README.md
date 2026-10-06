# PLAIN. — Unbiased, Minimalist News Portal

Ein schnelles, völlig werbe- und abofreies Nachrichtenportal mit kantigem, ästhetischem Beige/Schwarz-Design, automatischer multi-agenten KI-Redaktion und Live-Börsenkursen.

---

## 🏛️ Prinzipien & Philosophie

1. **Unbiased & Faktenbasiert**: Kein Framing, keine emotionalen Clickbait-Verben (*"slammed"*, *"chaos"*, *"bombshell"*).
2. **Mindestens zwei unabhängige Quellen**: Eine Meldung wird nur publiziert, wenn mindestens 2 verschiedene Medien unabhängig voneinander darüber berichten.
3. **Framing-Transparenz**: Unter jedem Artikel wird aufgelistet, welche Medien mit welchem Original-Titel über das Ereignis berichtet haben.
4. **100% Kostenlos**: Keine Werbung, keine Bezahlschranken, keine Abonnements, kein Tracking.
5. **Mehrsprachig**: Vollständige Unterstützung für 9 Sprachen (**EN, DE, FR, ES, IT, PT, ZH, JA, KO**) mit automatischer Lokalisierung.
6. **Live-Märkte**: Echtzeit-Kurse und historische Charts für Indizes, Aktien, Devisen, Rohstoffe und Krypto via freier Yahoo-Finance API.

---

## 🤖 KI-Redaktionsarchitektur (`bots/`)

Das System nutzt NVIDIA NIM APIs (u.a. `nvidia/nemotron-3-super-120b`, `openai/gpt-oss-20b`, `nvidia/nemotron-3.5-lightning`) in einer mehrstufigen Pipeline:

```
[40+ RSS-Feeds] 
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

## 🚀 Deployment & Automatisierung

### 1. Hosting (Vercel / Next.js)
Das Portal ist für **Vercel** optimiert:
- **Kein Sleep/Inaktivität**: Im Gegensatz zum Render-Free-Tier schläft Vercel nie ein.
- **Global Edge & Static Generation**: Extrem schnelle Ladezeiten weltweit.
- **Git-basiert**: Jedes Mal, wenn die Bots neuen Content pushen, aktualisiert sich die Seite automatisch ohne Downtime.

### 2. Autonome Bots via GitHub Actions
In `.github/workflows/` sind zwei Workflows hinterlegt:
- `newsroom.yml`: Läuft alle 2 Stunden (`cron: '17 */2 * * *'`), ruft die Feeds ab, generiert News und pusht sie direkt ins Repo.
- `maintenance.yml`: Läuft täglich um 03:40 UTC für Cleanup und Re-Indexing.

**Einrichtung auf GitHub:**
1. Repository auf GitHub pushen.
2. In den Repository-Einstellungen unter `Settings -> Secrets and variables -> Actions` das Secret hinterlegen:
   - `NVIDIA_API_KEY`: Dein NVIDIA NIM API Key

---

## 💻 Lokale Entwicklung

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
```
