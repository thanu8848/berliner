import type { PlaceCategory } from '../types/place'
import type { OsmPlace } from './osm'
import { distanceInMeters, isSimilarPlaceName, normalizePlaceName } from './placeDuplicates'

export interface Catalog {
    sourceDate: string
    places: OsmPlace[]
}
let cached: { data: Catalog; until: number } | undefined
let pending: { promise: Promise<Catalog>; controller: AbortController; users: number } | undefined

function validPlace(value: unknown): value is OsmPlace {
    if (!value || typeof value !== 'object') return false
    const p = value as OsmPlace
    return typeof p.osmId === 'string' && typeof p.name === 'string'
        && ['restaurant', 'imbiss', 'cafe', 'bar', 'kneipe'].includes(p.category)
        && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
        && Array.isArray(p.cuisine) && p.cuisine.every(c => typeof c === 'string')
}

// Deduplicate downloads. Abort the shared fetch when the last consumer leaves.
export function loadCatalog(signal: AbortSignal): Promise<Catalog> {
    if (signal.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'))
    if (cached && cached.until > Date.now()) return Promise.resolve(cached.data)
    if (!pending || pending.controller.signal.aborted) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), 10000)
        const entry = { controller, users: 0, promise: Promise.resolve(null as unknown as Catalog) }
        entry.promise = (async () => {
            const base = `${import.meta.env.BASE_URL}catalog/`
            const response = await fetch(`${base}manifest.json`, { signal: controller.signal, cache: 'no-cache' })
            if (!response.ok) throw new Error('catalog_unavailable')
            const manifest = await response.json()
            if (!/^places-[a-f0-9]{16}\.json$/.test(manifest.file)) throw new Error('catalog_invalid')
            const result = await fetch(`${base}${manifest.file}`, { signal: controller.signal })
            if (!result.ok) throw new Error('catalog_unavailable')
            const data: Catalog = await result.json()
            if (!Array.isArray(data.places) || !data.places.every(validPlace) || !Number.isFinite(Date.parse(data.sourceDate))) throw new Error('catalog_invalid')
            cached = { data, until: Date.now() + 60 * 60 * 1000 }
            return data
        })().finally(() => { clearTimeout(timeout); if (pending === entry) pending = undefined })
        pending = entry
    }
    const entry = pending
    entry.users++
    return new Promise((resolve, reject) => {
        let finished = false
        const finish = (action: () => void) => {
            if (finished) return
            finished = true
            signal.removeEventListener('abort', cancel)
            entry.users--
            if (entry.users === 0 && pending === entry) entry.controller.abort()
            action()
        }
        const cancel = () => finish(() => reject(new DOMException('Cancelled', 'AbortError')))
        signal.addEventListener('abort', cancel, { once: true })
        entry.promise.then(data => finish(() => resolve(data)), error => finish(() => reject(error)))
    })
}

export function searchCatalog(places: OsmPlace[], query: string, location?: { latitude: number; longitude: number } | null, category?: PlaceCategory): OsmPlace[] {
    const normalized = normalizePlaceName(query)
    if (normalized.length < 2 && !location) return []
    const tokens = query.trim().split(/\s+/).map(normalizePlaceName).filter(Boolean)
    return places.filter(p => !category || p.category === category).map(p => {
        const distance = location ? distanceInMeters(location, p) : Infinity
        const name = normalizePlaceName(p.name)
        const text = normalizePlaceName(`${p.name} ${p.address ?? ''}`)
        const matches = normalized.length >= 2 && (isSimilarPlaceName(query, p.name) || tokens.every(token => text.includes(token)))
        const nearby = distance <= 200
        const score = name === normalized ? 0 : matches ? 1 : nearby ? 2 : 3
        return { place: p, distance, score }
    }).filter(p => p.score < 3)
        .sort((a, b) => a.score - b.score || a.distance - b.distance || a.place.name.localeCompare(b.place.name, 'de'))
        .slice(0, 30).map(result => result.place)
}
