import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { berlinAddress, geocodeEndpoint, lookupAddress } from '../services/addressLookup'
import type { AddressLocation } from '../services/addressLookup'

interface Props { address: string; name: string; onPreview: (place: AddressLocation, name: string) => void }
export default function AddressSearch({ address, name, onPreview }: Props) {
    const { t } = useTranslation()
    const [results, setResults] = useState<AddressLocation[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const request = useRef<AbortController | null>(null)
    const normalized = berlinAddress(address)
    useEffect(() => () => { request.current?.abort(); request.current = null }, [])
    async function search() {
        request.current?.abort()
        const controller = new AbortController()
        request.current = controller
        setLoading(true); setError(''); setResults(null)
        const timer = setTimeout(() => controller.abort(), 10000)
        try {
            const found = await lookupAddress(address, geocodeEndpoint(import.meta.env.VITE_MAPS_RESOLVER_URL), controller.signal)
            if (!controller.signal.aborted) setResults(found)
        } catch (reason) {
            if (request.current !== controller) return
            const code = controller.signal.aborted ? 'timeout' : reason instanceof Error ? reason.message : ''
            setError(code === 'unconfigured' ? 'Die Adresssuche ist noch nicht freigeschaltet. Bitte wähle den Standort auf der Karte.'
                : code === 'busy' ? 'Die Adresssuche ist gerade ausgelastet. Bitte versuche es gleich erneut.'
                : code === 'timeout' ? 'Die Adresssuche dauert zu lange. Bitte versuche es erneut oder wähle den Standort auf der Karte.'
                : 'Die Adresssuche ist gerade nicht erreichbar. Du kannst den Standort auf der Karte auswählen.')
        } finally { clearTimeout(timer); if (request.current === controller) setLoading(false) }
    }
    return <section className="address-search" aria-label={t('Adresse suchen')}>
        <p>{t('Kein Geschäft gefunden? Suche stattdessen nach der Adresse des Gebäudes.')}</p>
        {!normalized && <p role="status">{t('Bitte ergänze Straße, Hausnummer, Postleitzahl und Berlin im Adressfeld.')}</p>}
        <button type="button" disabled={!normalized || loading} onClick={() => void search()}>{t(loading ? 'Adresse wird gesucht …' : 'Standort anhand der Adresse suchen')}</button>
        <small>{t('Nur die öffentliche Geschäftsadresse wird an den Adressdienst gesendet. Keine privaten Adressen eingeben.')} · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></small>
        {loading && <button type="button" onClick={() => { request.current?.abort(); request.current = null; setLoading(false) }}>{t('Suche abbrechen')}</button>}
        {error && <p role="status">{t(error)}</p>}
        {results?.length === 0 && <p role="status">{t('Keine Adresse in Berlin gefunden. Bitte prüfe die Adresse oder wähle den Standort auf der Karte.')}</p>}
        {results && results.length > 0 && <>
            <p role="status">{t(results.length === 1 ? 'Möglichen Standort gefunden' : 'Mehrere mögliche Standorte gefunden. Bitte wähle die passende Adresse.')}</p>
            <ul className="catalog-results">{results.map((place, index) => <li className="catalog-result" key={`${place.latitude}:${place.longitude}:${index}`}>
                <strong>{name || t('Neuer Ort')}</strong><span>{place.address}</span>
                {place.approximate && <small>{t('Nur ungefähr: Bitte setze den Marker am richtigen Gebäude.')}</small>}
                <button type="button" onClick={() => onPreview(place, name)}>{t('Auf Karte prüfen')}</button>
            </li>)}</ul>
        </>}
    </section>
}
