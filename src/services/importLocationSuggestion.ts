import type { AddressLocation } from './addressLookup'
import { berlinAddress } from './addressLookup'
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
