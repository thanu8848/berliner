
import { useEffect, useRef } from 'react'
import PlaceForm from './components/PlaceForm'
import {
    Map,
    Marker,
    NavigationControl,
    Popup,
    setWorkerUrl,
} from 'maplibre-gl'

import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'

import { places } from './data/places'
import type { Place } from './types/place'

setWorkerUrl(workerUrl)

// Farben für die verschiedenen Entdeckerstatus
const statusColors = {
    unentdeckt: '#969AA1',
    vorgemerkt: '#DCA93E',
    empfohlen: '#2D9B77',
}

// Beschriftungen für die Kategorien
const categoryLabels = {
    restaurant: 'Restaurant',
    imbiss: 'Imbiss',
    cafe: 'Café',
    bar: 'Bar',
    kneipe: 'Kneipe',
}

// Informationsfenster für einen Ort erstellen
function createPlacePopup(place: Place) {
    const content = document.createElement('div')

    const title = document.createElement('h3')
    title.textContent = place.name

    const category = document.createElement('p')
    category.textContent =
        `${categoryLabels[place.category]} · ${place.district}`

    const status = document.createElement('p')
    status.textContent = `Status: ${place.status}`

    const navigation = document.createElement('a')

    const destination = encodeURIComponent(
        `${place.latitude},${place.longitude}`
    )

    navigation.href =
        `https://www.google.com/maps/dir/?api=1&destination=${destination}`

    navigation.target = '_blank'
    navigation.rel = 'noopener noreferrer'
    navigation.textContent = 'Route in Google Maps öffnen'

    content.append(title, category, status)

    if (place.notes) {
        const notes = document.createElement('p')
        notes.textContent = place.notes
        content.append(notes)
    }

    content.append(navigation)

    return content
}

function App() {
    const mapContainer = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!mapContainer.current) return

        const map = new Map({
            container: mapContainer.current,
            style: 'https://tiles.openfreemap.org/styles/liberty',
            center: [13.405, 52.52],
            zoom: 11,
        })

        map.addControl(new NavigationControl(), 'top-right')

        // Für jeden Ort einen Marker erstellen
        places.forEach((place) => {
            new Marker({
                color: statusColors[place.status],
            })
                .setLngLat([place.longitude, place.latitude])
                .setPopup(
                    new Popup({ offset: 25 }).setDOMContent(
                        createPlacePopup(place)
                    )
                )
                .addTo(map)
        })

        return () => map.remove()
    }, [])

    return (
        <main className="app">
            <header className="app-header">
                <h1>Berlin entdecken</h1>
                <p>Unsere gemeinsame Entdeckerkarte</p>
            </header>
            
            <PlaceForm />

            <div ref={mapContainer} className="map" />
        </main>
    )
}

export default App
