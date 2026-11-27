import { categoryLabels, statusLabels } from '../data/placeLabels'
import { translateValidation, clearValidation } from '../i18n'
import { useTranslation } from 'react-i18next'

import { useEffect, useState, useId } from 'react'
import type { FormEvent } from 'react'
import { duplicateConfirmationKey, findPossibleDuplicates } from '../services/placeDuplicates'
import { placeRequirements, validLocation } from '../services/placeValidation'
import PlaceSearch from './PlaceSearch'
import NeighborhoodInput from './NeighborhoodInput'
import type { OsmPlace } from '../services/osm'
import {
    getDistrictForNeighborhood
} from '../data/berlinOrtsteile'

import type {
    Place,
    PlaceCategory,
    PlaceStatus,
    Seating,
    SeatingCapacity
} from '../types/place'

// Informationen, die App.tsx an das Formular übergibt
interface PlaceFormProps {
    active: boolean
    selectedLocation: {
        latitude: number
        longitude: number
    } | null

    editingPlace: Place | null
    osmSuggestion: OsmPlace | null
    allPlaces: Place[]
    onEditExisting: (place: Place) => void
    onCancelNew: () => void
    onAddPlace: (place: Place, confirmedDuplicateKey?: string) => boolean
    onUpdatePlace: (place: Place) => void
    onCancelEdit: () => void
    googleMapsSuggestion: string | null
    googlePlaceName: string | null
    googleAddress: string
    onPickLocation: () => void
    onChooseLocation: (location: { latitude: number; longitude: number }) => void
}

