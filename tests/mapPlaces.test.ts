import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchMapPlaces } from '../src/services/mapPlaces'
import type { OsmPlace } from '../src/services/osm'
const place: OsmPlace = { osmId: 'node/1', name: 'Café Test', latitude: 52.52, longitude: 13.405, category: 'cafe', cuisine: [], address: 'Teststraße 1' }
test('map symbol matches normalized name and preserves catalog details', () => {
    assert.deepEqual(matchMapPlaces([place], [{ ...place, name: 'Cafe Test' }]), [place])
})
test('never substitutes adjacent businesses or distant same-name branches', () => {
    assert.deepEqual(matchMapPlaces([place], [{ ...place, name: 'Anderer Laden' }]), [])
    assert.deepEqual(matchMapPlaces([place], [{ ...place, latitude: 52.53 }]), [])
    assert.deepEqual(matchMapPlaces([place], []), [])
})
test('overlapping labels offer matching choices without duplicates', () => {
    const second = { ...place, osmId: 'node/2', name: 'Restaurant Test' }
    assert.deepEqual(matchMapPlaces([place, second], [place, place, second]), [place, second])
})
