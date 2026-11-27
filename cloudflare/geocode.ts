import { berlinAddress, insideBerlin, addressParts, normalizeStreet } from '../src/services/addressLookup'
import type { AddressLocation } from '../src/services/addressLookup'

interface Storage {
    get<T>(key: string): Promise<T | undefined>
    put<T>(key: string, value: T): Promise<void>
}
export interface GeocodeEnv {
    GEOCODER_URL?: string
    GEOCODER_AGENT?: string
    GEOCODE?: { idFromName(name: string): unknown; get(id: unknown): { fetch(request: Request): Promise<Response> } }
    GEOCODE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> }
}
const json = (body: unknown, status = 200) => Response.json(body, { status })
type CacheEntry = { key: string; until: number; results: AddressLocation[] }

export async function readAddress(request: Request): Promise<string | null> {
    if (!request.body) return null
    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > 1024) { await reader.cancel(); return null }
        chunks.push(value)
    }
    try {
        const bytes = new Uint8Array(size)
        let offset = 0
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
        const data = JSON.parse(new TextDecoder().decode(bytes))
        return typeof data.address === 'string' ? berlinAddress(data.address) : null
    } catch { return null }
}

export function nominatimResults(data: unknown, requestedAddress: string): AddressLocation[] {
    if (!Array.isArray(data)) throw new Error('invalid_response')
    const requested = addressParts(requestedAddress)
    if (!requested) return []
    return data.flatMap(item => {
        if (!item || typeof item !== 'object') return []
        const latitude = Number(item.lat), longitude = Number(item.lon)
        const address = item.address ?? {}
        // The bounding rectangle alone includes Brandenburg; check the state as well.
        if (!insideBerlin(latitude, longitude) || address.country_code !== 'de'
            || !(address.state === 'Berlin' || address['ISO3166-2-lvl4'] === 'DE-BE')
            || typeof item.display_name !== 'string') return []
        const road = address.road || address.pedestrian
        if (typeof road !== 'string' || normalizeStreet(road) !== normalizeStreet(requested.street)) return []
        const postcode = typeof address.postcode === 'string' ? address.postcode.trim() : ''
        if (postcode && postcode !== requested.postcode) return []
        const house = typeof address.house_number === 'string' ? address.house_number.toLowerCase().replace(/\s/g, '') : ''
        const exactHouse = house === requested.house.toLowerCase()
        const range = house.match(/^(\d+)-(\d+)$/)
        const withinRange = range && /^\d+$/.test(requested.house) && Number(requested.house) >= Number(range[1]) && Number(requested.house) <= Number(range[2])
        if (house && !exactHouse && !withinRange) return []
        return [{ latitude, longitude, address: item.display_name.slice(0, 500),
            approximate: !exactHouse || !postcode }]
    }).sort((a, b) => Number(a.approximate) - Number(b.approximate)).slice(0, 5)
}

// One globally named Durable Object for ALL users/PoPs, not a per-IP rate limit.
// Serialize full requests and persist the next permitted request time across restarts.
export class AddressGeocoder {
    private state: { storage: Storage }
    private env: GeocodeEnv
    private busy = false
    constructor(state: { storage: Storage }, env: GeocodeEnv) { this.state = state; this.env = env }
    async fetch(request: Request): Promise<Response> {
        if (this.busy) return json({ error: 'busy' }, 429)
        this.busy = true
        try { return await this.lookup(request) } finally { this.busy = false }
    }
    private async lookup(request: Request): Promise<Response> {
        const address = await readAddress(request)
        if (!address) return json({ error: 'incomplete' }, 400)
        if (!this.env.GEOCODER_URL || !this.env.GEOCODER_AGENT) return json({ error: 'unconfigured' }, 503)
        const endpoint = new URL(this.env.GEOCODER_URL)
        if (endpoint.protocol !== 'https:') return json({ error: 'unconfigured' }, 503)
        const key = 'address-v2|' + endpoint.href + '|' + address.toLocaleLowerCase('de-DE')
        const cache = (await this.state.storage.get<CacheEntry[]>('cache') ?? []).filter(entry => entry.until > Date.now())
        const hit = cache.find(entry => entry.key === key)
        if (hit) return json({ results: hit.results })
        const next = await this.state.storage.get<number>('next') ?? 0
        if (Date.now() < next) return json({ error: 'busy' }, 429)
        await this.state.storage.put('next', Date.now() + 1500)
        const parts = addressParts(address)!
        endpoint.search = new URLSearchParams({ street: `${parts.house} ${parts.street}`, city: 'Berlin', postalcode: parts.postcode, format: 'jsonv2', addressdetails: '1', countrycodes: 'de',
            viewbox: '13.08,52.68,13.77,52.33', bounded: '1', limit: '5', 'accept-language': 'de' }).toString()
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 7000)
        try {
            const response = await fetch(endpoint, { signal: controller.signal, redirect: 'manual', headers: {
                'User-Agent': this.env.GEOCODER_AGENT, Accept: 'application/json'
            } })
            if (!response.ok) {
                if (response.status === 429) await this.state.storage.put('next', Date.now() + 60000)
                return json({ error: 'unavailable' }, 502)
            }
            const results = nominatimResults(await response.json(), address)
            // Bounded shared cache, seven days for matches and one day for misses.
            cache.push({ key, results, until: Date.now() + (results.length ? 7 : 1) * 86400000 })
            await this.state.storage.put('cache', cache.slice(-30))
            return json({ results })
        } catch { return json({ error: controller.signal.aborted ? 'timeout' : 'unavailable' }, controller.signal.aborted ? 504 : 502) }
        finally { clearTimeout(timer) }
    }
}

export async function handleGeocode(request: Request, env: GeocodeEnv): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
    if (request.method !== 'POST') return json({ error: 'method' }, 405)
    if (!env.GEOCODE || !env.GEOCODE_LIMITER) return json({ error: 'unconfigured' }, 503)
    if (!(await env.GEOCODE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })).success) return json({ error: 'busy' }, 429)
    const address = await readAddress(request)
    if (!address) return json({ error: 'incomplete' }, 400)
    try {
        return await env.GEOCODE.get(env.GEOCODE.idFromName('berliner-addresses')).fetch(new Request('https://internal/geocode', {
            method: 'POST', body: JSON.stringify({ address })
        }))
    } catch { return json({ error: 'unavailable' }, 502) }
}
