# 🗺️ Berliner
### Entdecke Berlin durch andere.

**Berliner** ist eine interaktive Entdeckerkarte für Restaurants, Cafés, Bars, Kneipen und Imbisse in Berlin.

Die Idee: Eine Karte, auf der Menschen ihre Lieblingsorte teilen, persönliche Erfahrungen austauschen und gemeinsam neue Orte entdecken können.

Statt ausschließlich auf allgemeine Bewertungen zurückzugreifen, soll Berliner zeigen, welche Orte Freunde und andere Mitglieder der Community tatsächlich besucht haben und weiterempfehlen.

Das Projekt befindet sich aktuell in der Entwicklung.

## 💡 Die Idee

Berlin bietet unzählige Möglichkeiten, essen zu gehen, etwas zu trinken oder neue Orte kennenzulernen.

Doch häufig stellt sich dieselbe Frage:

**Wo gehen wir heute hin?**

Berliner soll dabei helfen, diese Entscheidung einfacher zu machen.

Nutzerinnen und Nutzer sollen:

- Interessante Orte auf einer gemeinsamen Karte entdecken.
- Eigene Lieblingsorte hinzufügen.
- Restaurants, Cafés und Bars persönlich bewerten.
- Empfehlungen von Freunden und anderen Menschen sehen.
- Erkennen, welche Orte gerade besonders beliebt sind.
- Neue Kieze entdecken, die bisher kaum erkundet wurden.

Langfristig soll eine gemeinschaftlich gepflegte Entdeckerkarte entstehen, die mit den Erfahrungen ihrer Nutzer wächst.

## ✨ Aktuelle Funktionen

Die Anwendung besitzt bereits folgende Funktionen:

### 🗺️ Interaktive Berlin-Karte

- Kartendarstellung mit MapLibre und OpenStreetMap-basierten Kartendaten.
- Eigene Orte als Marker auf der Karte anzeigen.
- Standort durch Anklicken der Karte auswählen.
- Informationen zu gespeicherten Orten anzeigen.
- Navigation zu einem Ort über Google Maps öffnen.

### 📍 Orte verwalten

- Restaurants, Imbisse, Cafés, Bars und Kneipen hinzufügen.
- Bestehende Orte bearbeiten und löschen.
- Orte nach Berliner Ortsteilen zuordnen.
- Küchenrichtungen und weitere Informationen erfassen.
- Sitzmöglichkeiten und Eigenschaften eines Ortes hinterlegen.
- Persönliche Notizen speichern.
- Mögliche doppelte Einträge erkennen.

### 🔎 Orte importieren

- Google-Maps-Links einfügen.
- Namen und Koordinaten aus unterstützten Google-Maps-Links übernehmen.
- Orte in der Umgebung über OpenStreetMap suchen.
- Passende OpenStreetMap-Daten zur Ergänzung von Ortsinformationen verwenden.
- Fehlende Informationen manuell ergänzen.

### 💾 Lokale Speicherung

Aktuell werden gespeicherte Orte im `localStorage` des Browsers abgelegt.

Dadurch bleiben Einträge auch nach dem Neuladen der Seite erhalten.

**Wichtig:** Die Daten werden momentan noch nicht zwischen unterschiedlichen Geräten oder Nutzern synchronisiert. Eine gemeinsame Datenbank mit Supabase ist geplant.

## 🚀 Geplante Funktionen

### Community und Bewertungen

- Registrierung mit selbst gewähltem Anzeigenamen.
- Gemeinsame Verwaltung von Orten.
- Persönliche Bewertungen mit einer Skala von 1 bis 10.
- Einzelbewertungen für Essen bzw. Getränke, Preis-Leistung und Atmosphäre.
- Kommentare und persönliche Empfehlungen.
- Bewertungen nachträglich bearbeiten.
- Empfehlungen von Freunden und der gesamten Community unterscheiden.

### Berlin gemeinsam entdecken

- Trending-Orte anhand der Besucheraktivität erkennen.
- Besonders empfohlene Restaurants, Bars und Cafés hervorheben.
- Geheimtipps entdecken.
- Besuchte und noch unentdeckte Orte unterscheiden.
- Den Erkundungsfortschritt einzelner Berliner Ortsteile sichtbar machen.

### Weitere Verbesserungen

- Erweiterte Kartenfilter und übersichtliche Marker-Gruppierung.
- Standortbasierte Empfehlungen.
- Optimierung für Smartphones.
- Verbesserter Import von Orten und Adressen.
- Gemeinsame Speicherung über Supabase.
- Überarbeitung des Designs und der Benutzeroberfläche.

## 🛠️ Technologien

Das Projekt wird mit folgenden Technologien entwickelt:

| Technologie | Verwendung |
|-------------|------------|
| React | Benutzeroberfläche |
| TypeScript | Anwendungslogik und Typensicherheit |
| Vite | Entwicklungsumgebung und Build-Tool |
| MapLibre GL JS | Interaktive Kartendarstellung |
| OpenStreetMap | Offene geografische Daten |
| Overpass API | Suche nach OpenStreetMap-Orten |
| localStorage | Aktuelle lokale Datenspeicherung |
| Supabase (geplant) | Datenbank, Nutzerkonten und gemeinsame Speicherung |
| GitHub Pages (geplant) | Veröffentlichung der Webanwendung |

## 💻 Projekt lokal starten

### Voraussetzungen

- Node.js
- npm
- Git

### 1. Repository klonen

```bash
git clone https://github.com/thanu8848/berliner.git
```

### 2. Projektverzeichnis öffnen

```bash
cd berliner
```

### 3. Abhängigkeiten installieren

```bash
npm install
```

### 4. Entwicklungsserver starten

```bash
npm run dev
```

Anschließend kann die Anwendung normalerweise unter folgender Adresse geöffnet werden:

http://localhost:5173/

### 5. TypeScript überprüfen

```bash
npx tsc -b
```

## 🧭 Projektstatus

**Berliner befindet sich in aktiver Entwicklung.**

Die grundlegende Kartenansicht und die Verwaltung von Orten sind bereits umgesetzt.

Der nächste Entwicklungsschritt ist die Veröffentlichung über GitHub Pages. Anschließend soll Supabase integriert werden, damit mehrere Personen dieselbe Karte verwenden und gemeinsam Orte bewerten können.

## 🎯 Projektziel

Berliner soll langfristig mehr sein als eine Sammlung gespeicherter Orte.

Die Anwendung soll Menschen dazu motivieren, ihre Stadt neu zu entdecken, persönliche Erfahrungen zu teilen und Empfehlungen innerhalb einer Community auszutauschen.

**Entdecke neue Orte. Teile deine Erfahrungen. Erkunde deinen Kiez.**