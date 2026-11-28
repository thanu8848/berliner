export interface AddressLocation {
    latitude: number
    longitude: number
    address: string
    approximate: boolean
    verifiedAddress?: string
}

// Only complete public Berlin street addresses are sent to the provider.
export function berlinAddress(input: string): string | null {
    const value = input.trim().replace(/\s+/g, ' ')
    if (value.length > 250 || !/^[\p{L}\p{N} .'-]+\s+\d+[a-z]?(?:[-/]\d+[a-z]?)?,\s*(?:10|12|13|14)\d{3}\s+Berlin$/iu.test(value)) return null
    return value.replace(/str\.(?=\s)/gi, 'straße')
}
export function insideBerlin(latitude: number, longitude: number): boolean {
    return Number.isFinite(latitude) && Number.isFinite(longitude)
        && latitude >= 52.33 && latitude <= 52.68 && longitude >= 13.08 && longitude <= 13.77
}
export function geocodeEndpoint(resolver: string | undefined): string | null {
    if (!resolver) return null
    try { const url = new URL(resolver); url.pathname = '/geocode'; url.search = ''; url.hash = ''; return url.href } catch { return null }
}
async function fetchAddress(address: string, endpoint: string | null, signal: AbortSignal): Promise<AddressLocation[]> {
    const normalized = berlinAddress(address)
    if (!normalized) throw new Error('incomplete')
    if (!endpoint) throw new Error('unconfigured')
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: normalized }), signal })
    if (!response.ok) {
        if (response.status === 429) throw new Error('busy')
        if (response.status === 504) throw new Error('timeout')
        if (response.status === 503) throw new Error('unconfigured')
        throw new Error('unavailable')
    }
    const data = await response.json()
    if (!Array.isArray(data.results)) throw new Error('unavailable')
    return data.results.filter((p: AddressLocation) => p && insideBerlin(p.latitude, p.longitude)
        && typeof p.address === 'string' && typeof p.approximate === 'boolean').slice(0, 5)
}

export function addressParts(input: string): { street: string; house: string; postcode: string } | null {
    const normalized = berlinAddress(input)
    const match = normalized?.match(/^(.*?)\s+(\d+[a-z]?(?:[-/]\d+[a-z]?)?),\s*(\d{5})\s+Berlin$/i)
    return match ? { street: match[1], house: match[2], postcode: match[3] } : null
}
export function normalizeStreet(value: string): string {
    return value.toLowerCase().replace(/str\.(?=\s|$)/g, 'straße').replace(/ß/g, 'ss')
        .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

// Shared, bounded in-memory cache. No persisted drafts or coordinates are changed.
const addressCache = new Map<string, { until: number; results: AddressLocation[] }>()
const addressRequests = new Map<string, { controller: AbortController; promise: Promise<AddressLocation[]>; users: number }>()
export function lookupAddress(address: string, endpoint: string | null, signal: AbortSignal): Promise<AddressLocation[]> {
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
    const normalized = berlinAddress(address)
    if (!normalized) return Promise.reject(new Error('incomplete'))
    if (!endpoint) return Promise.reject(new Error('unconfigured'))
    const key = 'address-v3|' + endpoint + '|' + normalized.toLocaleLowerCase('de-DE')
    const cached = addressCache.get(key)
    if (cached && cached.until > Date.now()) return Promise.resolve(cached.results)
    let entry = addressRequests.get(key)
    if (!entry || entry.controller.signal.aborted) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(new Error('timeout')), 10000)
        const created = { controller, users: 0, promise: Promise.resolve([] as AddressLocation[]) }
        created.promise = fetchAddress(normalized, endpoint, controller.signal).then(results => {
            if (controller.signal.aborted) throw new Error('timeout')
            addressCache.delete(key)
            addressCache.set(key, { until: Date.now() + 300000, results })
            if (addressCache.size > 30) addressCache.delete(addressCache.keys().next().value!)
            return results
        }).catch(error => { if (controller.signal.aborted && controller.signal.reason instanceof Error && controller.signal.reason.message === 'timeout') throw new Error('timeout'); throw error })
            .finally(() => { clearTimeout(timer); if (addressRequests.get(key) === created) addressRequests.delete(key) })
        entry = created
        addressRequests.set(key, entry)
    }
    const shared = entry
    shared.users++
    return new Promise((resolve, reject) => {
        let done = false
        const finish = (action: () => void) => {
            if (done) return
            done = true
            signal.removeEventListener('abort', cancel)
            shared.users--
            // StrictMode cleanup/setup can attach a replacement consumer in the same turn.
            queueMicrotask(() => { if (!shared.users && addressRequests.get(key) === shared) shared.controller.abort() })
            action()
        }
        const cancel = () => finish(() => reject(new DOMException('Aborted', 'AbortError')))
        signal.addEventListener('abort', cancel, { once: true })
        shared.promise.then(result => finish(() => resolve(result)), error => finish(() => reject(error)))
    })
}
