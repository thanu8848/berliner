import type { AddressLocation } from './services/addressLookup'
import { validLocation } from './services/placeValidation'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './components/LanguageSwitcher'
import EditorPanel from './components/EditorPanel'
import MapView from './components/MapView'
import type { Location } from './components/MapView'
import PlaceForm from './components/PlaceForm'
import PlaceSearch from './components/PlaceSearch'
import { places } from './data/places'
import type { Place } from './types/place'
import type { OsmPlace } from './services/osm'
import { duplicateConfirmationKey, findPossibleDuplicates } from './services/placeDuplicates'
import { parseGoogleMapsLink, extractGoogleMapsPlaceName, splitPlaceLabel, resolveGoogleMapsLink } from './services/googleMaps'
import { googleMapsUrl } from './services/googleMapsUrls'
import './App.css'

const STORAGE_KEY = 'berlin-entdecken-places-v1'
interface Draft {
    key: string
    location: Location | null
    editing: Place | null
    suggestion: OsmPlace | null
    googleUrl: string | null
    name: string | null
    address: string
}
const emptyDraft = (): Draft => ({ key: crypto.randomUUID(), location: null, editing: null, suggestion: null, googleUrl: null, name: null, address: '' })
type Screen = 'choose' | 'google' | 'catalog' | 'form'

