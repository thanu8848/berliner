
import { useEffect, useRef, useState } from 'react'
import {
    Map,
    Marker,
    NavigationControl,
    Popup,
    setWorkerUrl
} from 'maplibre-gl'

import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'

import PlaceForm from './components/PlaceForm'
import { places } from './data/places'
import type { Place, PlaceCategory } from './types/place'

// Neu: OpenStreetMap-Suche
import { searchNearbyOsmPlaces } from './services/osm'
import type { OsmPlace } from './services/osm'

import {
    parseGoogleMapsLink,
    extractGoogleMapsPlaceName
} from './services/googleMaps'


// MapLibre konfigurieren
setWorkerUrl(workerUrl)

// Schlüssel für die lokale Speicherung
const STORAGE_KEY = 'berlin-entdecken-places-v1'

// Farben für die Entdeckerstatus
const statusColors = {
    unentdeckt: '#969AA1',
    vorgemerkt: '#DCA93E',
    empfohlen: '#2D9B77',
    nicht_empfohlen: '#C45B58'
}

// Beschriftungen der Kategorien
const categoryLabels = {
    restaurant: 'Restaurant',
    imbiss: 'Imbiss',
    cafe: 'Café',
    bar: 'Bar',
    kneipe: 'Kneipe'
}

// Beschriftungen der Entdeckerstatus
const statusLabels = {
    unentdeckt: 'Unentdeckt',
    vorgemerkt: 'Vorgemerkt',
    empfohlen: 'Empfohlen',
    nicht_empfohlen: 'Nicht empfohlen'
}


function normalizePlaceName(name: string): string {
    return name
        .toLocaleLowerCase('de-DE')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]/g, '')
}

function isSimilarPlaceName(
    googleName: string,
    osmName: string
): boolean {
    const google = normalizePlaceName(googleName)
    const osm = normalizePlaceName(osmName)

    if (!google || !osm) return false

    // Namen stimmen vollständig überein
    if (google === osm) return true

    // Ein Name enthält den anderen
    if (google.length >= 8 && osm.length >= 8) {
        return google.includes(osm) || osm.includes(google)
    }

    return false
}


// Informationsfenster für einen gespeicherten Ort
function createPlacePopup(
    place: Place,
    onEdit: (place: Place) => void,
    onDelete: (place: Place) => void
) {
    const content = document.createElement('div')

    // Name
    const title = document.createElement('h3')
    title.textContent = place.name

    // Kategorie und Bezirk
    const category = document.createElement('p')
    category.textContent =
        `${categoryLabels[place.category]} · ${place.district}`

    // Entdeckerstatus
    const status = document.createElement('p')
    status.textContent =
        `Status: ${statusLabels[place.status]}`

    content.append(title, category, status)

    // Küche
    if (place.cuisine && place.cuisine.length > 0) {
        const cuisine = document.createElement('p')
        cuisine.textContent =
            `Küche: ${place.cuisine.join(', ')}`

        content.append(cuisine)
    }

    // Sitzmöglichkeiten
    if (place.seating) {
        const seating = document.createElement('p')

        const seatingLabels = {
            yes: 'Ja',
            no: 'Nein',
            unknown: 'Unbekannt'
        }

        seating.textContent =
            `Sitzplätze: ${seatingLabels[place.seating.available]}`

        content.append(seating)

        if (place.seating.available === 'yes') {
            const details: string[] = []

            if (place.seating.capacity === 'few') {
                details.push('Wenige Sitzplätze')
            }

            if (place.seating.capacity === 'many') {
                details.push('Viele Sitzplätze')
            }

            if (place.seating.indoor) {
                details.push('Drinnen')
            }

            if (place.seating.outdoor) {
                details.push('Draußen')
            }

            if (place.seating.cozy) {
                details.push('Gemütlich')
            }

            if (place.seating.cramped) {
                details.push('Eng')
            }

            if (details.length > 0) {
                const seatingDetails = document.createElement('p')
                seatingDetails.textContent = details.join(' · ')
                content.append(seatingDetails)
            }
        }
    }

    // Notizen
    if (place.notes) {
        const notes = document.createElement('p')
        notes.textContent = place.notes
        content.append(notes)
    }

    // Website
    if (place.website) {
        const website = document.createElement('a')
        website.href = place.website
        website.target = '_blank'
        website.rel = 'noopener noreferrer'
        website.textContent = 'Website öffnen'

        const websiteContainer = document.createElement('p')
        websiteContainer.append(website)
        content.append(websiteContainer)
    }

    // Navigation mit Google Maps
    const navigation = document.createElement('a')

    const destination = encodeURIComponent(
        `${place.latitude},${place.longitude}`
    )

    navigation.href =
        `https://www.google.com/maps/dir/?api=1&destination=${destination}`

    navigation.target = '_blank'
    navigation.rel = 'noopener noreferrer'
    navigation.textContent = 'Route in Google Maps öffnen'

    const navigationContainer = document.createElement('p')
    navigationContainer.append(navigation)

    content.append(navigationContainer)

    // Aktionen: Bearbeiten und Löschen
    const actions = document.createElement('div')
    actions.className = 'popup-actions'

    const editButton = document.createElement('button')
    editButton.type = 'button'
    editButton.textContent = 'Bearbeiten'

    editButton.addEventListener('click', (event) => {
        event.stopPropagation()
        onEdit(place)
    })

    const deleteButton = document.createElement('button')
    deleteButton.type = 'button'
    deleteButton.textContent = 'Löschen'

    deleteButton.addEventListener('click', (event) => {
        event.stopPropagation()
        onDelete(place)
    })

    actions.append(editButton, deleteButton)
    content.append(actions)

    return content
}

