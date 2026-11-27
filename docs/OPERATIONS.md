# Berliner: Betrieb und Freischaltung

## Aktueller Stand

Die Karte und das Formular funktionieren ohne Cloudflare. Der neue Ortskatalog liegt
unter `public/catalog/` und wird erst beim Öffnen der Suche geladen. Es gibt keine
Live-Overpass-Abfrage im normalen Eingabeablauf. Die bisherige API-Funktion bleibt
als explizite spätere Rückfalloption im Quellcode und hat jetzt Abbruch/Timeout.

Persönliche Einträge liegen weiterhin unter `berlin-entdecken-places-v1` im jeweiligen
Browser. Sie werden nicht zwischen Freunden synchronisiert. Ein Katalogupdate ändert
nur Suchvorschläge, niemals gespeicherte Einträge, Bewertungen, Koordinaten oder Notizen.
Der ursprüngliche Google-Teilen-Link bleibt gespeichert. OSM-Auswahl speichert zusätzlich
die Herkunfts-ID; fehlende Informationen und Adressen werden nur in leere Felder ergänzt.

## Cloudflare Free vorbereiten

Der Worker ist in `cloudflare/worker.ts` vorbereitet. Kein Deployment wurde ausgeführt.
Für die kleine Freundesgruppe ist Workers Free voraussichtlich ausreichend. Stand
26.11.2026: 100.000 Requests pro Tag, 10 ms CPU pro Aufruf; Netzwerkwartezeit zählt
nicht als CPU-Zeit. Limits bleiben maßgeblich, die Nutzerzahl allein ist keine Garantie.

Benötigt werden:

1. Ein Cloudflare-Konto mit Workers Free und aktivierter workers.dev-Subdomain.
2. Lokaler Login über die offizielle Wrangler-CLI (keine Passwörter/API-Keys im Chat).
3. Bestätigung der erlaubten Website-Origin: aktuell `https://thanu8848.github.io`.
   Der Pfad `/berliner/` gehört nicht zur Origin.
4. Einige echte Google-Maps-Teilen-Links von iPhone/Android für den Live-Abnahmetest.

Erst nach Freigabe veröffentlichen, aus dem Projektverzeichnis:

```sh
npx wrangler@4 login
npx wrangler@4 deploy --config cloudflare/wrangler.jsonc
```

Die CLI ist bewusst keine zusätzliche App-Abhängigkeit. Worker-Typen werden mit
`npm run check:worker` geprüft; Redirect- und HTTP-Tests mit `npm test`.
Danach die URL `https://berliner-maps-links.<subdomain>.workers.dev/resolve` als
GitHub Actions Repository Variable `VITE_MAPS_RESOLVER_URL` setzen und den Pages-Build
auslösen. Für lokale Tests dieselbe öffentliche URL in `.env.local` setzen und die
exakte lokale Origin zusätzlich in `ALLOWED_ORIGINS` erlauben. Keine geheimen Schlüssel
in `VITE_*`-Variablen: diese stehen öffentlich im Browsercode.

Der Worker erlaubt nur HTTPS-Google-Maps-URLs ohne Zugangsdaten oder besondere Ports.
Er prüft jede Weiterleitung, folgt maximal fünf Kurzlink-Hops und stoppt nach sieben
Sekunden. Google-HTML wird nicht ausgewertet. Nicht auflösbare Links bleiben im Formular;
man kann den Ort stattdessen im Katalog oder auf der Karte wählen. Der Endpunkt hat
Origin-Prüfung, begrenzte Requestgröße und einen Cloudflare-Rate-Limiter. Origin-Prüfung
ist keine Anmeldung. Die IP-Drossel kann bei gemeinsamem WLAN/Mobilfunk mehrere Menschen
zusammenfassen und ist pro Cloudflare-Standort nur annähernd genau; bei Bedarf anpassen.
Der Browser schickt den eingegebenen Maps-Link an den Worker, dieser nur an erlaubte
Google-Ziele. Formulardaten, Notizen und persönliche GPS-Position werden nicht übertragen.
Der eigene Worker schreibt keine Link-/IP-Logs; Provider-Betriebsdaten bleiben möglich.

## Tägliche Katalogaktualisierung

