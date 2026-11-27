import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { locateNeighborhood } from '../src/services/neighborhoodBoundaries'
import type { Boundary } from '../src/services/neighborhoodBoundaries'
import { getDistrictForNeighborhood } from '../src/data/berlinOrtsteile'
const boundaries: Boundary[] = JSON.parse(readFileSync('public/boundaries/ortsteile-2026-11-28.json','utf8'))
test('official dataset has 97 valid Ortsteile, not Bezirke', () => {
    assert.equal(boundaries.length,97)
    assert.equal(new Set(boundaries.map(b=>b.name)).size,97)
    for (const b of boundaries) assert.ok(getDistrictForNeighborhood(b.name), b.name)
    const moabit = locateNeighborhood(boundaries,{latitude:52.5263088,longitude:13.3382169})
    assert.deepEqual(moabit,{name:'Moabit',uncertain:false})
    assert.equal(getDistrictForNeighborhood(moabit.name!), 'Mitte')
    assert.deepEqual(locateNeighborhood(boundaries,{latitude:52.539,longitude:13.425}),{name:'Prenzlauer Berg',uncertain:false})
    assert.equal(getDistrictForNeighborhood('Prenzlauer Berg'),'Pankow')
})
test('holes, multipart geometry, borders and outside points remain uncertain', () => {
    const square = (x:number,y:number,size:number) => [[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]]
    const area: Boundary = {name:'Test',bounds:[13,52,13.04,52.04],polygons:[[square(13,52,.02),square(13.005,52.005,.005)],[square(13.03,52.03,.01)]]}
    assert.deepEqual(locateNeighborhood([area],{latitude:52.015,longitude:13.015}),{name:'Test',uncertain:false})
    assert.deepEqual(locateNeighborhood([area],{latitude:52.035,longitude:13.035}),{name:'Test',uncertain:false})
    assert.deepEqual(locateNeighborhood([area],{latitude:52.007,longitude:13.007}),{name:null,uncertain:true})
    assert.equal(locateNeighborhood([area],{latitude:52.01,longitude:13}).uncertain,true)
    assert.equal(locateNeighborhood(boundaries,{latitude:48.1,longitude:11.5}).name,null)
    assert.equal(locateNeighborhood(boundaries,{latitude:NaN,longitude:13.4}).name,null)
})
