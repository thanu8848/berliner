import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AddressGeocoder, nominatimResults, handleGeocode } from '../cloudflare/geocode'
import worker from '../cloudflare/worker'
import { berlinAddress, geocodeEndpoint, lookupAddress } from '../src/services/addressLookup'
const address = 'Turmstraße 85, 10551 Berlin'
const result = { lat: '52.5263088', lon: '13.3382169', display_name: address, address: { country_code: 'de', state: 'Berlin', postcode: '10551', house_number: '85', road: 'Turmstraße' } }
const req = (value = address) => new Request('https://internal/geocode', { method: 'POST', body: JSON.stringify({ address: value }) })
const env = { GEOCODER_URL: 'https://nominatim.openstreetmap.org/search', GEOCODER_AGENT: 'Berliner test' }
function memory() {
    const values = new Map<string, unknown>()
    return { storage: { get: async <T>(key: string) => values.get(key) as T | undefined,
        put: async <T>(key: string, value: T) => { values.set(key, value) } } }
}
test('Berlin address validation and separate endpoint do not accept incomplete addresses', () => {
    assert.equal(berlinAddress('Turmstr. 85, 10551 Berlin'), address)
    for (const value of ['Turmstraße', 'Turmstraße 85', 'Turmstraße 85, 10551 Potsdam', 'Humbaba', 'x'.repeat(300)]) assert.equal(berlinAddress(value), null)
    assert.equal(geocodeEndpoint('https://example.workers.dev/resolve'), 'https://example.workers.dev/geocode')
    assert.equal(geocodeEndpoint(undefined), null)
})
test('provider adapter excludes Brandenburg and marks street-only results as approximate', () => {
    assert.equal(nominatimResults([result], address)[0].approximate, false)
    assert.equal(nominatimResults([{ ...result, address: { ...result.address, house_number: undefined } }], address)[0].approximate, true)
    assert.deepEqual(nominatimResults([{ ...result, address: { ...result.address, state: 'Brandenburg' } }, { ...result, lat: 'NaN' }], address), [])
    assert.equal(nominatimResults([result, { ...result, lon: '13.3383' }], address).length, 2)
})
test('global durable limiter, bounded shared cache and restart protection', async () => {
    const originalFetch = globalThis.fetch, originalNow = Date.now
    let now = 10000, calls = 0
    const state = memory()
    try {
        Date.now = () => now
        globalThis.fetch = async (url, options) => {
            calls++
            assert.equal(options?.redirect, 'manual')
            assert.equal(new URL(String(url)).searchParams.get('bounded'), '1')
            assert.equal(new Headers(options?.headers).get('User-Agent'), env.GEOCODER_AGENT)
            return Response.json([result])
        }
        const actor = new AddressGeocoder(state, env)
        assert.equal((await actor.fetch(req())).status, 200)
        assert.equal((await actor.fetch(req())).status, 200)
        assert.equal(calls, 1)
        const restarted = new AddressGeocoder(state, env)
        assert.equal((await restarted.fetch(req('Turmstraße 34, 10551 Berlin'))).status, 429)
        assert.equal(calls, 1)
        now += 1500
        assert.equal((await restarted.fetch(req('Turmstraße 34, 10551 Berlin'))).status, 200)
        assert.equal(calls, 2)
        now += 1500
        globalThis.fetch = async () => { calls++; return Response.json([]) }
        const missing = 'Teststraße 1, 10551 Berlin'
        assert.deepEqual(await (await restarted.fetch(req(missing))).json(), { results: [] })
        await restarted.fetch(req(missing))
        assert.equal(calls, 3)
    } finally { globalThis.fetch = originalFetch; Date.now = originalNow }
})
test('concurrent users cannot produce parallel upstream requests; failures release the lock', async () => {
    const originalFetch = globalThis.fetch
    let release: (() => void) | undefined
    try {
        globalThis.fetch = async () => { await new Promise<void>(resolve => { release = resolve }); return Response.json([result]) }
        const actor = new AddressGeocoder(memory(), env)
        const first = actor.fetch(req())
        assert.equal((await actor.fetch(req())).status, 429)
        while (!release) await new Promise(resolve => setTimeout(resolve, 0))
        release()
        assert.equal((await first).status, 200)
        globalThis.fetch = async () => { throw new Error('offline') }
        assert.equal((await new AddressGeocoder(memory(), env).fetch(req())).status, 502)
    } finally { globalThis.fetch = originalFetch }
})
test('route has independent method, origin, binding, input and rate checks', async () => {
    assert.equal((await handleGeocode(req(), {})).status, 503)
    const bindings = { GEOCODE: { idFromName: (name: string) => name, get: () => ({ fetch: async () => Response.json({ results: [] }) }) }, GEOCODE_LIMITER: { limit: async () => ({ success: true }) } }
    assert.equal((await handleGeocode(req('x'.repeat(2000)), bindings)).status, 400)
    assert.equal((await handleGeocode(req(), bindings)).status, 200)
    assert.equal((await handleGeocode(req(), { ...bindings, GEOCODE_LIMITER: { limit: async () => ({ success: false }) } })).status, 429)
    const workerEnv = { ...bindings, ALLOWED_ORIGINS: 'https://app.test', LINK_LIMITER: { limit: async () => ({ success: true }) } }
    assert.equal((await worker.fetch(new Request('https://worker.test/geocode', { method: 'POST', headers: { Origin: 'https://evil.test' } }), workerEnv)).status, 403)
    const response = await worker.fetch(new Request('https://worker.test/geocode', { method: 'POST', headers: { Origin: 'https://app.test' }, body: JSON.stringify({ address }) }), workerEnv)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://app.test')
})
test('client handles unavailable, timeout, missing configuration, multiple results and cancellation', async () => {
    const originalFetch = globalThis.fetch
    const signal = new AbortController().signal
    try {
        await assert.rejects(lookupAddress(address, null, signal), /unconfigured/)
        await assert.rejects(lookupAddress('Berlin', 'https://test/geocode', signal), /incomplete/)
        for (const [status, message] of [[429,'busy'], [504,'timeout'], [502,'unavailable']] as const) {
            globalThis.fetch = async () => new Response('', { status })
            await assert.rejects(lookupAddress(address, 'https://test/geocode', signal), new RegExp(message))
        }
        globalThis.fetch = async () => Response.json({ results: nominatimResults([result, result], address) })
        assert.equal((await lookupAddress(address, 'https://test/geocode', signal)).length, 2)
        const controller = new AbortController()
        globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))
        const promise = lookupAddress('Turmstraße 34, 10551 Berlin', 'https://test/geocode', controller.signal)
        controller.abort()
        await assert.rejects(promise, { name: 'AbortError' })
    } finally { globalThis.fetch = originalFetch }
})

