import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { matchImportedPlace } from '../src/services/catalog'
import { validLocation, placeRequirements } from '../src/services/placeValidation'
import { parseGoogleMapsLink, resolveGoogleMapsLink, extractGoogleMapsPlaceName, splitPlaceLabel } from '../src/services/googleMaps'
const manifest = JSON.parse(readFileSync('public/catalog/manifest.json', 'utf8'))
const { places } = JSON.parse(readFileSync(`public/catalog/${manifest.file}`, 'utf8'))
const address = 'Turmstr. 85, 10551 Berlin'
const name = 'Falafel Humbaba'
const noCoordinates = 'https://www.google.com/maps/place/' + encodeURIComponent(`${name}, ${address}`) + '/@52.5,13.4,17z'
const full = noCoordinates + '/data=!3d52.5263088!4d13.3382169'

test('Humbaba import without coordinates matches street abbreviation and house number, not nearby branch', () => {
    assert.equal(parseGoogleMapsLink(noCoordinates).kind, 'no_coordinates')
    assert.deepEqual(splitPlaceLabel(extractGoogleMapsPlaceName(noCoordinates)), { name, address })
    const matches = matchImportedPlace(places, name, address)
    assert.equal(matches.length, 1)
    assert.equal(matches[0].osmId, 'node/2470183077')
    assert.equal(matches[0].address, 'Turmstraße 85, 10551 Berlin')
})
test('name alone, unknown shops and conflicting addresses never imply a location', () => {
    assert.deepEqual(matchImportedPlace(places, name, ''), [])
    assert.deepEqual(matchImportedPlace(places, 'Nicht existierender Testladen', address), [])
    assert.deepEqual(matchImportedPlace(places, name, 'Turmstraße 999, 10551 Berlin'), [])
    assert.deepEqual(matchImportedPlace(places, name, 'Turmstraße 85, 10999 Berlin'), [])
})
test('reliable coordinates support matching; contradictory coordinates reject the address match', () => {
    const result = parseGoogleMapsLink(full)
    assert.equal(result.kind, 'coordinates')
    if (result.kind !== 'coordinates') throw new Error('expected coordinates')
    assert.ok(matchImportedPlace(places, name, address, result).some(p => p.osmId === 'node/2470183077'))
    assert.deepEqual(matchImportedPlace(places, name, address, { latitude: 52.6, longitude: 13.4 }), [])
})
test('sequential short-link imports use each resolved URL independently, with and without coordinates', async () => {
    const originalFetch = globalThis.fetch
    const queue = [full, noCoordinates]
    try {
        globalThis.fetch = async () => Response.json({ url: queue.shift() })
        const first = await resolveGoogleMapsLink('https://maps.app.goo.gl/First', 'https://resolver.test/resolve', new AbortController().signal)
        const second = await resolveGoogleMapsLink('https://maps.app.goo.gl/Second', 'https://resolver.test/resolve', new AbortController().signal)
        assert.equal(parseGoogleMapsLink(first).kind, 'coordinates')
        assert.equal(parseGoogleMapsLink(second).kind, 'no_coordinates')
        assert.equal(splitPlaceLabel(extractGoogleMapsPlaceName(second)).name, name)
    } finally { globalThis.fetch = originalFetch }
})
test('required-field explanations and validated coordinates gate saves and legacy edits', () => {
    assert.equal(placeRequirements('', '', null).missing.length, 3)
    const location = { latitude: 52.52, longitude: 13.4 }
    assert.equal(placeRequirements('Shop', 'Moabit', location).missing.length, 0)
    assert.equal(placeRequirements('Shop', 'Unknown', location).missing.length, 1)
    assert.equal(placeRequirements('Shop', '', location, 'Mitte').missing.length, 0)
    assert.equal(placeRequirements('Shop', 'Unknown', location, 'Mitte').missing.length, 1)
    for (const invalid of [null, { latitude: NaN, longitude: 13 }, { latitude: 91, longitude: 13 }, { latitude: 52, longitude: Infinity }, { latitude: 52, longitude: 181 }]) {
        assert.equal(validLocation(invalid), false)
        assert.ok(placeRequirements('Shop', 'Moabit', invalid).missing.some(message => message.startsWith('Der Standort fehlt')))
    }
})