function App() {
    // Referenzen für Karte und Marker
    const mapContainer = useRef<HTMLDivElement | null>(null)
    const mapRef = useRef<Map | null>(null)
    const selectionMarkerRef = useRef<Marker | null>(null)

    // Verhindert, dass alte OSM-Suchantworten
    // eine neuere Standortauswahl überschreiben
    const osmRequestRef = useRef(0)

    // Ortsliste aus localStorage laden
    const [allPlaces, setAllPlaces] = useState<Place[]>(() => {
        try {
            const savedPlaces = localStorage.getItem(STORAGE_KEY)

            if (!savedPlaces) {
                return places
            }

            const parsed: unknown = JSON.parse(savedPlaces)

            return Array.isArray(parsed)
                ? parsed as Place[]
                : places
        } catch {
            return places
        }
    })

    // Ortsliste bei Änderungen automatisch speichern
    useEffect(() => {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(allPlaces)
            )
        } catch (error) {
            console.error(
                'Orte konnten nicht gespeichert werden:',
                error
            )
        }
    }, [allPlaces])

    // Standort, den jemand auf der Karte auswählt
    const [selectedLocation, setSelectedLocation] = useState<{
        latitude: number
        longitude: number
    } | null>(null)

    // Aktuell bearbeiteter Ort
    const [editingPlace, setEditingPlace] =
        useState<Place | null>(null)

    // NEU: Zustände für die OSM-Suche
    const [osmResults, setOsmResults] = useState<OsmPlace[]>([])
    const [osmLoading, setOsmLoading] = useState(false)
    const [osmError, setOsmError] = useState('')
    const [osmSearched, setOsmSearched] = useState(false)

    const [osmCategoryFilter, setOsmCategoryFilter] =
        useState<PlaceCategory | 'all'>('all')

    const [osmNameFilter, setOsmNameFilter] = useState('')

    const [selectedOsmPlace, setSelectedOsmPlace] =
        useState<OsmPlace | null>(null)

    // Map-Link von Google Maps, den jemand eingibt
    const [googleInput, setGoogleInput] = useState('')

    // Nachricht, die nach der Prüfung des Google-Links angezeigt wird
    const [googleMessage, setGoogleMessage] = useState('')
    const [googleMapsSuggestion, setGoogleMapsSuggestion] =
        useState<string | null>(null)
    const [googlePlaceName, setGooglePlaceName] =
        useState<string | null>(null)

    const [osmEnrichment, setOsmEnrichment] =
        useState<OsmPlace | null>(null)



    // Karte erstellen
    useEffect(() => {
        if (!mapContainer.current) return

        const map = new Map({
            container: mapContainer.current,
            style: 'https://tiles.openfreemap.org/styles/liberty',
            center: [13.405, 52.52],
            zoom: 11
        })

        mapRef.current = map

        // Zoomsteuerung
        map.addControl(new NavigationControl(), 'top-right')

        // Standort durch Klick auf die Karte auswählen
        map.on('click', (event) => {
            const latitude = event.lngLat.lat
            const longitude = event.lngLat.lng

            setSelectedLocation({
                latitude,
                longitude
            })

            setSelectedOsmPlace(null)
            setEditingPlace(null)
            setGooglePlaceName(null)
            setGoogleMapsSuggestion(null)
            setOsmEnrichment(null)


            // Alte Suchergebnisse zurücksetzen
            osmRequestRef.current += 1
            setOsmResults([])
            setOsmError('')
            setOsmLoading(false)
            setOsmSearched(false)

            // Bisherigen Auswahlmarker entfernen
            selectionMarkerRef.current?.remove()

            // Neuen blauen Auswahlmarker setzen
            selectionMarkerRef.current = new Marker({
                color: '#2563EB'
            })
                .setLngLat([longitude, latitude])
                .addTo(map)
        })




        // Karte beim Verlassen aufräumen
        return () => {
            selectionMarkerRef.current?.remove()
            selectionMarkerRef.current = null

            mapRef.current = null
            map.remove()
        }
    }, [])

    // Gespeicherte Ortsmarker erstellen und aktualisieren
    useEffect(() => {
        const map = mapRef.current

        if (!map) return

        const markers = allPlaces.map((place) => {
            return new Marker({
                color: statusColors[place.status]
            })
                .setLngLat([
                    place.longitude,
                    place.latitude
                ])
                .setPopup(
                    new Popup({ offset: 25 }).setDOMContent(
                        createPlacePopup(
                            place,

                            // Vorhandenen Ort bearbeiten
                            (placeToEdit) => {
                                setEditingPlace(placeToEdit)

                                selectionMarkerRef.current?.remove()
                                selectionMarkerRef.current = null
                                setSelectedLocation(null)
                                setSelectedOsmPlace(null)
                                setGooglePlaceName(null)
                                setGoogleMapsSuggestion(null)
                                setOsmEnrichment(null)

                                // OSM-Suche zurücksetzen
                                osmRequestRef.current += 1
                                setOsmResults([])
                                setOsmLoading(false)
                                setOsmError('')
                                setOsmSearched(false)
                            },

                            // Vorhandenen Ort löschen
                            (placeToDelete) => {
                                const confirmed = window.confirm(
                                    `Möchtest du "${placeToDelete.name}" wirklich löschen?`
                                )

                                if (!confirmed) return

                                setAllPlaces(currentPlaces =>
                                    currentPlaces.filter(
                                        item => item.id !== placeToDelete.id
                                    )
                                )

                                setEditingPlace(current =>
                                    current?.id === placeToDelete.id
                                        ? null
                                        : current
                                )
                            }
                        )
                    )
                )
                .addTo(map)
        })

        // Alte Marker bei Änderungen entfernen
        return () => {
            markers.forEach(marker => marker.remove())
        }
    }, [allPlaces])

    // Neuen Ort hinzufügen
    const handleAddPlace = (newPlace: Place) => {
        setAllPlaces(previousPlaces => [
            ...previousPlaces,
            newPlace
        ])

        // Auswahlmarker entfernen
        selectionMarkerRef.current?.remove()
        selectionMarkerRef.current = null
        setSelectedLocation(null)
        setSelectedOsmPlace(null)
        setGooglePlaceName(null)
        setGoogleMapsSuggestion(null)
        setOsmEnrichment(null)


        // OSM-Suche zurücksetzen
        osmRequestRef.current += 1
        setOsmResults([])
        setOsmError('')
        setOsmLoading(false)
        setOsmSearched(false)

        // Karte auf den neuen Ort zentrieren
        mapRef.current?.flyTo({
            center: [
                newPlace.longitude,
                newPlace.latitude
            ],
            zoom: 14
        })
    }

    // Bestehenden Ort aktualisieren
    const handleUpdatePlace = (updatedPlace: Place) => {
        setAllPlaces(currentPlaces =>
            currentPlaces.map(place =>
                place.id === updatedPlace.id
                    ? updatedPlace
                    : place
            )
        )

        setEditingPlace(null)

        mapRef.current?.flyTo({
            center: [
                updatedPlace.longitude,
                updatedPlace.latitude
            ],
            zoom: 14
        })
    }


    // Gemeinsame OSM-Suchfunktion
    // Kann sowohl manuell als auch automatisch aufgerufen werden
    const searchOsmAtLocation = async (
        latitude: number,
        longitude: number
    ) => {
        const requestId = ++osmRequestRef.current

        setOsmLoading(true)
        setOsmError('')
        setOsmResults([])
        setOsmSearched(false)

        try {
            const results = await searchNearbyOsmPlaces(
                latitude,
                longitude
            )

            // Veraltete Suchantworten ignorieren
            if (requestId !== osmRequestRef.current) return

            setOsmResults(results)
            setOsmSearched(true)


        } catch (error) {
            if (requestId !== osmRequestRef.current) return

            console.error('OSM-Suche fehlgeschlagen:', error)

            const errorMessage =
                error instanceof Error
                    ? error.message
                    : 'Unbekannter Fehler'

            setOsmError(
                `OSM-Suche fehlgeschlagen: ${errorMessage}`
            )



    } finally {
            if (requestId === osmRequestRef.current) {
                setOsmLoading(false)
            }
        }
    }

    // Manuelle OSM-Suche über den bisherigen Button
    const handleSearchOsm = () => {
        if (!selectedLocation || osmLoading) return

        void searchOsmAtLocation(
            selectedLocation.latitude,
            selectedLocation.longitude
        )
    }



    const filteredOsmResults = osmResults.filter(place => {
        const categoryMatches =
            osmCategoryFilter === 'all' ||
            place.category === osmCategoryFilter

        const nameMatches = place.name
            .toLocaleLowerCase('de-DE')
            .includes(
                osmNameFilter.trim().toLocaleLowerCase('de-DE')
            )

        return categoryMatches && nameMatches
    })

