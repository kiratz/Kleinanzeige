# Kleinanzeige

KI-gestuetzte Such- und Benachrichtigungsplattform fuer Kleinanzeigen.

Ziel von V1:
- ein geschuetzter Benutzer-Login
- dynamische Suchauftraege
- KI erzeugt aus Freitext sinnvolle Suchparameter
- regelmaessiger Such-Loop
- neue Treffer erkennen und entduplizieren
- KI bewertet Treffer auf "Schnaeppchen"
- Sofort-Benachrichtigung, zuerst per Telegram, spaeter optional WhatsApp

## Projektstruktur

```text
apps/
  api/       REST API, Auth, Suchauftraege, Treffer, KI-Orchestrierung
  web/       Web-App fuer Login, Suche, Treffer, Einstellungen
  worker/    Scheduler, Kleinanzeigen-Abfragen, Benachrichtigungen
packages/
  config/    gemeinsame TypeScript- und Laufzeit-Konfiguration
docs/        Produkt- und Architektur-Dokumentation
```

## Zielarchitektur

- `apps/web`: Browser-UI fuer einen einzelnen geschuetzten Benutzer
- `apps/api`: zentrales Backend mit Auth, Suchlogik und API
- `apps/worker`: Hintergrundprozess fuer Polling, Bewertung und Alerts
- PostgreSQL fuer Benutzer, Suchauftraege, Treffer, Bewertungen, Logs
- spaeter Browser-Automation fuer Kleinanzeigen
- spaeter OpenAI-basierte Auswertung fuer Suchgenerierung und Schnaeppchen-Scoring

## Warum so aufgebaut

- laeuft zentral auf dem Server
- kann von Mac und Windows aus bearbeitet werden
- sauber trennbar in UI, API und Worker
- spaeter problemlos mit Docker oder systemd deploybar

## Geplanter V1-Umfang

1. Login fuer genau einen Benutzer
2. Suchauftraege mit Freitext und erweiterten Filtern
3. KI-gestuetzte Ableitung von Suchparametern
4. Speichern strukturierter Suchauftraege
5. Loop fuer neue Treffer
6. Trefferhistorie mit Status
7. Telegram-Benachrichtigung
8. Grundlegendes Admin-/Einstellungsmodul

## Lokaler Start

1. `.env` anlegen

```bash
cp .env.example .env
```

2. API starten

```bash
npm run dev:api
```

3. Web starten

```bash
npm run dev:web
```

4. Optional Worker starten

```bash
npm run dev:worker
```

Danach:

- Web: `http://localhost:3000`
- API Health: `http://localhost:4000/health`
- Laufzeitdaten standardmaessig unter:
  - ueber `APP_DATA_DIR`, falls gesetzt
  - sonst im Temp-Verzeichnis des Systems, z. B. `.../Temp/kleinanzeige`

Standard-Login aus `.env.example`:

- Benutzer: `admin`
- Passwort: `change-me`

## Dokumentation

- [Produktanforderungen](./docs/PRODUCT_REQUIREMENTS.md)
- [Architektur](./docs/ARCHITECTURE.md)
- [Roadmap](./docs/ROADMAP.md)
