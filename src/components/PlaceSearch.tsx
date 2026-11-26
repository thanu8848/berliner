import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadCatalog, searchCatalog } from '../services/catalog'
import type { Catalog } from '../services/catalog'
import type { OsmPlace } from '../services/osm'
import type { PlaceCategory } from '../types/place'
import { categoryLabels } from '../data/placeLabels'

interface Props {
    name?: string
    location?: { latitude: number; longitude: number } | null
    category?: PlaceCategory
    onSelect: (place: OsmPlace) => void
}
export default function PlaceSearch({ name = '', location, category, onSelect }: Props) {
    const { t, i18n } = useTranslation()
    const [query, setQuery] = useState(name)
    const [data, setData] = useState<Catalog>()
    const [error, setError] = useState(false)
    const [loading, setLoading] = useState(true)
    const [attempt, setAttempt] = useState(0)
    const [cancelled, setCancelled] = useState(false)
    const [override, setOverride] = useState<PlaceCategory | 'all' | 'auto'>('auto')
    useEffect(() => {
        if (cancelled) return
        const controller = new AbortController()
        loadCatalog(controller.signal).then(setData).catch(() => {
            if (!controller.signal.aborted) setError(true)
        }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
        return () => controller.abort()
    }, [attempt, cancelled])
    const results = data ? searchCatalog(data.places, query, location, override === 'auto' ? category : override === 'all' ? undefined : override) : []
    const renderResult = (place: OsmPlace) => (
        <li key={place.osmId} className="catalog-result">
            <strong>{place.name}</strong>
            <span>{t(categoryLabels[place.category])}{place.address ? ` · ${place.address}` : ''}</span>
            {place.cuisine.length > 0 && <small>{place.cuisine.join(', ')}</small>}
            <button type="button" onClick={() => onSelect(place)}>{t('Informationen übernehmen')}</button>
        </li>
    )
    return <section className="catalog-search" aria-label={t('Berliner Ortskatalog')}>
        <label>{t('Ort oder Adresse suchen')}
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }} placeholder={t('z. B. Zum Stammtisch')} />
        </label>
        <details className="search-options"><summary>{t('Suche anpassen')}</summary>
            <label>{t('Kategorie')}<select value={override} onChange={event => setOverride(event.target.value as typeof override)}>
                <option value="auto">{t('Wie im Formular')}</option><option value="all">{t('Alle Orte')}</option>
                {Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
            </select></label>
        </details>
        {loading && !cancelled && <p role="status">{t('Ortskatalog wird geladen …')} <button type="button" onClick={() => { setCancelled(true); setLoading(false) }}>{t('Suche abbrechen')}</button></p>}
        {(error || cancelled) && <p role="status">{t(cancelled ? 'Suche abgebrochen.' : 'Katalog gerade nicht verfügbar. Du kannst den Ort manuell speichern.')}
            <button type="button" onClick={() => { setLoading(true); setError(false); setCancelled(false); setAttempt(value => value + 1) }}>{t('Erneut versuchen')}</button></p>}
        {data && <>
            <small className="catalog-source">{t('Datenstand: {{date}}', { date: new Date(data.sourceDate).toLocaleDateString(i18n.resolvedLanguage) })} · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL</a></small>
            {results.length > 0 ? <><ul className="catalog-results">{renderResult(results[0])}</ul>
                {results.length > 1 && <details><summary>{t('Weitere Ergebnisse anzeigen')} ({results.length - 1})</summary><ul className="catalog-results">{results.slice(1).map(renderResult)}</ul></details>}
            </> : <p>{t(query.trim().length >= 2 || location ? 'Keine passenden Orte gefunden. Du kannst manuell fortfahren.' : 'Gib mindestens zwei Zeichen ein.')}</p>}
        </>}
    </section>
}
