import type { OsmPlace } from './osm'
import { distanceInMeters, isSimilarPlaceName } from './placeDuplicates'

export interface MapPlace { name: string; latitude: number; longitude: number }

// Match the symbol's location, not the position of its potentially offset label.
// Never substitute a different nearby business for an unmatched name.
export function matchMapPlaces(places: OsmPlace[], targets: MapPlace[]): OsmPlace[] {
    return places.map(place => ({ place, distance: Math.min(...targets.map(target =>
        isSimilarPlaceName(target.name, place.name) ? distanceInMeters(target, place) : Infinity)) }))
        .filter(result => result.distance <= 100)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5).map(result => result.place)
}
