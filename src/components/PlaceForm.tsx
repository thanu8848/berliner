
import { useState } from 'react'
import type { FormEvent } from 'react'

import type {
    Place,
    PlaceCategory,
    PlaceStatus,
    Seating,
    SeatingCapacity
} from '../types/place'

const districts = [
    'Charlottenburg-Wilmersdorf',
    'Friedrichshain-Kreuzberg',
    'Lichtenberg',
    'Marzahn-Hellersdorf',
    'Mitte',
    'Neukölln',
    'Pankow',
    'Reinickendorf',
    'Spandau',
    'Steglitz-Zehlendorf',
    'Tempelhof-Schöneberg',
    'Treptow-Köpenick'
]


interface PlaceFormProps {
    selectedLocation: {
        latitude: number
        longitude: number
    } | null

    onAddPlace: (place: Place) => void
}

function PlaceForm({
                       selectedLocation,
                       onAddPlace
                   }: PlaceFormProps) {




        const [name, setName] = useState('')
    const [category, setCategory] =
        useState<PlaceCategory>('restaurant')
    const [cuisine, setCuisine] = useState('')
    const [district, setDistrict] = useState('')
    const [website, setWebsite] = useState('')
    const [googleMapsUrl, setGoogleMapsUrl] = useState('')
    const [status, setStatus] =
        useState<PlaceStatus>('vorgemerkt')

    const [seating, setSeating] =
        useState<Seating>('unknown')
    const [capacity, setCapacity] =
        useState<SeatingCapacity>('unknown')
    const [indoor, setIndoor] = useState(false)
    const [outdoor, setOutdoor] = useState(false)
    const [cozy, setCozy] = useState(false)
    const [cramped, setCramped] = useState(false)


    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!selectedLocation || !name.trim() || !district) {
            return
        }

        const newPlace: Place = {
            id: crypto.randomUUID(),
            name: name.trim(),
            category,
            cuisine: cuisine.split(',')
                .map(item => item.trim())
                .filter(Boolean),
            district,
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            status,
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

        onAddPlace(newPlace)

        // Formular zurücksetzen
        setName('')
        setCategory('restaurant')
        setCuisine('')
        setDistrict('')
        setWebsite('')
        setGoogleMapsUrl('')
        setStatus('vorgemerkt')
        setSeating('unknown')
        setCapacity('unknown')
        setIndoor(false)
        setOutdoor(false)
        setCozy(false)
        setCramped(false)
    }


    return (
        <details className="place-form">
            <summary>+ Neuen Ort hinzufügen</summary>

            <form className="place-form-content" onSubmit={handleSubmit}>
                <div className="form-grid">
                    <label>
                        Name des Ortes
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="z. B. Kebapci Hamdi Baba"
                        />
                    </label>

                    <label>
                        Kategorie
                        <select
                            value={category}
                            onChange={e =>
                                setCategory(e.target.value as PlaceCategory)
                            }
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
                            value={cuisine}
                            onChange={e => setCuisine(e.target.value)}
                            placeholder="Döner, Vietnamesisch ..."
                        />
                    </label>

                    <label>
                        Bezirk
                        <select
                            value={district}
                            onChange={e => setDistrict(e.target.value)}
                        >
                            <option value="">Bitte auswählen</option>
                            {districts.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </label>
                </div>

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
                                    onChange={e => setIndoor(e.target.checked)}
                                />
                                Drinnen
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={outdoor}
                                    onChange={e => setOutdoor(e.target.checked)}
                                />
                                Draußen
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={cozy}
                                    onChange={e => setCozy(e.target.checked)}
                                />
                                Gemütlich
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={cramped}
                                    onChange={e => setCramped(e.target.checked)}
                                />
                                Eng
                            </label>
                        </div>
                    </div>
                )}

                <h3>Weitere Informationen</h3>

                <div className="form-grid">
                    <label>
                        Google-Maps-Link
                        <input
                            type="url"
                            value={googleMapsUrl}
                            onChange={e => setGoogleMapsUrl(e.target.value)}
                            placeholder="https://www.google.com/maps/..."
                        />
                    </label>

                    <label>
                        Website (optional)
                        <input
                            type="url"
                            value={website}
                            onChange={e => setWebsite(e.target.value)}
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
                            <option value="unentdeckt">Unentdeckt</option>
                            <option value="vorgemerkt">Vorgemerkt</option>
                            <option value="empfohlen">Empfohlen</option>
                        </select>
                    </label>
                </div>

                <div className="place-preview">
                    <strong>Vorschau</strong>
                    <p>
                        {name || 'Neuer Ort'} ·
                        {' '}{cuisine || category} ·
                        {' '}{district || 'Kein Bezirk'}
                    </p>
                    <p>Status: {status}</p>
                    <p>
                        Sitzplätze: {
                        seating === 'yes' ? 'Ja' :
                            seating === 'no' ? 'Nein' : 'Unbekannt'
                    }
                        {seating === 'yes' &&
                            ` · ${capacity === 'few' ? 'Wenige' :
                                capacity === 'many' ? 'Viele' :
                                    'Anzahl unbekannt'}`}
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
                </div>


                <div className="form-location">
                    {selectedLocation ? (
                        <p>
                            Standort ausgewählt:
                            {' '}{selectedLocation.latitude.toFixed(6)},
                            {' '}{selectedLocation.longitude.toFixed(6)}
                        </p>
                    ) : (
                        <p>Bitte zuerst einen Standort auf der Karte auswählen.</p>
                    )}
                </div>

                <button
                    type="submit"
                    className="save-place-button"
                    disabled={!selectedLocation || !name.trim() || !district}
                >
                    Ort hinzufügen
                </button>

            </form>
        </details>
    )
}

export default PlaceForm
