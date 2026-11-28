import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { shouldAutoLookup, suggestedNeighborhood } from '../src/services/importLocationSuggestion'
import { lookupAddress } from '../src/services/addressLookup'
const boundaries = JSON.parse(readFileSync('public/boundaries/ortsteile-2026-11-28.json','utf8'))
const address = 'Marienburger Str. 29, 10405 Berlin'
const exact = { latitude:52.5336374, longitude:13.4283876, address:'al andalus, Marienburger Straße 29, 10405 Berlin', approximate:false }
test('automatic lookup requires unchanged complete imported address and no confirmed coordinates', () => {
    assert.equal(shouldAutoLookup(address,address,false),true)
    assert.equal(shouldAutoLookup(address,address,true),false)
    assert.equal(shouldAutoLookup('',address,false),false)
    assert.equal(shouldAutoLookup('Marienburger Str.',address,false),false)
    assert.equal(shouldAutoLookup(address,'Marienburger Str. 30, 10405 Berlin',false),false)
})
test('al andalus has a Prenzlauer Berg suggestion only for a single reliable result', () => {
    assert.equal(suggestedNeighborhood([exact],boundaries),'Prenzlauer Berg')
    assert.equal(suggestedNeighborhood([],boundaries),null)
    assert.equal(suggestedNeighborhood([exact,{...exact,latitude:52.5338015}],boundaries),null)
    assert.equal(suggestedNeighborhood([{...exact,approximate:true}],boundaries),null)
    assert.equal(suggestedNeighborhood([{...exact,latitude:48}],boundaries),null)
})
test('same address shares requests, one cancelled consumer does not cancel others, successful results reused', async () => {
    const previous = globalThis.fetch
    let calls=0, release: (()=>void) | undefined, upstream: AbortSignal | undefined
    try {
        globalThis.fetch = async (_url, options) => { calls++; upstream=options?.signal ?? undefined; await new Promise<void>(resolve=>{release=resolve}); return Response.json({results:[exact]}) }
        const a=new AbortController(),b=new AbortController()
        const first=lookupAddress(address,'https://shared.test/geocode',a.signal)
        const second=lookupAddress(address,'https://shared.test/geocode',b.signal)
        a.abort()
        await assert.rejects(first,{name:'AbortError'})
        assert.equal(upstream?.aborted,false)
        release!()
        assert.deepEqual(await second,[exact])
        assert.deepEqual(await lookupAddress(address,'https://shared.test/geocode',new AbortController().signal),[exact])
        assert.equal(calls,1)
    } finally { globalThis.fetch=previous }
})
test('new import cancels old request and never reuses the other address result', async () => {
    const previous=globalThis.fetch
    let firstSignal: AbortSignal | undefined
    try {
        globalThis.fetch=async (_url,options) => {
            const body=JSON.parse(String(options?.body))
            if(body.address.includes('29')) return new Promise((_resolve,reject)=>{
                firstSignal=options?.signal ?? undefined
                firstSignal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))
            })
            return Response.json({results:[]})
        }
        const controller=new AbortController()
        const first=lookupAddress(address,'https://sequential.test/geocode',controller.signal)
        controller.abort()
        await assert.rejects(first,{name:'AbortError'})
        assert.equal(firstSignal?.aborted,true)
        assert.deepEqual(await lookupAddress('Marienburger Straße 30, 10405 Berlin','https://sequential.test/geocode',new AbortController().signal),[])
    } finally {globalThis.fetch=previous}
})
