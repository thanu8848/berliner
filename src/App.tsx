
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

setWorkerUrl(workerUrl)

const STORAGE_KEY = 'berlin-entdecken-places-v1'

const statusColors = {
    unentdeckt: '#969AA1',
    vorgemerkt: '#DCA93E',
    empfohlen: '#2D9B77'
}

const categoryLabels = {
    restaurant: 'Restaurant',
    imbiss: 'Imbiss',
    cafe: 'Café',
    bar: 'Bar',
    kneipe: 'Kneipe'
}

function createPlacePopup(place: Place) {
    const content = document.createElement('div')

    const title = document.createElement('h3')
    title.textContent = place.name

    const category = document.createElement('p')
    category.textContent =
        `${categoryLabels[place.category]} · ${place.district}`

    const status = document.createElement('p')
    status.textContent = `Status: ${place.status}`

    content.append(title, category, status)

    if (place.cuisine) {
        const cuisine = document.createElement('p')
        cuisine.textContent = `Küche: ${place.cuisine}`
        content.append(cuisine)
    }

    if (place.notes) {
        const notes = document.createElement('p')
        notes.textContent = place.notes
        content.append(notes)
    }

    const navigation = document.createElement('a')
    const destination = encodeURIComponent(
        `${place.latitude},${place.longitude}`
    )

    navigation.href =
        `https://www.google.com/maps/dir/?api=1&destination=${destination}`

    navigation.target = '_blank'
    navigation.rel = 'noopener noreferrer'
    navigation.textContent = 'Route in Google Maps öffnen'

    content.append(navigation)

    return content
}

function App() {
    const mapContainer = useRef<HTMLDivElement | null>(null)
    const mapRef = useRef<Map | null>(null)
    const selectionMarkerRef = useRef<Marker | null>(null)


    // Unsere Ortsliste aus localStorage laden
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

    // Ortsliste automatisch in localStorage speichern
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

        map.addControl(new NavigationControl(), 'top-right')

        // Standort durch Klick auswählen
        map.on('click', (event) => {
            const latitude = event.lngLat.lat
            const longitude = event.lngLat.lng

            setSelectedLocation({ latitude, longitude })

            selectionMarkerRef.current?.remove()

            selectionMarkerRef.current = new Marker({
                color: '#2563EB'
            })
                .setLngLat([longitude, latitude])
                .addTo(map)
        })

        return () => {
            selectionMarkerRef.current?.remove()
            selectionMarkerRef.current = null
            mapRef.current = null
            map.remove()
        }
    }, [])

    // Marker aktualisieren, wenn sich die Ortsliste ändert
    useEffect(() => {
        const map = mapRef.current
        if (!map) return

        const markers = allPlaces.map((place) => {
            return new Marker({
                color: statusColors[place.status]
            })
                .setLngLat([place.longitude, place.latitude])
                .setPopup(
                    new Popup({ offset: 25 }).setDOMContent(
                        createPlacePopup(place)
                    )
                )
                .addTo(map)
        })

        return () => {
            markers.forEach(marker => marker.remove())
        }
    }, [allPlaces])

    // Neuen Ort aus dem Formular übernehmen
    const handleAddPlace = (newPlace: Place) => {
        setAllPlaces(previousPlaces => [
            ...previousPlaces,
            newPlace
        ])

        // Auswahlmarker entfernen
        selectionMarkerRef.current?.remove()
        selectionMarkerRef.current = null
        setSelectedLocation(null)

        // Karte auf den neuen Ort zentrieren
        mapRef.current?.flyTo({
            center: [newPlace.longitude, newPlace.latitude],
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
                selectedLocation={selectedLocation}
                onAddPlace={handleAddPlace}
            />

            {selectedLocation && (
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