test('Marienburger Straße: exact address first, wrong buildings excluded, incomplete/ranges approximate', () => {
    const requested = 'Marienburger Str. 29, 10405 Berlin'
    const exact = { ...result, address: { ...result.address, road: 'Marienburger Straße', house_number: '29', postcode: '10405' } }
    const changed = (patch: Record<string, string | undefined>) => ({ ...exact, address: { ...exact.address, ...patch } })
    for (const patch of [{house_number:'31'}, {house_number:'29a'}, {postcode:'10409'}, {road:'Danziger Straße'}]) {
        assert.deepEqual(nominatimResults([changed(patch)], requested), [])
    }
    const matches = nominatimResults([changed({house_number:undefined}), changed({house_number:'27-29'}), exact, changed({postcode:undefined})], requested)
    assert.equal(matches.length, 4)
    assert.equal(matches[0].approximate, false)
    assert.equal(matches[0].verifiedAddress?.toLowerCase(), 'marienburger straße 29, 10405 berlin')
    assert.ok(matches.slice(1).every(p => p.verifiedAddress === undefined))
    assert.ok(matches.slice(1).every(p => p.approximate))
    assert.equal(nominatimResults([changed({house_number:'29 A'})], 'Marienburger Straße 29a, 10405 Berlin')[0].approximate, false)
})
test('old unchecked cached locations are not returned', async () => {
    const state = memory(), originalFetch = globalThis.fetch
    await state.storage.put('cache', [{ key: env.GEOCODER_URL + '|' + address.toLowerCase(), until: Date.now()+86400000, results: [{ latitude: 52.5, longitude: 13.4, address:'wrong', approximate:false }] }])
    let calls = 0
    try {
        globalThis.fetch = async url => { calls++; const query = new URL(String(url)).searchParams; assert.equal(query.get('q'), null); assert.equal(query.get('street'),'85 Turmstraße'); assert.equal(query.get('postalcode'),'10551'); return Response.json([result]) }
        const response = await new AddressGeocoder(state, env).fetch(req())
        assert.equal(calls, 1)
        assert.equal((await response.json() as { results: { address: string }[] }).results[0].address, address)
    } finally { globalThis.fetch = originalFetch }
})