function PlaceForm({
                       active,
                       selectedLocation,
                       editingPlace,
                       osmSuggestion,
                       allPlaces,
                       onEditExisting,
                       onCancelNew,
                       onAddPlace,
                       onUpdatePlace,
                       onCancelEdit,
                       googleMapsSuggestion,
                       googlePlaceName,
                       googleAddress,
                       onPickLocation,
                       onChooseLocation
                   }: PlaceFormProps) {
    const { t } = useTranslation()
    const hintId = useId()

    // Eingabefelder mit vorhandenen Daten initialisieren
    const [name, setName] = useState(
        editingPlace?.name ??
        osmSuggestion?.name ??
        googlePlaceName ??
        ''
    )

    const [category, setCategory] = useState<PlaceCategory>(
        editingPlace?.category ?? osmSuggestion?.category ?? 'restaurant'
    )

    const [categoryChosen, setCategoryChosen] = useState(Boolean(editingPlace || osmSuggestion))
    const [searchOpen, setSearchOpen] = useState(false)
    const [address, setAddress] = useState(editingPlace?.address ?? osmSuggestion?.address ?? googleAddress)
    const [enriched, setEnriched] = useState(false)


    const [cuisine, setCuisine] = useState(
        editingPlace?.cuisine?.join(', ') ?? osmSuggestion?.cuisine?.join(', ') ?? ''
    )

    const [neighborhood, setNeighborhood] = useState(
        editingPlace?.neighborhood ?? (osmSuggestion?.neighborhood && getDistrictForNeighborhood(osmSuggestion.neighborhood) ? osmSuggestion.neighborhood : '')
    )

    const [website, setWebsite] = useState(
        editingPlace?.website ?? osmSuggestion?.website ?? ''
    )


    const [googleMapsUrl, setGoogleMapsUrl] = useState(
        editingPlace?.googleMapsUrl ??
        googleMapsSuggestion ??
        ''
    )



    const [notes, setNotes] = useState(
        editingPlace?.notes ?? ''
    )


    const [status, setStatus] = useState<PlaceStatus>(
        editingPlace?.status ?? 'vorgemerkt'
    )

    // Sitzmöglichkeiten
    const [seating, setSeating] = useState<Seating>(
        editingPlace?.seating?.available ?? 'unknown'
    )

    const [capacity, setCapacity] = useState<SeatingCapacity>(
        editingPlace?.seating?.capacity ?? 'unknown'
    )

    const [indoor, setIndoor] = useState(
        editingPlace?.seating?.indoor ?? false
    )

    const [outdoor, setOutdoor] = useState(
        editingPlace?.seating?.outdoor ?? false
    )

    const [cozy, setCozy] = useState(
        editingPlace?.seating?.cozy ?? false
    )

    const [cramped, setCramped] = useState(
        editingPlace?.seating?.cramped ?? false
    )

    // The parent owns coordinates, so returning to the map never remounts this form.
    const formLocation = validLocation(selectedLocation) ? selectedLocation : null
    const { district, missing } = placeRequirements(name, neighborhood, formLocation, editingPlace?.district)

    function enrichFromCatalog(place: OsmPlace) {
        setName(current => current.trim() ? current : place.name)
        setAddress(current => current.trim() ? current : place.address ?? '')
        setCuisine(current => current.trim() ? current : place.cuisine.join(', '))
        setWebsite(current => current.trim() ? current : place.website ?? '')
        setNeighborhood(current => current || (place.neighborhood && getDistrictForNeighborhood(place.neighborhood) ? place.neighborhood : ''))
        if (!categoryChosen) { setCategory(place.category); setCategoryChosen(true) }
        if (!formLocation) onChooseLocation({ latitude: place.latitude, longitude: place.longitude })
        setEnriched(true)
        setSearchOpen(false)
    }

    const [settledName, setSettledName] = useState(name)
    const [confirmedDuplicateKey, setConfirmedDuplicateKey] = useState<string>()

    // Importierte Namen sind sofort verfügbar; beim Tippen kurz warten.
    useEffect(() => {
        const timeout = window.setTimeout(() => setSettledName(name), 500)
        return () => window.clearTimeout(timeout)
    }, [name])

    const candidate = formLocation ? {
        ...formLocation,
        name: name.trim(),
        googleMapsUrl: googleMapsUrl.trim() || undefined
    } : null
    const duplicates = !editingPlace && candidate && name.trim() && settledName === name
        ? findPossibleDuplicates(candidate, allPlaces)
        : []
    const currentDuplicateKey = candidate ? duplicateConfirmationKey(candidate, duplicates) : ''
    const showDuplicates = duplicates.length > 0 && confirmedDuplicateKey !== currentDuplicateKey

    const editDuplicate = (place: Place) => {
        if (!window.confirm(
            t("Vorhandenen Eintrag bearbeiten? Deine Eingaben für den neuen Ort werden dabei verworfen.")
        )) return
        onEditExisting(place)
    }

    // Formular speichern
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        // Pflichtfelder prüfen
        if (!formLocation || missing.length || !district) {
            return
        }


        // Datensatz erstellen oder vorhandenen aktualisieren
        const placeData: Place = {
            // Vorhandene Informationen beibehalten
            ...(editingPlace ?? {}),

            // Bestehende ID behalten oder neue erzeugen
            id: editingPlace?.id ?? crypto.randomUUID(),

            name: name.trim(),
            category,

            // Mehrere Küchenrichtungen durch Komma trennen
            cuisine: cuisine
                .split(',')
                .map(item => item.trim())
                .filter(Boolean),

            district,
            neighborhood: neighborhood || undefined,
            address: address.trim() || undefined,
            osmId: editingPlace?.osmId ?? osmSuggestion?.osmId,

            latitude: formLocation.latitude,
            longitude: formLocation.longitude,

            status,
            notes: notes.trim() || undefined,
            website: website.trim() || undefined,
            googleMapsUrl: googleMapsUrl.trim() || undefined,

            seating: {
                available: seating,

                ...(seating === 'yes' && {
                    capacity,
                    indoor: indoor || undefined,
                    outdoor: outdoor || undefined,
                    cozy: cozy || undefined,
                    cramped: cramped || undefined
                })
            }
        }

        // Unterscheiden zwischen Bearbeiten und Hinzufügen
        if (editingPlace) {
            onUpdatePlace(placeData)
        } else if (!onAddPlace(placeData, confirmedDuplicateKey)) {
            // Abgebrochen: sämtliche Eingaben unverändert lassen.
            return
        }

        // Parent closes the editor only after a successful save.
    }

    return (
        <div className="place-form">
            <form
                className="place-form-content"
                onSubmit={handleSubmit}
                onInvalidCapture={event => {
                    const field = event.target as HTMLElement
                    const details = field.closest('details')
                    if (details) details.open = true
                    translateValidation(event)
                }}
                onInputCapture={clearValidation}
            >

                {showDuplicates && (
                    <section className="duplicate-notice" aria-label={t("Mögliche Dubletten")}>
                        <p role="status"><strong>{t("Dieser Ort könnte bereits gespeichert sein.")}</strong></p>
                        {duplicates.map(place => (
                            <div key={place.id} className="duplicate-match">
                                <p><strong>{place.name}</strong> · {place.neighborhood ?? place.district}</p>
                                <p>{t('Status: {{status}}', { status: t(statusLabels[place.status]) })}</p>
                                <button type="button" onClick={() => editDuplicate(place)}>
                                    {t("Vorhandenen Eintrag bearbeiten")}
                                </button>
                            </div>
                        ))}
                        <div className="duplicate-actions">
                            <button type="button" onClick={() => setConfirmedDuplicateKey(currentDuplicateKey)}>
                                {t("Als neuen Ort fortfahren")}
                            </button>
                            <button type="button" onClick={onCancelNew}>{t("Abbrechen")}</button>
                        </div>
                    </section>
                )}

                {/* Allgemeine Informationen */}

                <div className="form-grid">

                    <label>
                        {t("Name des Ortes")}
                        <input
                            type="text"
                            value={name}
                            aria-invalid={!name.trim()}
                            aria-describedby={!name.trim() ? `${hintId}-name` : undefined}
                            onChange={e => { setName(e.target.value); setConfirmedDuplicateKey(undefined) }}
                            placeholder={t("z. B. Kebapci Hamdi Baba")}
                            required
                        />
                        {!name.trim() && <small id={`${hintId}-name`} className="field-hint">{t('Bitte gib einen Namen für den Ort ein.')}</small>}
                    </label>

                    <label>
                        {t("Kategorie")}
                        <select
                            value={category}
                            onChange={e => {
                                setCategoryChosen(true)
                                setCategory(e.target.value as PlaceCategory)
                            }}
                        >
                            <option value="restaurant">{t("Restaurant")}</option>
                            <option value="imbiss">{t("Imbiss")}</option>
                            <option value="cafe">{t("Café")}</option>
                            <option value="bar">{t("Bar")}</option>
                            <option value="kneipe">{t("Kneipe")}</option>
                        </select>
                    </label>

                    <label>{t('Adresse (optional)')}<input value={address} onChange={event => setAddress(event.target.value)} placeholder={t('Straße, Hausnummer, Postleitzahl')} /></label>

                    <NeighborhoodInput
                        required={!editingPlace?.district}
                        value={neighborhood}
                        onChange={setNeighborhood}
                    />

                </div>

                <div className="location-summary" aria-describedby={!formLocation ? `${hintId}-location` : undefined}>
                    <span>{t(formLocation ? 'Standort ausgewählt' : 'Noch kein Standort ausgewählt')}</span>
                    <button type="button" onClick={onPickLocation}>{t(formLocation ? 'Auf Karte ändern' : 'Standort auf Karte auswählen')}</button>
                    {!formLocation && <p id={`${hintId}-location`} className="field-hint" role="status">{t('Der Standort fehlt noch. Bitte wähle den Ort auf der Karte oder über die Suche.')}</p>}
                </div>
                <section className="enrichment">
                    <button type="button" aria-expanded={searchOpen} onClick={() => setSearchOpen(open => !open)}>{t(searchOpen ? 'Suche schließen' : 'Anderen Ort suchen')}</button>
                    {!searchOpen && !enriched && googleMapsSuggestion && active && <PlaceSearch automatic name={name} address={address} location={formLocation} onSelect={enrichFromCatalog} />}
                    {enriched && <p role="status">{t('Fehlende Angaben ergänzt. Bitte prüfe die Angaben.')}</p>}
                    {searchOpen && active && <PlaceSearch name={name} location={formLocation} category={categoryChosen ? category : undefined} onSelect={enrichFromCatalog} />}
                </section>
                <details className="extra-fields"><summary>{t('Weitere Angaben (optional)')}</summary>
                    <label>
                        {t("Küche / Angebot")}
                        <input
                            type="text"
                            value={cuisine}
                            onChange={e => setCuisine(e.target.value)}
                            placeholder={t("z. B. Döner, Vietnamesisch")}
                        />
                    </label>

                {/* Sitzmöglichkeiten */}

                <h3>{t("Sitzmöglichkeiten")}</h3>

                <label>
                    {t("Sitzplätze vorhanden?")}
                    <select
                        value={seating}
                        onChange={e =>
                            setSeating(e.target.value as Seating)
                        }
                    >
                        <option value="unknown">{t("Unbekannt")}</option>
                        <option value="yes">{t("Ja")}</option>
                        <option value="no">{t("Nein")}</option>
                    </select>
                </label>

                {seating === 'yes' && (
                    <div className="seating-details">

                        <label>
                            {t("Anzahl der Sitzplätze")}
                            <select
                                value={capacity}
                                onChange={e =>
                                    setCapacity(
                                        e.target.value as SeatingCapacity
                                    )
                                }
                            >
                                <option value="unknown">{t("Unbekannt")}</option>
                                <option value="few">{t("Wenige")}</option>
                                <option value="many">{t("Viele")}</option>
                            </select>
                        </label>

                        <div className="checkbox-group">

                            <label>
                                <input
                                    type="checkbox"
                                    checked={indoor}
                                    onChange={e =>
                                        setIndoor(e.target.checked)
                                    }
                                />
                                {t("Drinnen")}
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={outdoor}
                                    onChange={e =>
                                        setOutdoor(e.target.checked)
                                    }
                                />
                                {t("Draußen")}
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={cozy}
                                    onChange={e =>
                                        setCozy(e.target.checked)
                                    }
                                />
                                {t("Gemütlich")}
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={cramped}
                                    onChange={e =>
                                        setCramped(e.target.checked)
                                    }
                                />
                                {t("Eng")}
                            </label>

                        </div>
                    </div>
                )}

                {/* Weitere Informationen */}

                <h3>{t("Weitere Informationen")}</h3>

                <div className="form-grid">

                    <label>
                        {t("Google-Maps-Link (optional)")}
                        <input
                            type="url"
                            value={googleMapsUrl}
                            onChange={e => {
                                setGoogleMapsUrl(e.target.value)
                                setConfirmedDuplicateKey(undefined)
                            }}
                            placeholder="https://www.google.com/maps/..."
                        />
                    </label>

                    <label>
                        {t("Website (optional)")}
                        <input
                            type="url"
                            value={website}
                            onChange={e =>
                                setWebsite(e.target.value)
                            }
                            placeholder="https://..."
                        />
                    </label>

                    <label>
                        {t("Entdeckerstatus")}
                        <select
                            value={status}
                            onChange={e =>
                                setStatus(e.target.value as PlaceStatus)
                            }
                        >
                            <option value="unentdeckt">
                                {t("Unentdeckt")}
                            </option>
                            <option value="vorgemerkt">
                                {t("Vorgemerkt")}
                            </option>
                            <option value="empfohlen">
                                {t("Empfohlen")}
                            </option>
                            <option value="nicht_empfohlen">
                                {t("Nicht empfohlen")}
                            </option>
                        </select>
                    </label>

                </div>

                <label className="notes-field">
                    {t("Unsere Notizen")}
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder={t("Wie war der Ort? Was hat uns gefallen oder nicht gefallen?")}
                        rows={4}
                    />
                </label>

                </details>

                {/* Vorschau */}

                <details className="place-preview"><summary>{t("Vorschau")}</summary>

                    <strong>
                        {editingPlace
                            ? t("Vorschau der Änderungen")
                            : t("Vorschau des neuen Ortes")}
                    </strong>

                    <p>
                        {name || t("Neuer Ort")} ·
                        {' '}{cuisine || t(categoryLabels[category])} ·
                        {' '}{getDistrictForNeighborhood(neighborhood) ? neighborhood : t("Kein Ortsteil")}
                    </p>

                    <p>{t('Status: {{status}}', { status: t(statusLabels[status]) })}</p>

                    <p>
                        {t("Sitzplätze:")} {
                        seating === 'yes' ? t("Ja") :
                            seating === 'no' ? t("Nein") : t("Unbekannt")
                    }

                        {seating === 'yes' &&
                            ` · ${
                                capacity === 'few' ? t("Wenige") :
                                    capacity === 'many' ? t("Viele") :
                                        t("Anzahl unbekannt")
                            }`}
                    </p>

                    {seating === 'yes' && (
                        <p>
                            {[
                                indoor && t("Drinnen"),
                                outdoor && t("Draußen"),
                                cozy && t("Gemütlich"),
                                cramped && t("Eng")
                            ].filter(Boolean).join(' · ')}
                        </p>
                    )}

                    {notes.trim() && (
                        <p>
                            {t("Notiz:")} {notes}
                        </p>
                    )}

                </details>

                <div className="form-actions">

                {missing.length > 0 && <div id={`${hintId}-missing`} className="validation-summary" role="status">
                    <strong>{t('Zum Speichern fehlt noch:')}</strong>
                    <ul>{missing.map(message => <li key={message}>{t(message)}</li>)}</ul>
                </div>}
                <button
                    type="submit"
                    className="save-place-button"
                    disabled={missing.length > 0}
                    aria-describedby={missing.length ? `${hintId}-missing` : undefined}
                >
                    {editingPlace
                        ? t("Änderungen speichern")
                        : t("Ort hinzufügen")}
                </button>

                <button type="button" className="cancel-edit-button" onClick={editingPlace ? onCancelEdit : onCancelNew}>{t('Abbrechen')}</button>
                </div>

            </form>
        </div>
    )
}

export default PlaceForm
