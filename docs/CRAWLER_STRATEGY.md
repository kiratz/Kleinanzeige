# Crawler-Strategie

## Aktueller Stand

Die App besitzt jetzt einen separaten Crawler-Layer in:

- `packages/core/crawler.js`

Der Worker nutzt diesen Layer bereits und erzeugt Listing-Snapshots in einer sauberen Struktur.

## Warum zuerst simuliert

Bevor echte Kleinanzeigen-Automation angebunden wird, brauchen wir:
- stabile Suchauftragslogik
- Persistenz fuer Listings
- Dashboard fuer Treffer
- Worker-Kommandos und Status
- Deal-Scoring-Pipeline

Diese Teile sind jetzt vorbereitet.

## Naechster echter Integrationsschritt

1. Browser-Automation einbauen
2. Session-/Login-Strategie fuer Kleinanzeigen definieren
3. HTML-Seiten in strukturierte Listings parsen
4. Duplikate ueber `externalId`/URL erkennen
5. OpenAI-Auswertung auf echte Listingdaten anwenden

## Ziel-Schnittstelle

Der Worker soll spaeter nur noch diese Art Daten erwarten:

- `externalId`
- `title`
- `price`
- `location`
- `listingUrl`
- `rawPayload`

Dadurch bleibt der Rest der App unveraendert, egal ob die Quelle:
- HTML-Scraping
- Browser-Automation
- Import
- spaetere API
ist.
