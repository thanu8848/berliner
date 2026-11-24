
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
    let url: URL

    try {
        url = new URL(input.trim())
    } catch {
        return { kind: 'invalid' }
    }

    if (url.protocol !== 'https:') {
        return { kind: 'invalid' }
    }

    const host = url.hostname.toLowerCase()

    // Google Maps-Kurzlinks
    if (
        host === 'maps.app.goo.gl' ||
        (host === 'goo.gl' && url.pathname.startsWith('/maps/'))
    ) {
        return { kind: 'short' }
    }

    // Nur unterstützte Google-Domains akzeptieren
    const googleDomain =
        /^(?:www\.|maps\.)?google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/

    if (!googleDomain.test(host)) {
        return { kind: 'invalid' }
    }

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