Die bestehende Pages-Pipeline wurde um einen Zeitplan ergänzt (05:23 UTC täglich).
Sie ist für geplante Läufe zunächst durch die Repository Variable
`ENABLE_OSM_UPDATES=true` freizuschalten. Ohne diese Variable bleibt der eingecheckte
Katalog verwendbar. Es wurden weder Variablen gesetzt noch Workflows ausgelöst.

Bei Aktivierung lädt der Build den öffentlichen Geofabrik-Berlin-Auszug bedingt per
ETag/Last-Modified herunter. Bei unveränderter Quelle wird der gecachte Download benutzt.
Nodes, Ways und Multipolygon-Flächen mit den fünf unterstützten Kategorien werden in
kompaktes JSON umgewandelt. Flächenpositionen sind Bounding-Box-Mittelpunkte, keine
ermittelten Eingänge. OSM-Adressen und Ortsteile können fehlen oder unvollständig sein.

Der Build erzeugt eine Datei mit Inhalts-Hash und ein Manifest mit OSM-Quelldatum.
Vor Veröffentlichung prüfen Tests und Build die Ausgabe. Bei Fehlern bleibt das bisherige
Deployment online. Es wird kein automatischer Daten-Commit erzeugt. Der Zeitplan ist kein
Echtzeit-Abonnement: Verfügbarkeit der Quelle und GitHub-Ausführung können Aktualisierungen
verzögern; GitHub kann inaktive öffentliche Repository-Zeitpläne deaktivieren. Manuell bleibt
`workflow_dispatch` möglich. Der Browser prüft das Manifest beim erneuten Laden des Katalogs,
spätestens nach Ablauf des einstündigen Sitzungscaches bei einer neuen Suche.

Die Kartenkacheln kommen weiterhin von OpenFreeMap. Deren Aktualisierung erfolgt unabhängig
vom POI-Katalog. Das Datum im Katalog beschreibt den OSM-Auszug, nicht jede Kartenkachel.

Lokal reproduzieren (Python 3.9+):

```sh
python3 -m venv .catalog-venv
.catalog-venv/bin/pip install -r scripts/catalog-requirements.txt
.catalog-venv/bin/python scripts/build_catalog.py
# Alternativ ohne Netzwerk:
.catalog-venv/bin/python scripts/build_catalog.py --input /pfad/berlin.osm.pbf
```

## OSM-Lizenz

Ortskatalog: © OpenStreetMap contributors, Open Database License (ODbL) 1.0.
Quelle: https://download.geofabrik.de/europe/germany/berlin.html
Lizenz: https://opendatacommons.org/licenses/odbl/1-0/
Attribution: https://www.openstreetmap.org/copyright

Der erzeugte Katalog ist eine abgeleitete OSM-Datenbank und wird unter ODbL bereitgestellt.
Die maschinenlesbare JSON-Datei ist öffentlich über das Manifest erreichbar; das
Build-Skript dokumentiert die Transformation. Die Lizenzangabe gilt dem Datenkatalog,
nicht automatisch dem Anwendungscode oder persönlichen Notizen.

## Noch auf einem echten iPhone prüfen

- Safari mit ein-/ausgeblendeter Adressleiste, Bildschirmtastatur und Querformat.
- Geolocation erlauben/verweigern: nur Nutzerpunkt, kein Restaurantmarker und kein Tracking.
- Speichern bei geöffnetem optionalem Bereich; Wechsel Karte/Formular ohne Datenverlust.
- Echte Google-Maps-Teilen-Links nach Worker-Aktivierung, auch nicht auflösbare Links.
- Langsames Netz: Katalog abbrechen und manuell weiterarbeiten; Standortänderung während Suche.

Kein Commit, Push oder Deployment gehört zur lokalen Vorbereitung.


## Adresssuche als bestätigter Ersatzweg

Nach erfolgloser lokaler Geschäftssuche kann der Nutzer ausdrücklich die öffentliche
Geschäftsadresse suchen lassen. Es werden keine Namen, Notizen oder privaten Adressen
benötigt. `/resolve` bleibt unverändert; `/geocode` ist eine getrennte POST-Route.
Die Frontend-URL wird aus `VITE_MAPS_RESOLVER_URL` abgeleitet (gleicher Host, `/geocode`).
Keine weitere GitHub-Variable und keine Änderung am Pages-Workflow nötig.

