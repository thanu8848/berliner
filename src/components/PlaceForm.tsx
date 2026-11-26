import { categoryLabels, statusLabels } from '../data/placeLabels'
import { translateValidation, clearValidation } from '../i18n'
import { useTranslation } from 'react-i18next'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { duplicateConfirmationKey, findPossibleDuplicates } from '../services/placeDuplicates'
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
    selectedLocation: {
        latitude: number
        longitude: number
    } | null

    editingPlace: Place | null
    osmSuggestion: OsmPlace | null
    osmEnrichment: OsmPlace | null
    allPlaces: Place[]
    onEditExisting: (place: Place) => void
    onCancelNew: () => void
    onAddPlace: (place: Place, confirmedDuplicateKey?: string) => boolean
    onUpdatePlace: (place: Place) => void
    onCancelEdit: () => void
    googleMapsSuggestion: string | null
    googlePlaceName: string | null
}

function PlaceForm({
                       selectedLocation,
                       editingPlace,
                       osmSuggestion,
                       osmEnrichment,
                       allPlaces,
                       onEditExisting,
                       onCancelNew,
                       onAddPlace,
                       onUpdatePlace,
                       onCancelEdit,
                       googleMapsSuggestion,
                       googlePlaceName
                   }: PlaceFormProps) {
    const { t } = useTranslation()

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

    const categoryEditedRef = useRef(false)


    const [cuisine, setCuisine] = useState(
        editingPlace?.cuisine?.join(', ') ?? osmSuggestion?.cuisine?.join(', ') ?? ''
    )

    const [neighborhood, setNeighborhood] = useState(
        editingPlace?.neighborhood ?? ''
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

    // Referenz zum ausklappbaren Formular
    const detailsRef = useRef<HTMLDetailsElement>(null)

    // Formular automatisch öffnen, wenn ein Ort bearbeitet wird

    useEffect(() => {
        if (
            (editingPlace || osmSuggestion || googleMapsSuggestion) &&
            detailsRef.current
        ) {
            detailsRef.current.open = true
        }
    }, [editingPlace, osmSuggestion, googleMapsSuggestion])


// Fehlende Informationen aus OSM ergänzen
    useEffect(() => {
        if (!osmEnrichment || !googleMapsSuggestion || editingPlace) {
            return
        }

        // Kategorie nur übernehmen, wenn sie noch
        // nicht manuell verändert wurde
        if (!categoryEditedRef.current) {
            setCategory(osmEnrichment.category)
        }

        // Küche nur ergänzen, wenn das Feld leer ist
        setCuisine(current =>
            current.trim()
                ? current
                : osmEnrichment.cuisine.join(', ')
        )

        // Website nur ergänzen, wenn das Feld leer ist
        setWebsite(current =>
            current.trim()
                ? current
                : osmEnrichment.website ?? ''
        )

        // Formular öffnen und sichtbar machen
        if (detailsRef.current) {
            detailsRef.current.open = true

            detailsRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            })
        }

    }, [osmEnrichment, googleMapsSuggestion, editingPlace])



    // Standort für neuen oder bestehenden Ort festlegen

    const formLocation = editingPlace
        ? {
            latitude: editingPlace.latitude,
            longitude: editingPlace.longitude
        }
        : osmSuggestion
            ? {
                latitude: osmSuggestion.latitude,
                longitude: osmSuggestion.longitude
            }
            : selectedLocation


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
        if (!formLocation || !name.trim() || !neighborhood) {
            return
        }

        const district = getDistrictForNeighborhood(neighborhood)

        if (!district) return

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
            neighborhood,

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

        // Formular nur nach erfolgreichem Hinzufügen oder Bearbeiten zurücksetzen
        setName('')
        setCategory('restaurant')
        setCuisine('')
        setNeighborhood('')
        setWebsite('')
        setGoogleMapsUrl('')
        setStatus('vorgemerkt')
        setNotes('')

        setSeating('unknown')
        setCapacity('unknown')
        setIndoor(false)
        setOutdoor(false)
        setCozy(false)
        setCramped(false)

        // Formular schließen
        if (detailsRef.current) {
            detailsRef.current.open = false
        }
    }

    return (
        <details ref={detailsRef} className="place-form">


            <summary>
                {editingPlace
                    ? t('Ort bearbeiten: {{name}}', { name: editingPlace.name })
                    : osmSuggestion
                        ? t('OSM-Ort übernehmen: {{name}}', { name: osmSuggestion.name })
                        : t("+ Neuen Ort hinzufügen")}
            </summary>


            <form
                className="place-form-content"
                onSubmit={handleSubmit}
                onInvalidCapture={translateValidation}
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
                            onChange={e => { setName(e.target.value); setConfirmedDuplicateKey(undefined) }}
                            placeholder={t("z. B. Kebapci Hamdi Baba")}
                            required
                        />
                    </label>

                    <label>
                        {t("Kategorie")}
                        <select
                            value={category}
                            onChange={e => {
                                categoryEditedRef.current = true
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

                    <label>
                        {t("Küche / Angebot")}
                        <input
                            type="text"
                            value={cuisine}
                            onChange={e => setCuisine(e.target.value)}
                            placeholder={t("z. B. Döner, Vietnamesisch")}
                        />
                    </label>

                    <NeighborhoodInput
                        value={neighborhood}
                        onChange={setNeighborhood}
                    />

                </div>

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

                {/* Vorschau */}

                <div className="place-preview">

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

                </div>

                {/* Standortinformationen */}

                <div className="form-location">
                    {formLocation ? (
                        <p>
                            {t("Standort:")}
                            {' '}{formLocation.latitude.toFixed(6)},
                            {' '}{formLocation.longitude.toFixed(6)}
                        </p>
                    ) : (
                        <p>
                            {t("Bitte zuerst einen Standort auf der Karte auswählen.")}
                        </p>
                    )}
                </div>

                {/* Speichern */}

                <button
                    type="submit"
                    className="save-place-button"
                    disabled={!formLocation || !name.trim() || !getDistrictForNeighborhood(neighborhood)}
                >
                    {editingPlace
                        ? t("Änderungen speichern")
                        : t("Ort hinzufügen")}
                </button>

                {/* Bearbeitung abbrechen */}

                {editingPlace && (
                    <button
                        type="button"
                        className="cancel-edit-button"
                        onClick={onCancelEdit}
                    >
                        {t("Bearbeitung abbrechen")}
                    </button>
                )}

            </form>
        </details>
    )
}

export default PlaceForm
