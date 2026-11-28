import type { AddressLocation } from './addressLookup'
import { berlinAddress, insideBerlin } from './addressLookup'
import type { Boundary } from './neighborhoodBoundaries'
import { locateNeighborhood } from './neighborhoodBoundaries'

export function shouldAutoLookup(importedAddress: string, currentAddress: string, hasLocation: boolean): boolean {
    return !hasLocation && Boolean(berlinAddress(importedAddress)) && berlinAddress(importedAddress) === berlinAddress(currentAddress)
}
export function suggestedNeighborhood(results: AddressLocation[], boundaries: Boundary[]): string | null {
    if (results.length !== 1 || results[0].approximate) return null
    const result = locateNeighborhood(boundaries, results[0])
    return result.uncertain ? null : result.name
}

// Do not infer building identity from proximity, labels, or a shared street address.
// Only byte-identical coordinates with a server-verified complete address may merge.
export function automaticLocation(results: AddressLocation[], requestedAddress: string): AddressLocation | null {
    const address = berlinAddress(requestedAddress)?.toLocaleLowerCase('de-DE')
    if (!address || !results.length) return null
    if (!results.every(place => !place.approximate && insideBerlin(place.latitude, place.longitude)
        && typeof place.verifiedAddress === 'string'
        && berlinAddress(place.verifiedAddress)?.toLocaleLowerCase('de-DE') === address)) return null
    const first = results[0]
    return results.every(place => place.latitude === first.latitude && place.longitude === first.longitude) ? first : null
}
