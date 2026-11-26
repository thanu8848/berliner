import { bindMapLanguage } from './services/mapLanguage'
import { categoryLabels, statusLabels } from './data/placeLabels'
import { useTranslation } from 'react-i18next'
import i18n from './i18n'
import LanguageSwitcher from './components/LanguageSwitcher'

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
import { duplicateConfirmationKey, findPossibleDuplicates, isSimilarPlaceName } from './services/placeDuplicates'
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

// Informationsfenster für einen gespeicherten Ort
function createPlacePopup(
    place: Place,
    onEdit: (place: Place) => void,
    onDelete: (place: Place) => void
) {
    const t = i18n.t.bind(i18n)
    const content = document.createElement('div')

    // Name
    const title = document.createElement('h3')
    title.textContent = place.name

    // Kategorie und Bezirk
    const category = document.createElement('p')
    category.textContent =
        `${t(categoryLabels[place.category])} · ${place.neighborhood ?? place.district}`

    // Entdeckerstatus
    const status = document.createElement('p')
    status.textContent =
        t('Status: {{status}}', { status: t(statusLabels[place.status]) })

    content.append(title, category, status)

    // Küche
    if (place.cuisine && place.cuisine.length > 0) {
        const cuisine = document.createElement('p')
        cuisine.textContent =
            t('Küche: {{cuisine}}', { cuisine: place.cuisine.join(', ') })

        content.append(cuisine)
    }

    // Sitzmöglichkeiten
    if (place.seating) {
        const seating = document.createElement('p')

        const seatingLabels = {
            yes: t("Ja"),
            no: t("Nein"),
            unknown: t("Unbekannt")
        }

        seating.textContent =
            t('Sitzplätze: {{seating}}', { seating: seatingLabels[place.seating.available] })

        content.append(seating)

        if (place.seating.available === 'yes') {
            const details: string[] = []

            if (place.seating.capacity === 'few') {
                details.push(t("Wenige Sitzplätze"))
            }

            if (place.seating.capacity === 'many') {
                details.push(t("Viele Sitzplätze"))
            }

            if (place.seating.indoor) {
                details.push(t("Drinnen"))
            }

            if (place.seating.outdoor) {
                details.push(t("Draußen"))
            }

            if (place.seating.cozy) {
                details.push(t("Gemütlich"))
            }

            if (place.seating.cramped) {
                details.push(t("Eng"))
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
        website.textContent = t("Website öffnen")

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
    navigation.textContent = t("Route in Google Maps öffnen")

    const navigationContainer = document.createElement('p')
    navigationContainer.append(navigation)

    content.append(navigationContainer)

    // Aktionen: Bearbeiten und Löschen
    const actions = document.createElement('div')
    actions.className = 'popup-actions'

    const editButton = document.createElement('button')
    editButton.type = 'button'
    editButton.textContent = t("Bearbeiten")

    editButton.addEventListener('click', (event) => {
        event.stopPropagation()
        onEdit(place)
    })

    const deleteButton = document.createElement('button')
    deleteButton.type = 'button'
    deleteButton.textContent = t("Löschen")

    deleteButton.addEventListener('click', (event) => {
        event.stopPropagation()
        onDelete(place)
    })

    actions.append(editButton, deleteButton)
    content.append(actions)

    return content
}

function App() {
    const { t } = useTranslation()
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

        const unbindMapLanguage = bindMapLanguage(map.getContainer())
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
            unbindMapLanguage()
            map.remove()
        }
    }, [])

    // Gespeicherte Ortsmarker erstellen und aktualisieren
    useEffect(() => {
        const map = mapRef.current

        if (!map) return

        const refreshPopups: Array<() => void> = []
        const markers = allPlaces.map((place) => {
            const renderPopup = () => createPlacePopup(
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
                                    i18n.t('Möchtest du „{{name}}“ wirklich löschen?', { name: placeToDelete.name })
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
            const marker = new Marker({
                color: statusColors[place.status]
            })
                .setLngLat([
                    place.longitude,
                    place.latitude
                ])
                .setPopup(
                    new Popup({ offset: 25 }).setDOMContent(renderPopup())
                )
                .addTo(map)
            refreshPopups.push(() => marker.getPopup()?.setDOMContent(renderPopup()))
            return marker
        })
        const refresh = () => refreshPopups.forEach(update => update())
        i18n.on('languageChanged', refresh)

        // Alte Marker bei Änderungen entfernen
        return () => {
            i18n.off('languageChanged', refresh)
            markers.forEach(marker => marker.remove())
        }
    }, [allPlaces])

    const [newPlaceVersion, setNewPlaceVersion] = useState(0)

    // Neue Eintragung vollständig beenden, ohne gespeicherte Orte zu verändern.
    const resetNewPlace = () => {
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

        setGoogleInput('')
        setGoogleMessage('')
        setOsmNameFilter('')
        setOsmCategoryFilter('all')
        setNewPlaceVersion(version => version + 1)
    }

    const editExistingPlace = (place: Place) => {
        resetNewPlace()
        setEditingPlace(place)
        mapRef.current?.flyTo({ center: [place.longitude, place.latitude], zoom: 14 })
    }

    // Neuen Ort hinzufügen
    const handleAddPlace = (newPlace: Place, confirmedDuplicateKey?: string): boolean => {
        const duplicates = findPossibleDuplicates(newPlace, allPlaces)

        if (duplicates.length > 0 && confirmedDuplicateKey !== duplicateConfirmationKey(newPlace, duplicates)) {
            const existingNames = duplicates.map(place => `„${place.name}“`).join(', ')
            const confirmed = window.confirm(
                t("Dieser Ort könnte bereits in deiner Sammlung vorhanden sein.\n\nVorhandene Orte: {{names}}\n\nTrotzdem hinzufügen? Mit OK hinzufügen oder mit Abbrechen zurück zum Formular.", { names: existingNames })
            )

            // Vor jeder Zustandsänderung abbrechen, damit auch die Auswahl erhalten bleibt.
            if (!confirmed) return false
        }

        setAllPlaces(previousPlaces => [
            ...previousPlaces,
            newPlace
        ])

        resetNewPlace()

        // Karte auf den neuen Ort zentrieren
        mapRef.current?.flyTo({
            center: [
                newPlace.longitude,
                newPlace.latitude
            ],
            zoom: 14
        })

        return true
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

            setOsmError('Die OSM-Suche ist fehlgeschlagen. Bitte versuche es erneut.')



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
                "Das ist ein verkürzter Link. Öffne ihn im Browser, kopiere die vollständige Adresse und füge sie hier ein."
            )
            return
        }

        if (result.kind === 'no_coordinates') {
            setGoogleMessage(
                "Der Link enthält keine eindeutig erkennbaren Zielkoordinaten. Bitte überprüfe den Ort manuell."
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

        setGoogleMessage(placeName
            ? 'Ort erkannt: {{name}}. Bitte überprüfe den Marker und ergänze die Angaben im Formular.'
            : 'Koordinaten erkannt. Bitte trage den Namen im Formular ein oder suche bei Bedarf nach OSM-Orten in der Nähe.')





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
        {t(categoryLabels[place.category])}

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
                        ? t("Fehlende Angaben ergänzen")
                        : t("Ort übernehmen")}
                </button>
            </div>
        )
    }




    return (
        <main className="app">

            {/* Kopfbereich */}
            <header className="app-header">
                <LanguageSwitcher />
                <h1>Berliner</h1>
                <p>{t("Unsere gemeinsame Entdeckerkarte")}</p>
            </header>


            <section className="google-import">
                <h2>{t("Ort aus Google Maps übernehmen")}</h2>

                <label htmlFor="google-maps-input">
                    {t("Google-Maps-Link")}
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
                        {t("Link prüfen")}
                    </button>
                </div>

                {googleMessage && (
                    <p>{t(googleMessage, { name: googlePlaceName })}</p>
                )}
            </section>


            {/* Formular zum Hinzufügen und Bearbeiten */}
            <PlaceForm
                key={
                    editingPlace?.id ??
                    selectedOsmPlace?.osmId ??
                    googleMapsSuggestion ??
                    `new-${newPlaceVersion}`
                }
                selectedLocation={selectedLocation}
                editingPlace={editingPlace}
                osmSuggestion={selectedOsmPlace}
                googleMapsSuggestion={googleMapsSuggestion}
                googlePlaceName={googlePlaceName}

                osmEnrichment={osmEnrichment}

                allPlaces={allPlaces}
                onEditExisting={editExistingPlace}
                onCancelNew={resetNewPlace}
                onAddPlace={handleAddPlace}
                onUpdatePlace={handleUpdatePlace}
                onCancelEdit={() => setEditingPlace(null)}
            />

            {/* Ausgewählte Koordinaten anzeigen */}
            {selectedLocation && !editingPlace && (
                <div className="location-info">
                    <strong>{t("Ausgewählter Standort:")}</strong>
                    <span>
            {t("Breitengrad:")} {selectedLocation.latitude.toFixed(6)}
                        {' · '}
                        {t("Längengrad:")} {selectedLocation.longitude.toFixed(6)}
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
                            ? t("Suche läuft ...")
                            : googleMapsSuggestion
                                ? t("Weitere Informationen aus OSM suchen")
                                : t("OSM-Orte in der Nähe suchen")}

                    </button>

                    {/* Fehler anzeigen */}
                    {osmError && (
                        <p className="osm-error">
                            {t(osmError)}
                        </p>
                    )}

                    {/* Gefundene Orte */}

                    {osmResults.length > 0 && (
                        <>
                            {/* Filterbereich */}
                            <div className="osm-filters">

                                <label>
                                    {t("Kategorie")}
                                    <select
                                        value={osmCategoryFilter}
                                        onChange={e =>
                                            setOsmCategoryFilter(
                                                e.target.value as PlaceCategory | 'all'
                                            )
                                        }
                                    >
                                        <option value="all">{t("Alle Orte")}</option>
                                        <option value="restaurant">{t("Restaurants")}</option>
                                        <option value="imbiss">{t("Imbisse")}</option>
                                        <option value="cafe">{t("Cafés")}</option>
                                        <option value="bar">{t("Bars")}</option>
                                        <option value="kneipe">{t("Kneipen")}</option>
                                    </select>
                                </label>

                                <label>
                                    {t("Nach Namen filtern")}
                                    <input
                                        type="search"
                                        value={osmNameFilter}
                                        onChange={e => setOsmNameFilter(e.target.value)}
                                        placeholder={t("z. B. Café ...")}
                                    />
                                </label>
                            </div>

                            {/* Ergebnisübersicht */}

                            <div className="osm-results">
                                <h3>
                                    {t('{{shown}} von {{total}} Orten angezeigt', { shown: filteredOsmResults.length, total: osmResults.length })}
                                </h3>

                                {/* Mögliche Treffer zum Google-Maps-Ort */}
                                {googlePlaceName && (
                                    <div className="osm-match-info">
                                        {matchingOsmResults.length > 0 ? (
                                            <p>
                                                {t('Mögliche passende OSM-Einträge für {{name}}:', { name: googlePlaceName })}
                                            </p>
                                        ) : (
                                            <p>
                                                {t('Kein eindeutiger Namens-Treffer für {{name}} gefunden. Du kannst den Ort trotzdem manuell speichern.', { name: googlePlaceName })}
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
                                                {t("Weitere Orte in der Umgebung anzeigen")}
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
                                        {t("Für diese Filter wurden keine passenden Orte gefunden.")}
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
                                {t("Im Umkreis von 100 Metern wurden keine passenden Orte gefunden.")}
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
