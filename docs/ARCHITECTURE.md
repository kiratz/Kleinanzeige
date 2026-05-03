# Architektur

## Komponenten

### Web

Aufgaben:
- Login
- Suchauftraege verwalten
- Treffer ansehen
- Bewertung nachvollziehen
- Benachrichtigungseinstellungen pflegen

### API

Aufgaben:
- Authentifizierung
- CRUD fuer Suchauftraege
- Trefferverwaltung
- KI-Auswertungen orchestrieren
- Dashboard-Daten liefern

### Worker

Aufgaben:
- Suchloops ausfuehren
- neue Treffer erkennen
- KI-Bewertungen triggern
- Benachrichtigungen versenden

## Datenmodell grob

- `user`
- `search_job`
- `search_query`
- `listing_snapshot`
- `listing_evaluation`
- `notification_event`
- `integration_setting`

## Technische Leitlinien

- TypeScript in allen Apps
- API, Web und Worker getrennt deploybar
- serverzentrierte Architektur
- spaeter Docker- und systemd-faehig
- KI-Zugriffe ueber klar gekapselten Service
- Crawler/Bot-Logik getrennt von Produktlogik
