# Produktanforderungen

## Ziel

Eine geschuetzte Web-Anwendung fuer genau einen Benutzer, die:
- Suchwuensche fuer Kleinanzeigen dynamisch entgegennimmt
- daraus mit KI gute Suchstrategien erzeugt
- Anzeigen regelmaessig prueft
- neue Treffer bewertet
- bei echten Schnaeppchen sofort benachrichtigt

## Kernfunktionen

### 1. Login

- genau ein Benutzerkonto
- Login erforderlich
- ohne Login keine Nutzung

### 2. Dynamische Suchauftraege

Ein Suchauftrag kann enthalten:
- Freitextbeschreibung
- Titel
- Kategorie
- Suchbegriffe
- Alternativbegriffe
- Ausschlussbegriffe
- Radius
- Preis von/bis
- Versand / Abholung
- technische Mindestanforderungen
- Blacklist-Regeln
- Intervall fuer Pruefung

### 3. KI-gestuetzte Suchgenerierung

Beispiel:

> "Ich suche einen leisen Gaming-PC mit RTX 4070, mindestens 32 GB RAM, maximal 900 Euro im Raum Muenchen."

Die KI soll daraus ableiten:
- strukturierte Suchparameter
- Alternativbegriffe
- Ausschlussbegriffe
- sinnvolle Preisstrategie
- Qualitaetskriterien

### 4. Schnaeppchen-Bewertung

Die KI bewertet jeden Treffer anhand von:
- Preis
- Komponenten
- Vollstaendigkeit der Anzeige
- Zustand / Seriositaet
- Vergleich zu aehnlichen Anzeigen

Zielausgabe:
- Score
- Kurzbegruendung
- Entscheidung:
  - ignorieren
  - beobachten
  - interessant
  - schnaeppchen

### 5. Loop / Monitoring

- regelmaessige Abfrage je Suchauftrag
- neue Eintraege erkennen
- bereits bewertete Treffer nicht dauernd neu melden
- nur bei Aenderung oder neuen Anzeigen neu bewerten

### 6. Benachrichtigung

- Telegram zuerst
- WhatsApp spaeter optional
- sofortige Nachricht bei Schnaeppchen

## Nicht-Ziele fuer V1

- Mehrbenutzerbetrieb
- automatische Kaufabwicklung
- automatische Nachrichten an Verkaeufer ohne explizite Freigabe