Vor Veröffentlichung:
- Worker-Konfiguration prüfen: `GEOCODER_URL` und `GEOCODER_AGENT` (öffentliche Projektadresse).
- Die SQLite-Durable-Object-Bindung `GEOCODE` und Migration `geocode-v1` werden erst beim
  ausdrücklich beauftragten Worker-Deployment angelegt. Kein Account-Geheimnis im Frontend.
- Ein älterer Worker ohne `/geocode` führt zu einer verständlichen Fehlermeldung;
  Karte und Kurzlinks bleiben nutzbar.
- Öffentliche Nominatim-Regeln: https://operations.osmfoundation.org/policies/nominatim/
  Maximal 1 Anfrage/Sekunde pro Anwendung, kein Autocomplete, keine systematischen Abfragen,
  App-Kennung, Attribution, keine vertraulichen Daten. Nutzung wurde bewusst für die Beta gewählt.
- Ein global benanntes Durable Object verhindert parallele Provider-Anfragen; Startabstand
  mindestens 1,5 Sekunden, persistent über Neustarts. Weitere Nutzer erhalten eine Wiederholen-Meldung.
  Zusätzlich 10 Aufrufe/Minute je IP. Upstream-429 pausiert den Dienst mindestens 60 Sekunden.
- Gemeinsamer persistenter Cache: maximal 30 Adressen, Treffer sieben Tage, Fehlanzeigen einen Tag.
  Providerwechsel trennt Cacheeinträge. Kein automatisches Aktualisieren oder Hintergrundgeocoding.
- Provider-URL ist eine Worker-Variable: Wechsel zu einem Nominatim-kompatiblen Dienst ohne
  Frontend-Update; für ein anderes Antwortformat ist der Adapter `nominatimResults` anzupassen.
- Berlin-Rechteck PLUS Bundeslandprüfung verhindern Vorschläge in Brandenburg.
  Straßen-/Gebietstreffer werden als ungefähr markiert. Auch Gebäudetreffer müssen bestätigt werden.
- Provider-Timeout sieben Sekunden, Browser zehn Sekunden. Bei Abbruch oder Formularwechsel
  werden veraltete Antworten ignoriert. Vorschlagskoordinaten sind getrennt vom Formularstandort.
- Falls bereits ein verlässlicher Standort vorliegt, wird kein Adressgeocoding angeboten.

Prüfung: `npm test`, `npm run lint`, `npm run check:worker`, `npm run build`.
Worker-Probelauf ohne Veröffentlichung: `npx wrangler@4 deploy --dry-run --config cloudflare/wrangler.jsonc`.


## Genauigkeit und Ortsteile (2026-11-28)

Adresssuche nutzt strukturierte Straße/Hausnummer/PLZ statt Freitext. Ergebnisse werden
gegen die Anfrage geprüft: widersprüchliche Straßen, Hausnummern (auch Zusätze) und PLZ
werden ausgeschlossen. Passende Bereiche und fehlende Hausnummer/PLZ sind nur ungefähre
Vorschläge. Vollständige Übereinstimmungen stehen zuerst; auch sie benötigen Kartenbestätigung.
Dies ist eine Plausibilitätsprüfung, keine Garantie für die Genauigkeit der Quelldaten.
Cacheversion `address-v2` verhindert Wiederverwendung früher ungeprüfter Ergebnisse.
Globale Drosselung und Timeout bleiben unverändert.

Ortsteile werden lokal aus den amtlichen, unveränderten ALKIS-Polygonen des Geoportals Berlin
bestimmt. Quelle/Lizenz: `public/boundaries/SOURCE.txt`; Snapshot abgerufen am 2026-11-28.
97 Ortsteile, keine Bezirkszuordnung aus Nominatim. Bezirk folgt aus der bestehenden Ortsteiltabelle.
Die Datei wird erst bei vorhandenem bestätigtem Standort geladen und im Speicher wiederverwendet.
Unbestätigte Geocoding-Vorschläge lösen keine automatische Feldübernahme aus.
Im Abstand bis zehn Meter zu einer Grenze bzw. außerhalb/bei Mehrdeutigkeit wird nicht automatisch
zugeordnet. Manuelle und vorhandene Angaben bleiben erhalten; Abweichungen werden angezeigt.
Automatisch abgeleitete Angaben folgen Standortkorrekturen, bis der Nutzer das Feld selbst bearbeitet.
Keine zusätzliche Geocoding-Anfrage, kein neues localStorage-Schema.
