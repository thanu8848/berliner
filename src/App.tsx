
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
import type { Place } from './types/place'

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

// Beschriftungen für Kategorien
const categoryLabels = {
    restaurant: 'Restaurant',
    imbiss: 'Imbiss',
    cafe: 'Café',
    bar: 'Bar',
    kneipe: 'Kneipe'
}

// Beschriftungen für die Entdeckerstatus
const statusLabels = {
    unentdeckt: 'Unentdeckt',
    vorgemerkt: 'Vorgemerkt',
    empfohlen: 'Empfohlen',
    nicht_empfohlen: 'Nicht empfohlen',
}

// Informationsfenster eines Ortes erstellen
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

    // Küche anzeigen
    if (place.cuisine && place.cuisine.length > 0) {
        const cuisine = document.createElement('p')
        cuisine.textContent =
            `Küche: ${place.cuisine.join(', ')}`

        content.append(cuisine)
    }

    // Sitzmöglichkeiten anzeigen
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

    // Optionale Notizen
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

    // Navigation über Google Maps
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

    // Buttons für Bearbeiten und Löschen
    const actions = document.createElement('div')
    actions.className = 'popup-actions'

    // Bearbeiten-Button
    const editButton = document.createElement('button')
    editButton.type = 'button'
    editButton.textContent = 'Bearbeiten'

    editButton.addEventListener('click', (event) => {
        event.stopPropagation()
        onEdit(place)
    })

    // Löschen-Button
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
    // Referenzen für die Karte und ihre Marker
    const mapContainer = useRef<HTMLDivElement | null>(null)
    const mapRef = useRef<Map | null>(null)
    const selectionMarkerRef = useRef<Marker | null>(null)

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

    // Änderungen automatisch lokal speichern
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

    // Aktuell ausgewählter Standort
    const [selectedLocation, setSelectedLocation] = useState<{
        latitude: number
        longitude: number
    } | null>(null)

    // Aktuell bearbeiteter Ort
    const [editingPlace, setEditingPlace] =
        useState<Place | null>(null)

    // Karte einmalig erstellen
    useEffect(() => {
        if (!mapContainer.current) return

        const map = new Map({
            container: mapContainer.current,
            style: 'https://tiles.openfreemap.org/styles/liberty',
            center: [13.405, 52.52],
            zoom: 11
        })

        mapRef.current = map

        // Zoom- und Navigationssteuerung
        map.addControl(new NavigationControl(), 'top-right')

        // Standort über einen Klick auf die Karte auswählen
        map.on('click', (event) => {
            const latitude = event.lngLat.lat
            const longitude = event.lngLat.lng

            setSelectedLocation({
                latitude,
                longitude
            })

            // Alten Auswahlmarker entfernen
            selectionMarkerRef.current?.remove()

            // Neuen Auswahlmarker erstellen
            selectionMarkerRef.current = new Marker({
                color: '#2563EB'
            })
                .setLngLat([longitude, latitude])
                .addTo(map)
        })

        // Ressourcen beim Entfernen der Karte freigeben
        return () => {
            selectionMarkerRef.current?.remove()
            selectionMarkerRef.current = null

            mapRef.current = null
            map.remove()
        }
    }, [])

    // Ortsmarker zeichnen und bei Änderungen aktualisieren
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

                            // Ort bearbeiten
                            (placeToEdit) => {
                                setEditingPlace(placeToEdit)

                                selectionMarkerRef.current?.remove()
                                selectionMarkerRef.current = null

                                setSelectedLocation(null)
                            },

                            // Ort löschen
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

        // Bisherige Marker bei Änderungen entfernen
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

        // Standortauswahl entfernen
        selectionMarkerRef.current?.remove()
        selectionMarkerRef.current = null
        setSelectedLocation(null)

        // Karte zum neuen Ort bewegen
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

    return (
        <main className="app">
            <header className="app-header">
                <h1>Berlin entdecken</h1>
                <p>Unsere gemeinsame Entdeckerkarte</p>
            </header>

            <PlaceForm
                key={editingPlace?.id ?? 'new'}
                selectedLocation={selectedLocation}
                editingPlace={editingPlace}
                onAddPlace={handleAddPlace}
                onUpdatePlace={handleUpdatePlace}
                onCancelEdit={() => setEditingPlace(null)}
            />

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

            <div ref={mapContainer} className="map" />
        </main>
    )
}

export default App
