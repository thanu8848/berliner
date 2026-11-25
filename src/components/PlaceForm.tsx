
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
            'Vorhandenen Eintrag bearbeiten? Deine Eingaben für den neuen Ort werden dabei verworfen.'
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
                    ? `Ort bearbeiten: ${editingPlace.name}`
                    : osmSuggestion
                        ? `OSM-Ort übernehmen: ${osmSuggestion.name}`
                        : '+ Neuen Ort hinzufügen'}
            </summary>


            <form
                className="place-form-content"
                onSubmit={handleSubmit}
            >

                {showDuplicates && (
                    <section className="duplicate-notice" aria-label="Mögliche Dubletten">
                        <p role="status"><strong>Dieser Ort könnte bereits gespeichert sein.</strong></p>
                        {duplicates.map(place => (
                            <div key={place.id} className="duplicate-match">
                                <p><strong>{place.name}</strong> · {place.neighborhood ?? place.district}</p>
                                <p>Status: {{
                                    unentdeckt: 'Unentdeckt', vorgemerkt: 'Vorgemerkt',
                                    empfohlen: 'Empfohlen', nicht_empfohlen: 'Nicht empfohlen'
                                }[place.status]}</p>
                                <button type="button" onClick={() => editDuplicate(place)}>
                                    Vorhandenen Eintrag bearbeiten
                                </button>
                            </div>
                        ))}
                        <div className="duplicate-actions">
                            <button type="button" onClick={() => setConfirmedDuplicateKey(currentDuplicateKey)}>
                                Als neuen Ort fortfahren
                            </button>
                            <button type="button" onClick={onCancelNew}>Abbrechen</button>
                        </div>
                    </section>
                )}

                {/* Allgemeine Informationen */}

                <div className="form-grid">

                    <label>
                        Name des Ortes
                        <input
                            type="text"
                            value={name}
                            onChange={e => { setName(e.target.value); setConfirmedDuplicateKey(undefined) }}
                            placeholder="z. B. Kebapci Hamdi Baba"
                            required
                        />
                    </label>

                    <label>
                        Kategorie
                        <select
                            value={category}
                            onChange={e => {
                                categoryEditedRef.current = true
                                setCategory(e.target.value as PlaceCategory)
                            }}
                        >
                            <option value="restaurant">Restaurant</option>
                            <option value="imbiss">Imbiss</option>
                            <option value="cafe">Café</option>
                            <option value="bar">Bar</option>
                            <option value="kneipe">Kneipe</option>
                        </select>
                    </label>

                    <label>
                        Küche / Angebot
                        <input
                            type="text"
                            value={cuisine}
                            onChange={e => setCuisine(e.target.value)}
                            placeholder="z. B. Döner, Vietnamesisch"
                        />
                    </label>

                    <NeighborhoodInput
                        value={neighborhood}
                        onChange={setNeighborhood}
                    />

                </div>

                {/* Sitzmöglichkeiten */}

                <h3>Sitzmöglichkeiten</h3>

                <label>
                    Sitzplätze vorhanden?
                    <select
                        value={seating}
                        onChange={e =>
                            setSeating(e.target.value as Seating)
                        }
                    >
                        <option value="unknown">Unbekannt</option>
                        <option value="yes">Ja</option>
                        <option value="no">Nein</option>
                    </select>
                </label>

                {seating === 'yes' && (
                    <div className="seating-details">

                        <label>
                            Anzahl der Sitzplätze
                            <select
                                value={capacity}
                                onChange={e =>
                                    setCapacity(
                                        e.target.value as SeatingCapacity
                                    )
                                }
                            >
                                <option value="unknown">Unbekannt</option>
                                <option value="few">Wenige</option>
                                <option value="many">Viele</option>
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
                                Drinnen
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={outdoor}
                                    onChange={e =>
                                        setOutdoor(e.target.checked)
                                    }
                                />
                                Draußen
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={cozy}
                                    onChange={e =>
                                        setCozy(e.target.checked)
                                    }
                                />
                                Gemütlich
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={cramped}
                                    onChange={e =>
                                        setCramped(e.target.checked)
                                    }
                                />
                                Eng
                            </label>

                        </div>
                    </div>
                )}

                {/* Weitere Informationen */}

                <h3>Weitere Informationen</h3>

                <div className="form-grid">

                    <label>
                        Google-Maps-Link (optional)
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
                        Website (optional)
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
                        Entdeckerstatus
                        <select
                            value={status}
                            onChange={e =>
                                setStatus(e.target.value as PlaceStatus)
                            }
                        >
                            <option value="unentdeckt">
                                Unentdeckt
                            </option>
                            <option value="vorgemerkt">
                                Vorgemerkt
                            </option>
                            <option value="empfohlen">
                                Empfohlen
                            </option>
                            <option value="nicht_empfohlen">
                                Nicht empfohlen
                            </option>
                        </select>
                    </label>

                </div>

                <label className="notes-field">
                    Unsere Notizen
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Wie war der Ort? Was hat uns gefallen oder nicht gefallen?"
                        rows={4}
                    />
                </label>

                {/* Vorschau */}

                <div className="place-preview">

                    <strong>
                        {editingPlace
                            ? 'Vorschau der Änderungen'
                            : 'Vorschau des neuen Ortes'}
                    </strong>

                    <p>
                        {name || 'Neuer Ort'} ·
                        {' '}{cuisine || category} ·
                        {' '}{getDistrictForNeighborhood(neighborhood) ? neighborhood : 'Kein Ortsteil'}
                    </p>

                    <p>Status: {status}</p>

                    <p>
                        Sitzplätze: {
                        seating === 'yes' ? 'Ja' :
                            seating === 'no' ? 'Nein' : 'Unbekannt'
                    }

                        {seating === 'yes' &&
                            ` · ${
                                capacity === 'few' ? 'Wenige' :
                                    capacity === 'many' ? 'Viele' :
                                        'Anzahl unbekannt'
                            }`}
                    </p>

                    {seating === 'yes' && (
                        <p>
                            {[
                                indoor && 'Drinnen',
                                outdoor && 'Draußen',
                                cozy && 'Gemütlich',
                                cramped && 'Eng'
                            ].filter(Boolean).join(' · ')}
                        </p>
                    )}

                    {notes.trim() && (
                        <p>
                            Notiz: {notes}
                        </p>
                    )}

                </div>

                {/* Standortinformationen */}

                <div className="form-location">
                    {formLocation ? (
                        <p>
                            Standort:
                            {' '}{formLocation.latitude.toFixed(6)},
                            {' '}{formLocation.longitude.toFixed(6)}
                        </p>
                    ) : (
                        <p>
                            Bitte zuerst einen Standort auf der Karte auswählen.
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
                        ? 'Änderungen speichern'
                        : 'Ort hinzufügen'}
                </button>

                {/* Bearbeitung abbrechen */}

                {editingPlace && (
                    <button
                        type="button"
                        className="cancel-edit-button"
                        onClick={onCancelEdit}
                    >
                        Bearbeitung abbrechen
                    </button>
                )}

            </form>
        </details>
    )
}

export default PlaceForm
