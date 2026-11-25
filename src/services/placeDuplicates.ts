import type { Place } from '../types/place'

export function normalizePlaceName(name: string): string {
    return name
        .toLocaleLowerCase('de-DE')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]/g, '')
}

export function isSimilarPlaceName(
    googleName: string,
    osmName: string
): boolean {
    const google = normalizePlaceName(googleName)
    const osm = normalizePlaceName(osmName)

    if (!google || !osm) return false

    // Namen stimmen vollständig überein
    if (google === osm) return true

    // Ein Name enthält den anderen
    if (google.length >= 8 && osm.length >= 8) {
        return google.includes(osm) || osm.includes(google)
    }

    return false
}


// Luftlinie auf der Erdkugel, Ergebnis in Metern.
export function distanceInMeters(
    first: Pick<Place, 'latitude' | 'longitude'>,
    second: Pick<Place, 'latitude' | 'longitude'>
): number {
    const toRadians = (degrees: number) => degrees * Math.PI / 180
    const latitudeDelta = toRadians(second.latitude - first.latitude)
    const longitudeDelta = toRadians(second.longitude - first.longitude)
    const a = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(toRadians(first.latitude))
        * Math.cos(toRadians(second.latitude))
        * Math.sin(longitudeDelta / 2) ** 2

    // Rundungsfehler dürfen den Wertebereich von asin nicht überschreiten.
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))))
}

export type DuplicateCandidate = Pick<Place, 'name' | 'latitude' | 'longitude' | 'googleMapsUrl'> & { id?: string }

export function findPossibleDuplicates(candidate: DuplicateCandidate, places: Place[]): Place[] {
    const googleMapsUrl = candidate.googleMapsUrl?.trim()

    return places.filter(place => {
        if (place.id === candidate.id) return false

        const sameGoogleMapsLink = Boolean(
            googleMapsUrl && googleMapsUrl === place.googleMapsUrl?.trim()
        )

        return sameGoogleMapsLink || (
            isSimilarPlaceName(candidate.name, place.name)
            && distanceInMeters(candidate, place) <= 60
        )
    })
}

// Eine Bestätigung gilt nur für diese Eingaben und genau diese Treffer.
export function duplicateConfirmationKey(candidate: DuplicateCandidate, duplicates: Place[]): string {
    return JSON.stringify([
        candidate.name.trim(), candidate.latitude, candidate.longitude,
        candidate.googleMapsUrl?.trim() ?? '',
        duplicates.map(place => [place.id, place.name, place.latitude, place.longitude,
            place.googleMapsUrl ?? '']).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    ])
}