export default function App() {
    const { t } = useTranslation()
    const [allPlaces, setAllPlaces] = useState<Place[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            const parsed: unknown = saved ? JSON.parse(saved) : null
            return Array.isArray(parsed) ? parsed : places
        } catch { return places }
    })
    const [storageError, setStorageError] = useState(false)
    function persistPlaces(next: Place[]): boolean {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
            setAllPlaces(next)
            setStorageError(false)
            return true
        } catch { setStorageError(true); return false }
    }
    const [draft, setDraft] = useState<Draft | null>(null)
    const [panelOpen, setPanelOpen] = useState(false)
    const [screen, setScreen] = useState<Screen>('choose')
    const [addressPreview, setAddressPreview] = useState<(AddressLocation & { name: string }) | null>(null)
    const [picking, setPicking] = useState(false)
    const [googleInput, setGoogleInput] = useState('')
    const [importMessage, setImportMessage] = useState('')
    const [importing, setImporting] = useState(false)
    const importRequest = useRef<AbortController | null>(null)
    useEffect(() => () => importRequest.current?.abort(), [])

    function stopImport() {
        importRequest.current?.abort()
        importRequest.current = null
        setImporting(false)
    }
    function finishDraft() {
        stopImport()
        setDraft(null)
        setAddressPreview(null)
        setPicking(false)
        setPanelOpen(false)
        setScreen('choose')
        setImportMessage('')
        setGoogleInput('')
    }
    function startPicking() {
        setAddressPreview(null)
        if (!draft) setDraft(emptyDraft())
        setPicking(true)
        setPanelOpen(false)
        setScreen('form')
    }
    function selectLocation(location: Location) {
        if (!validLocation(location)) return
        setAddressPreview(null)
        setDraft(current => ({ ...(current ?? emptyDraft()), location }))
        setPicking(false)
        setScreen('form')
        setPanelOpen(true)
    }
    function editPlace(place: Place) {
        if (draft && !window.confirm(t('Vorhandenen Eintrag bearbeiten? Deine Eingaben für den neuen Ort werden dabei verworfen.'))) return
        openExisting(place)
    }
    function openExisting(place: Place) {
        setAddressPreview(null)
        stopImport()
        setDraft({ ...emptyDraft(), editing: place, location: { latitude: place.latitude, longitude: place.longitude } })
        setPicking(false)
        setImportMessage('')
        setScreen('form')
        setPanelOpen(true)
    }
    function addPlace(place: Place, confirmedKey?: string): boolean {
        const duplicates = findPossibleDuplicates(place, allPlaces)
        if (duplicates.length && confirmedKey !== duplicateConfirmationKey(place, duplicates)) {
            const names = duplicates.map(p => `„${p.name}“`).join(', ')
            if (!window.confirm(t('Dieser Ort könnte bereits in deiner Sammlung vorhanden sein.\n\nVorhandene Orte: {{names}}\n\nTrotzdem hinzufügen? Mit OK hinzufügen oder mit Abbrechen zurück zum Formular.', { names }))) return false
        }
        if (!persistPlaces([...allPlaces, place])) return false
        finishDraft()
        return true
    }
    function updatePlace(place: Place) {
        if (!persistPlaces(allPlaces.map(existing => existing.id === place.id ? place : existing))) return
        finishDraft()
    }
    function deletePlace(place: Place) {
        if (!window.confirm(t('Möchtest du „{{name}}“ wirklich löschen?', { name: place.name }))) return
        if (!persistPlaces(allPlaces.filter(existing => existing.id !== place.id))) return
        if (draft?.editing?.id === place.id) finishDraft()
    }
    function chooseCatalog(place: OsmPlace): boolean {
        if ((draft || googleInput.trim()) && !window.confirm(t('Diesen Ort übernehmen? Deine bisherigen, ungespeicherten Eingaben werden dabei verworfen.'))) return false
        stopImport()
        setImportMessage('')
        setGoogleInput('')
        setPicking(false)
        setPanelOpen(true)
        setDraft({ ...emptyDraft(), suggestion: place, location: { latitude: place.latitude, longitude: place.longitude } })
        setScreen('form')
        return true
    }
    async function importGoogle() {
        const original = googleMapsUrl(googleInput)
        if (!original) { setImportMessage('Bitte gib einen gültigen Google-Maps-Link ein.'); return }
        stopImport()
        const controller = new AbortController()
        importRequest.current = controller
        setImporting(true)
        setImportMessage('')
        const timer = window.setTimeout(() => controller.abort(), 9000)
        let resolved = original.href
        let message = ''
        try {
            resolved = await resolveGoogleMapsLink(original.href, import.meta.env.VITE_MAPS_RESOLVER_URL, controller.signal)
        } catch (error) {
            if (importRequest.current !== controller) return
            message = error instanceof Error && error.message === 'resolver_unconfigured'
                ? 'Link übernommen. Die Kurzlink-Auflösung ist noch nicht freigeschaltet. Nutze die Suche oder die Karte.'
                : 'Link übernommen. Der Ort konnte nicht automatisch erkannt werden. Nutze die Suche oder die Karte.'
        } finally { clearTimeout(timer) }
        if (importRequest.current !== controller) return
        const result = parseGoogleMapsLink(resolved)
        const label = splitPlaceLabel(extractGoogleMapsPlaceName(resolved))
        setDraft({ ...emptyDraft(), googleUrl: original.href, name: label.name || null, address: label.address,
            location: result.kind === 'coordinates' ? { latitude: result.latitude, longitude: result.longitude } : null })
        setImportMessage(message || (result.kind === 'coordinates'
            ? 'Angaben erkannt. Bitte prüfe Name und Standort vor dem Speichern.'
            : 'Link übernommen. Bitte prüfe und vervollständige die Angaben unten.'))
        setImporting(false)
        importRequest.current = null
        setScreen('form')
    }
    const panelTitle = screen === 'choose' ? t('Ort hinzufügen') : screen === 'google' ? t('Mit Google Maps hinzufügen') : screen === 'catalog' ? t('Berliner Ortskatalog') : t(draft?.editing ? 'Ort bearbeiten' : 'Angaben prüfen')
    return <main className="app">
        <header className="app-header"><div><h1>Berliner<span className="brand-dot">.</span></h1><p>{t('Deine Stadt. Deine Lieblingsorte.')}</p></div><LanguageSwitcher /></header>
        {storageError && <p className="storage-error" role="alert">{t('Speichern im Browser fehlgeschlagen. Bitte sichere deine Eingaben, bevor du die Seite schließt.')}</p>}
        <div className="map-stage">
            <MapView onChoosePlace={chooseCatalog} places={allPlaces} selection={addressPreview ?? draft?.location ?? null} picking={picking || Boolean(addressPreview)} draggableSelection={Boolean(addressPreview)} onPick={point => addressPreview ? setAddressPreview(current => current ? { ...current, ...point } : null) : selectLocation(point)} onEdit={editPlace} onDelete={deletePlace} />
            {addressPreview ? <div className="map-pick-card address-confirmation">
                <strong>{t('Möglichen Standort gefunden')}</strong>
                <span>{addressPreview.name || t('Neuer Ort')} · {addressPreview.address}</span>
                <small>{t(addressPreview.approximate ? 'Nur ungefähr: Bitte setze den Marker am richtigen Gebäude.' : 'Bitte prüfe das Gebäude. Du kannst den Marker verschieben oder auf die Karte tippen.')}</small>
                <small>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></small>
                <button className="primary-button" onClick={() => { if (!draft?.location) selectLocation(addressPreview) }}>{t('Standort bestätigen')}</button>
                <button onClick={() => { setAddressPreview(null); setPanelOpen(true) }}>{t('Zurück zum Formular')}</button>
            </div> : picking ? <div className="map-pick-card"><strong>{t('Tippe auf den Standort des Ortes.')}</strong><button onClick={() => { setPicking(false); setPanelOpen(true) }}>{t('Zurück zum Formular')}</button></div>
                : <button className="add-place-fab" onClick={() => { setScreen(draft ? 'form' : 'choose'); setPanelOpen(true) }}>{t(draft ? 'Eintragung fortsetzen' : '+ Ort hinzufügen')}</button>}
        </div>
        <EditorPanel open={panelOpen} title={panelTitle} onClose={() => { stopImport(); setPanelOpen(false) }}>
            {screen === 'choose' && <div className="entry-options"><p className="panel-intro">{t('Wie möchtest du den Ort hinzufügen?')}</p>
                <button className="entry-option" onClick={() => setScreen('google')}><strong>{t('Mit Google Maps hinzufügen')}</strong><span>{t('Teilen-Link einfügen und Angaben prüfen')}</span></button>
                <button className="entry-option" onClick={startPicking}><strong>{t('Ort selbst hinzufügen')}</strong><span>{t('Standort auf der Karte auswählen')}</span></button>
                <button className="entry-option" onClick={() => setScreen('catalog')}><strong>{t('Im Berliner Ortskatalog suchen')}</strong><span>{t('Restaurants, Cafés und Bars direkt finden')}</span></button>
                <small>{t('Deine Einträge bleiben vorerst in diesem Browser gespeichert.')}</small>
            </div>}
            {screen === 'google' && <section className="google-import"><p>{t('Kopiere den Link über „Teilen“ in Google Maps und füge ihn hier ein.')}</p>
                <label>{t('Google-Maps-Link')}<textarea value={googleInput} rows={3} placeholder="https://maps.app.goo.gl/…" onChange={event => { stopImport(); setGoogleInput(event.target.value); setImportMessage('') }} /></label>
                {importMessage && <p role="status">{t(importMessage)}</p>}
                <button className="primary-button" disabled={!googleInput.trim() || importing} onClick={() => void importGoogle()}>{t(importing ? 'Link wird geprüft …' : 'Link prüfen')}</button>
                {importing && <button onClick={stopImport}>{t('Abbrechen')}</button>}
                <button className="text-button" onClick={() => { stopImport(); setScreen('choose') }}>{t('Andere Methode wählen')}</button>
            </section>}
            {screen === 'catalog' && panelOpen && <><PlaceSearch onSelect={chooseCatalog} /><button className="text-button" onClick={startPicking}>{t('Stattdessen auf der Karte auswählen')}</button></>}
            {draft && <div hidden={screen !== 'form'}>
                {storageError && <p role="alert">{t('Speichern im Browser fehlgeschlagen. Bitte sichere deine Eingaben, bevor du die Seite schließt.')}</p>}
                {importMessage && <p className="import-hint" role="status">{t(importMessage)}</p>}
                <PlaceForm onPreviewAddress={(place, name) => {
                    if (draft.location) return
                    setAddressPreview({ ...place, name }); setPicking(false); setPanelOpen(false)
                }} active={panelOpen && screen === 'form'} key={draft.key} selectedLocation={draft.location} editingPlace={draft.editing} osmSuggestion={draft.suggestion}
                    googleMapsSuggestion={draft.googleUrl} googlePlaceName={draft.name} googleAddress={draft.address}
                    allPlaces={allPlaces} onEditExisting={openExisting} onCancelNew={finishDraft} onAddPlace={addPlace}
                    onUpdatePlace={updatePlace} onCancelEdit={finishDraft} onPickLocation={startPicking} onChooseLocation={location => setDraft(current => current ? { ...current, location } : current)} />
            </div>}
        </EditorPanel>
    </main>
}
