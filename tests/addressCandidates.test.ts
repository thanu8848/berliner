import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupAddressCandidates, automaticLocation } from '../src/services/importLocationSuggestion'
const a = { latitude: 52.5338, longitude: 13.4286, address: 'al andalus, Marienburger Straße 29, 10405 Berlin', verifiedAddress: 'Marienburger Straße 29, 10405 Berlin', approximate: false }
test('candidate display merges only verified identical location and business descriptions', () => {
 assert.deepEqual(groupAddressCandidates([a, {...a}]), [a])
 for (const other of [{...a,address:'Other café, Marienburger Straße 29, 10405 Berlin'}, {...a,latitude:52.5337}, {...a,verifiedAddress:'Marienburger Straße 30, 10405 Berlin'}, {...a,approximate:true}, {...a,verifiedAddress:undefined}]) {
  assert.equal(groupAddressCandidates([a,other]).length, 2)
 }
 assert.equal(groupAddressCandidates([{...a,approximate:true},{...a,approximate:true}]).length,2)
})
test('display grouping does not weaken automatic coordinate acceptance', () => {
 const others = [a, {...a, latitude:52.5337}]
 assert.equal(automaticLocation(others,a.verifiedAddress),null)
 assert.equal(automaticLocation(groupAddressCandidates(others),a.verifiedAddress),null)
 assert.deepEqual(automaticLocation([a,{...a}],a.verifiedAddress),a)
})