// OSM-Treffer mit ähnlichem Namen zum Google-Ort
    const matchingOsmResults = googlePlaceName
        ? filteredOsmResults.filter(place =>
            isSimilarPlaceName(googlePlaceName, place.name)
        )
        : []

// Übrige Treffer aus der Umgebung
    const otherOsmResults = googlePlaceName
        ? filteredOsmResults.filter(place =>
            !isSimilarPlaceName(googlePlaceName, place.name)
        )
        : filteredOsmResults


    const handleSelectOsmPlace = (osmPlace: OsmPlace) => {
        // Vorhandene Bearbeitung beenden
        setEditingPlace(null)

        // OSM-Ort für das Formular merken
        setSelectedOsmPlace(osmPlace)

        // Exakte Koordinaten des gefundenen Ortes übernehmen
        setSelectedLocation({
            latitude: osmPlace.latitude,
            longitude: osmPlace.longitude
        })

        // Bisherigen blauen Auswahlmarker entfernen
        selectionMarkerRef.current?.remove()

        const map = mapRef.current

        if (map) {
            // Blauen Marker an der tatsächlichen OSM-Position setzen
            selectionMarkerRef.current = new Marker({
                color: '#2563EB'
            })
                .setLngLat([
                    osmPlace.longitude,
                    osmPlace.latitude
                ])
                .addTo(map)

            // Karte zum ausgewählten Ort bewegen
            map.flyTo({
                center: [
                    osmPlace.longitude,
                    osmPlace.latitude
                ],
                zoom: 16
            })
        }

    }

    // Google-Maps-Link prüfen und Koordinaten übernehmen

    const handleGoogleMapsImport = () => {
        const result = parseGoogleMapsLink(googleInput)

        if (result.kind === 'invalid') {
            setGoogleMessage(
                'Bitte gib einen gültigen Google-Maps-Link ein.'
            )
            return
        }

        if (result.kind === 'short') {
            setGoogleMessage(
                'Das ist ein verkürzter Link. Öffne ihn im Browser, ' +
                'kopiere die vollständige Adresse und füge sie hier ein.'
            )
            return
        }

        if (result.kind === 'no_coordinates') {
            setGoogleMessage(
                'Der Link enthält keine eindeutig erkennbaren ' +
                'Zielkoordinaten. Bitte überprüfe den Ort manuell.'
            )
            return
        }

        const { latitude, longitude } = result


        // Neues Importformular vorbereiten

// Google-Maps-Daten übernehmen
        const placeName = extractGoogleMapsPlaceName(googleInput)

        setEditingPlace(null)
        setSelectedOsmPlace(null)
        setOsmEnrichment(null)
        setGoogleMapsSuggestion(googleInput.trim())
        setGooglePlaceName(placeName)

// Bisherige OSM-Suchergebnisse zurücksetzen
        osmRequestRef.current += 1
        setOsmResults([])
        setOsmLoading(false)
        setOsmError('')
        setOsmSearched(false)
        setOsmCategoryFilter('all')
        setOsmNameFilter('')



        // Koordinaten übernehmen
        setSelectedLocation({
            latitude,
            longitude
        })


        // Marker setzen
        selectionMarkerRef.current?.remove()

        const map = mapRef.current

        if (map) {
            selectionMarkerRef.current = new Marker({
                color: '#2563EB'
            })
                .setLngLat([longitude, latitude])
                .addTo(map)

            map.flyTo({
                center: [longitude, latitude],
                zoom: 16
            })
        }


        // Hinweis für die Benutzeroberfläche

        setGoogleMessage(
            placeName
                ? `Ort erkannt: ${placeName}. ` +
                'Bitte überprüfe den Marker und ergänze die Angaben im Formular.'
                : 'Koordinaten erkannt. Bitte trage den Namen im Formular ein ' +
                'oder suche bei Bedarf nach OSM-Orten in der Nähe.'
        )





    }



    const renderOsmResult = (place: OsmPlace) => {
        // Prüfen, ob der OSM-Treffer zum Google-Ort passt
        const isGoogleMatch =
            googleMapsSuggestion !== null &&
            googlePlaceName !== null &&
            isSimilarPlaceName(googlePlaceName, place.name)

        return (
            <div
                key={place.osmId}
                className="osm-result"
            >
                <strong>{place.name}</strong>

                <span>
        {categoryLabels[place.category]}

                    {place.cuisine.length > 0 &&
                        ` · ${place.cuisine.join(', ')}`}
      </span>

                <button
                    type="button"
                    className="osm-select-button"
                    onClick={() => {
                        if (isGoogleMatch) {
                            // Fehlende Informationen ergänzen
                            setOsmEnrichment(place)
                        } else {
                            // Vollständigen OSM-Ort übernehmen
                            handleSelectOsmPlace(place)
                        }
                    }}
                >
                    {isGoogleMatch
                        ? 'Fehlende Angaben ergänzen'
                        : 'Ort übernehmen'}
                </button>
            </div>
        )
    }




    return (
        <main className="app">

            {/* Kopfbereich */}
            <header className="app-header">
                <h1>Berlin entdecken</h1>
                <p>Unsere gemeinsame Entdeckerkarte</p>
            </header>


            <section className="google-import">
                <h2>Ort aus Google Maps übernehmen</h2>

                <label htmlFor="google-maps-input">
                    Google-Maps-Link
                </label>

                <div className="google-import-controls">
                    <input
                        id="google-maps-input"
                        type="url"
                        value={googleInput}
                        onChange={event =>
                            setGoogleInput(event.target.value)
                        }
                        placeholder="https://www.google.com/maps/place/..."
                    />

                    <button
                        type="button"
                        onClick={handleGoogleMapsImport}
                        disabled={!googleInput.trim()}
                    >
                        Link prüfen
                    </button>
                </div>

                {googleMessage && (
                    <p>{googleMessage}</p>
                )}
            </section>


            {/* Formular zum Hinzufügen und Bearbeiten */}
            <PlaceForm
                key={
                    editingPlace?.id ??
                    selectedOsmPlace?.osmId ??
                    googleMapsSuggestion ??
                    'new'
                }
                selectedLocation={selectedLocation}
                editingPlace={editingPlace}
                osmSuggestion={selectedOsmPlace}
                googleMapsSuggestion={googleMapsSuggestion}
                googlePlaceName={googlePlaceName}

                osmEnrichment={osmEnrichment}

                onAddPlace={handleAddPlace}
                onUpdatePlace={handleUpdatePlace}
                onCancelEdit={() => setEditingPlace(null)}
            />

            {/* Ausgewählte Koordinaten anzeigen */}
            {selectedLocation && !editingPlace && (
                <div className="location-info">
                    <strong>Ausgewählter Standort:</strong>
                    <span>
            Breitengrad: {selectedLocation.latitude.toFixed(6)}
                        {' · '}
                        Längengrad: {selectedLocation.longitude.toFixed(6)}
          </span>
                </div>
            )}

            {/* NEU: OpenStreetMap-Suche */}
            {selectedLocation && !editingPlace && (
                <section className="osm-search">

                    <button
                        type="button"
                        onClick={handleSearchOsm}
                        disabled={osmLoading}
                    >

                        {osmLoading
                            ? 'Suche läuft ...'
                            : googleMapsSuggestion
                                ? 'Weitere Informationen aus OSM suchen'
                                : 'OSM-Orte in der Nähe suchen'}

                    </button>

                    {/* Fehler anzeigen */}
                    {osmError && (
                        <p className="osm-error">
                            {osmError}
                        </p>
                    )}

                    {/* Gefundene Orte */}

                    {osmResults.length > 0 && (
                        <>
                            {/* Filterbereich */}
                            <div className="osm-filters">

                                <label>
                                    Kategorie
                                    <select
                                        value={osmCategoryFilter}
                                        onChange={e =>
                                            setOsmCategoryFilter(
                                                e.target.value as PlaceCategory | 'all'
                                            )
                                        }
                                    >
                                        <option value="all">Alle Orte</option>
                                        <option value="restaurant">Restaurants</option>
                                        <option value="imbiss">Imbisse</option>
                                        <option value="cafe">Cafés</option>
                                        <option value="bar">Bars</option>
                                        <option value="kneipe">Kneipen</option>
                                    </select>
                                </label>

                                <label>
                                    Nach Namen filtern
                                    <input
                                        type="search"
                                        value={osmNameFilter}
                                        onChange={e => setOsmNameFilter(e.target.value)}
                                        placeholder="z. B. Café ..."
                                    />
                                </label>
                            </div>

                            {/* Ergebnisübersicht */}

                            <div className="osm-results">
                                <h3>
                                    {filteredOsmResults.length} von {osmResults.length}
                                    {' '}Orten angezeigt
                                </h3>

                                {/* Mögliche Treffer zum Google-Maps-Ort */}
                                {googlePlaceName && (
                                    <div className="osm-match-info">
                                        {matchingOsmResults.length > 0 ? (
                                            <p>
                                                Mögliche passende OSM-Einträge für
                                                {' '}<strong>{googlePlaceName}</strong>:
                                            </p>
                                        ) : (
                                            <p>
                                                Kein eindeutiger Namens-Treffer für
                                                {' '}<strong>{googlePlaceName}</strong> gefunden.
                                                Du kannst den Ort trotzdem manuell speichern.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Namensähnliche Treffer zuerst */}
                                {matchingOsmResults.map(renderOsmResult)}

                                {/* Weitere Treffer nur bei Bedarf anzeigen */}
                                {otherOsmResults.length > 0 && (
                                    googlePlaceName ? (
                                        <details className="osm-other-results">
                                            <summary>
                                                Weitere Orte in der Umgebung anzeigen
                                                {' '}({otherOsmResults.length})
                                            </summary>

                                            {otherOsmResults.map(renderOsmResult)}
                                        </details>
                                    ) : (
                                        otherOsmResults.map(renderOsmResult)
                                    )
                                )}

                                {filteredOsmResults.length === 0 && (
                                    <p>
                                        Für diese Filter wurden keine passenden Orte gefunden.
                                    </p>
                                )}
                            </div>

                        </>
                    )}


                    {/* Keine Treffer */}
                    {osmSearched &&
                        !osmLoading &&
                        osmResults.length === 0 &&
                        !osmError && (
                            <p>
                                Im Umkreis von 100 Metern wurden
                                keine passenden Orte gefunden.
                            </p>
                        )}
                </section>
            )}

            {/* Interaktive Berlin-Karte */}
            <div
                ref={mapContainer}
                className="map"
            />

        </main>
    )
}

export default App
