
import type { PlaceCategory } from '../types/place'

// So sieht ein Ort aus, den wir von OSM erhalten
export interface OsmPlace {
    osmId: string
    name: string
    category: PlaceCategory
    latitude: number
    longitude: number
    cuisine: string[]
    website?: string
}

// Struktur der Antwort von Overpass
interface OverpassElement {
    type: string
    id: number
    lat?: number
    lon?: number
    center?: {
        lat: number
        lon: number
    }
    tags?: Record<string, string>
}

interface OverpassResponse {
    elements: OverpassElement[]
}

// OSM-Kategorien auf unsere Kategorien übertragen
const categoryMapping: Record<string, PlaceCategory> = {
    restaurant: 'restaurant',
    fast_food: 'imbiss',
    cafe: 'cafe',
    bar: 'bar',
    pub: 'kneipe'
}

// Orte im Umkreis von 100 Metern suchen
export async function searchNearbyOsmPlaces(
    latitude: number,
    longitude: number
): Promise<OsmPlace[]> {

    const query = `
    [out:json][timeout:15];
    nwr(around:100,${latitude},${longitude})
      ["amenity"~"^(restaurant|fast_food|cafe|bar|pub)$"]
      ["name"];
    out center;
  `

    const response = await fetch(
        'https://overpass-api.de/api/interpreter',
        {
            method: 'POST',
            body: new URLSearchParams({ data: query })
        }
    )

    if (!response.ok) {
        throw new Error(
            `OpenStreetMap-Abfrage fehlgeschlagen: ${response.status}`
        )
    }

    const data = (await response.json()) as OverpassResponse

    const results: OsmPlace[] = []

    for (const element of data.elements) {
        const tags = element.tags

        if (!tags?.name || !tags.amenity) continue

        const category = categoryMapping[tags.amenity]

        if (!category) continue

        // Bei Gebäudeflächen den Mittelpunkt verwenden
        const lat = element.lat ?? element.center?.lat
        const lon = element.lon ?? element.center?.lon

        if (lat === undefined || lon === undefined) {
            continue
        }

        results.push({
            osmId: `${element.type}/${element.id}`,
            name: tags.name,
            category,
            latitude: lat,
            longitude: lon,
            cuisine: tags.cuisine
                ? tags.cuisine.split(';').map(c => c.trim())
                : [],
            website: tags.website ?? tags['contact:website']
        })
    }

    return results
}
