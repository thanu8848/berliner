import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Map, Marker, NavigationControl, GeolocateControl, Popup, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import i18n from '../i18n'
import { bindMapLanguage } from '../services/mapLanguage'
import { createPlacePopup } from '../services/placePopup'
import type { Place } from '../types/place'
setWorkerUrl(workerUrl)
export interface Location { latitude: number; longitude: number }
interface Props {
    places: Place[]
    selection: Location | null
    picking: boolean
    onPick: (point: Location) => void
    onEdit: (place: Place) => void
    onDelete: (place: Place) => void
}
const colors = { unentdeckt: '#969AA1', vorgemerkt: '#DCA93E', empfohlen: '#2D9B77', nicht_empfohlen: '#C45B58' }
export default function MapView(props: Props) {
    const container = useRef<HTMLDivElement>(null)
    const mapRef = useRef<Map | null>(null)
    const latest = useRef(props)
    useEffect(() => { latest.current = props })
    const [locationError, setLocationError] = useState('')
    const { t } = useTranslation()
    useEffect(() => {
        if (!container.current) return
        const map = new Map({ container: container.current, style: 'https://tiles.openfreemap.org/styles/liberty', center: [13.405, 52.52], zoom: 11 })
        mapRef.current = map
        map.addControl(new NavigationControl(), 'top-right')
        const locate = new GeolocateControl({ trackUserLocation: false, showUserLocation: true, positionOptions: { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 } })
        map.addControl(locate, 'top-right')
        locate.on('geolocate', () => setLocationError(''))
        locate.on('error', () => setLocationError('Standort nicht verfügbar. Du kannst die Karte weiterhin verwenden.'))
        map.on('click', event => {
            // Marker/control clicks must never silently move the restaurant location.
            const target = event.originalEvent.target as HTMLElement
            if (target.closest('.maplibregl-marker, .maplibregl-popup, .maplibregl-ctrl')) return
            if (latest.current.picking) latest.current.onPick({ latitude: event.lngLat.lat, longitude: event.lngLat.lng })
        })
        const unbind = bindMapLanguage(map.getContainer())
        const resize = new ResizeObserver(() => map.resize())
        resize.observe(container.current)
        return () => { unbind(); resize.disconnect(); map.remove(); mapRef.current = null }
    }, [])
    useEffect(() => {
        const map = mapRef.current
        if (!map) return
        const updates: Array<() => void> = []
        const markers = props.places.map(place => {
            const content = () => createPlacePopup(place, p => latest.current.onEdit(p), p => latest.current.onDelete(p))
            const popup = new Popup({ offset: 25 }).setDOMContent(content())
            const marker = new Marker({ color: colors[place.status] }).setLngLat([place.longitude, place.latitude]).setPopup(popup).addTo(map)
            updates.push(() => popup.setDOMContent(content()))
            return marker
        })
        const refresh = () => updates.forEach(update => update())
        i18n.on('languageChanged', refresh)
        return () => { i18n.off('languageChanged', refresh); markers.forEach(marker => marker.remove()) }
    }, [props.places])
    useEffect(() => {
        const map = mapRef.current
        if (!map || !props.selection) return
        const { longitude, latitude } = props.selection
        const marker = new Marker({ color: '#2563eb' }).setLngLat([longitude, latitude]).addTo(map)
        map.flyTo({ center: [longitude, latitude], zoom: Math.max(15, map.getZoom()), essential: false })
        return () => { marker.remove() }
    }, [props.selection])
    return <>
        <div ref={container} className={`map ${props.picking ? 'is-picking' : ''}`} />
        {locationError && <div className="map-message" role="status">{t(locationError)} <button onClick={() => setLocationError('')}>{t('Schließen')}</button></div>}
    </>
}
