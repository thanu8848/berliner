import { getDistrictForNeighborhood } from '../data/berlinOrtsteile'

export function validLocation(location: { latitude: number; longitude: number } | null | undefined): boolean {
    return Boolean(location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
        && Math.abs(location.latitude) <= 90 && Math.abs(location.longitude) <= 180)
}

export function placeRequirements(name: string, neighborhood: string, location: { latitude: number; longitude: number } | null, existingDistrict?: string) {
    const district = neighborhood ? getDistrictForNeighborhood(neighborhood) : existingDistrict
    const missing = []
    if (!name.trim()) missing.push('Bitte gib einen Namen für den Ort ein.')
    if (!district) missing.push('Bitte wähle einen gültigen Ortsteil aus den Vorschlägen.')
    if (!validLocation(location)) missing.push('Der Standort fehlt noch. Bitte wähle den Ort auf der Karte oder über die Suche.')
    return { district, missing }
}
