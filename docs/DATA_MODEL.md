# Datenmodell V1

## Aktueller Runtime-Modus

Aktuell speichert die App lokal in JSON-Dateien. Das ist bewusst einfach, damit:
- Windows und Mac sofort ohne DB starten koennen
- das Repo schnell clonbar bleibt
- die V1 ohne Docker laeuft

## Ziel fuer produktiven Betrieb

Produktiv sollte auf PostgreSQL umgestellt werden.

Schema-Datei:
- `Database/PostgreSQL/schema_v1.sql`

## Tabellen

- `app_user`
- `app_settings`
- `search_job`
- `listing_snapshot`
- `listing_evaluation`
- `notification_event`

## Migrationsstrategie

1. JSON-Runtime fuer lokale Entwicklung beibehalten
2. Repository-Layer einfuehren
3. PostgreSQL-Implementierung hinter denselben Interfaces anschliessen
4. danach Worker und API auf DB umstellen
