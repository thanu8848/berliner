export interface AddressLocation {
    latitude: number
    longitude: number
    address: string
    approximate: boolean
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
export async function lookupAddress(address: string, endpoint: string | null, signal: AbortSignal): Promise<AddressLocation[]> {
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
