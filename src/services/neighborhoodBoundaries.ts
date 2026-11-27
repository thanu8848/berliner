import { getDistrictForNeighborhood } from '../data/berlinOrtsteile'
export interface Boundary { name: string; bounds: number[]; polygons: number[][][][] }
let pending: Promise<Boundary[]> | undefined
export function loadBoundaries(): Promise<Boundary[]> {
    if (!pending) pending = fetch(`${import.meta.env.BASE_URL}boundaries/ortsteile-2026-11-28.json`, { signal: AbortSignal.timeout(10000) })
        .then(async response => {
            if (!response.ok) throw new Error('boundaries_unavailable')
            const data: Boundary[] = await response.json()
            if (!Array.isArray(data) || data.length !== 97 || !data.every(b => getDistrictForNeighborhood(b.name) && Array.isArray(b.polygons))) throw new Error('boundaries_invalid')
            return data
        }).catch(error => { pending = undefined; throw error })
    return pending
}
// Ray casting with holes; distance to edges uses a local metric projection.
function ringContains(ring: number[][], x: number, y: number): boolean {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i], b = ring[j]
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
    }
    return inside
}
function nearEdge(ring: number[][], x: number, y: number): boolean {
    const sx = 111320 * Math.cos(y * Math.PI / 180), sy = 111320
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const ax = (ring[j][0] - x) * sx, ay = (ring[j][1] - y) * sy
        const dx = (ring[i][0] - ring[j][0]) * sx, dy = (ring[i][1] - ring[j][1]) * sy
        const length = dx * dx + dy * dy
        const t = length ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length)) : 0
        if (Math.hypot(ax + t * dx, ay + t * dy) <= 10) return true
    }
    return false
}
export function locateNeighborhood(boundaries: Boundary[], point: { latitude: number; longitude: number }): { name: string | null; uncertain: boolean } {
    const { latitude: y, longitude: x } = point
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { name: null, uncertain: true }
    const matches: string[] = []
    let near = false
    for (const area of boundaries) {
        const [west, south, east, north] = area.bounds
        if (x < west - .0002 || x > east + .0002 || y < south - .0001 || y > north + .0001) continue
        for (const polygon of area.polygons) {
            if (polygon.some(ring => nearEdge(ring, x, y))) near = true
            if (ringContains(polygon[0], x, y) && !polygon.slice(1).some(ring => ringContains(ring, x, y))) { matches.push(area.name); break }
        }
    }
    const names = [...new Set(matches)]
    return { name: names.length === 1 ? names[0] : null, uncertain: near || names.length !== 1 }
}
