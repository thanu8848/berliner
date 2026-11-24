
export type PlaceCategory =
    | 'restaurant'
    | 'imbiss'
    | 'cafe'
    | 'bar'
    | 'kneipe'

export type PlaceStatus =
    | 'unentdeckt'
    | 'vorgemerkt'
    | 'empfohlen'
    | 'nicht_empfohlen'


export type Seating =
    | 'yes'
    | 'no'
    | 'unknown'

export type SeatingCapacity =
    | 'few'
    | 'many'
    | 'unknown'

export interface SeatingDetails {
    available: Seating
    capacity?: SeatingCapacity
    indoor?: boolean
    outdoor?: boolean
    cozy?: boolean
    cramped?: boolean
}



export interface Place {
    id: string
    name: string
    category: PlaceCategory
    latitude: number
    longitude: number
    district: string
    status: PlaceStatus

    smokingAllowed?: boolean
    website?: string
    googleMapsUrl?: string
    notes?: string

    cuisine?: string[]
    seating?: SeatingDetails
}

