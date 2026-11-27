import { googleMapsUrl, isShortMapsUrl } from './googleMapsUrls'


export type GoogleMapsResult =
    | {
    kind: 'coordinates'
    latitude: number
    longitude: number
}
    | { kind: 'short' }
    | { kind: 'no_coordinates' }
    | { kind: 'invalid' }

function validCoordinates(latitude: number, longitude: number) {
    return Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
}

export function parseGoogleMapsLink(
    input: string
): GoogleMapsResult {
    const url = googleMapsUrl(input)
    if (!url) return { kind: 'invalid' }
    if (isShortMapsUrl(url)) return { kind: 'short' }

    let decodedUrl = url.href

    try {
        decodedUrl = decodeURIComponent(url.href)
    } catch {
        // Ursprüngliche URL verwenden
    }

    // Koordinaten eines Google-Maps-Ortseintrags
    const placeMatch = decodedUrl.match(
        /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/
    )

    if (placeMatch) {
        const latitude = Number(placeMatch[1])
        const longitude = Number(placeMatch[2])

        if (validCoordinates(latitude, longitude)) {
            return {
                kind: 'coordinates',
                latitude,
                longitude
            }
        }
    }

    // Explizite Koordinaten aus URL-Parametern
    for (const parameter of [
        'query',
        'q',
        'destination',
        'daddr'
    ]) {
        const value = url.searchParams.get(parameter)

        if (!value) continue

        const match = value.match(
            /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/
        )

        if (!match) continue

        const latitude = Number(match[1])
        const longitude = Number(match[2])

        if (validCoordinates(latitude, longitude)) {
            return {
                kind: 'coordinates',
                latitude,
                longitude
            }
        }
    }

    // Ein @-Kartenmittelpunkt wird bewusst nicht
    // als genauer Restaurantstandort übernommen.
    return { kind: 'no_coordinates' }
}


export function extractGoogleMapsPlaceName(input: string): string | null {
    const url = googleMapsUrl(input)
    if (!url || isShortMapsUrl(url)) return null
    try {
        const match = url.pathname.match(/\/maps\/place\/([^/]+)/)
        const text = match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : (url.searchParams.get('query') ?? url.searchParams.get('q'))
        if (!text || /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(text)) return null
        return text.trim() || null
    } catch { return null }
}

// Split only a strong Berlin street/house-number/postcode suffix, retaining commas in names.
export function splitPlaceLabel(
    label: string | null
): { name: string; address: string } {

    if (!label) {
        return { name: '', address: '' }
    }

    const match = label.match(
        /^(.+),\s*([^,]+\s+\d+[a-z]?(?:[-/]\d+[a-z]?)?),\s*((?:10|12|13|14)\d{3})\s+Berlin(?:-Bezirk\s+[^,]+)?(?:,\s*(?:Deutschland|Germany))?$/i
    )

    if (!match) {
        return { name: label, address: '' }
    }

    return {
        name: match[1].trim(),
        address: `${match[2].trim()}, ${match[3]} Berlin`
    }
}

export async function resolveGoogleMapsLink(input: string, endpoint: string | undefined, signal: AbortSignal): Promise<string> {
    const url = googleMapsUrl(input)
    if (!url) throw new Error('invalid_link')
    if (!isShortMapsUrl(url)) return url.href
    if (!endpoint) throw new Error('resolver_unconfigured')
    const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.href }), signal
    })
    if (!response.ok) throw new Error('resolver_failed')
    const data = await response.json()
    const resolved = typeof data.url === 'string' ? googleMapsUrl(data.url) : null
    if (!resolved || isShortMapsUrl(resolved)) throw new Error('resolver_failed')
    return resolved.href
}
