
import { useEffect, useRef } from 'react'
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

// MapLibre für die Verwendung mit Vite konfigurieren
setWorkerUrl(workerUrl)

function App() {
  const mapContainer = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!mapContainer.current) return

    // Karte erstellen
    const map = new Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [13.405, 52.52],
      zoom: 11,
    })

    // Zoom- und Navigationssteuerung
    map.addControl(new NavigationControl(), 'top-right')

    // Erster Testmarker: Brandenburger Tor
    new Marker({ color: '#D97757' })
        .setLngLat([13.3777, 52.5163])
        .setPopup(
            new Popup({ offset: 25 }).setText(
                'Brandenburger Tor – unser erster Testmarker!'
            )
        )
        .addTo(map)

    // Karte beim Verlassen der Komponente aufräumen
    return () => map.remove()
  }, [])

  return (
      <main className="app">
        <header className="app-header">
          <h1>Berlin entdecken</h1>
          <p>Unsere gemeinsame Entdeckerkarte</p>
        </header>

        <div ref={mapContainer} className="map" />
      </main>
  )
}

export default App
