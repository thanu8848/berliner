import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { searchCatalog, loadCatalog } from '../src/services/catalog'
const manifest=JSON.parse(readFileSync('public/catalog/manifest.json','utf8'))
const data=JSON.parse(readFileSync(`public/catalog/${manifest.file}`,'utf8'))
test('catalog date, unique IDs, supported POIs and coordinates',()=>{
 assert.equal(data.places.length,manifest.count)
 assert.ok(data.places.length>1000)
 assert.equal(new Set(data.places.map(p=>p.osmId)).size,data.places.length)
 assert.ok(Number.isFinite(Date.parse(data.sourceDate)))
 for(const p of data.places) {
  assert.ok(p.name && ['restaurant','imbiss','cafe','bar','kneipe'].includes(p.category))
  assert.ok(p.latitude>=52.3 && p.latitude<=52.75 && p.longitude>=13.05 && p.longitude<=13.8)
 }
})
test('name, address, nearby and category search',()=>{
 assert.ok(searchCatalog(data.places,'Zum Stammtisch').some(p=>p.name==='Zum Stammtisch'))
 assert.ok(searchCatalog(data.places,'Bredowstraße').length)
 assert.ok(searchCatalog(data.places,'',{latitude:52.530158,longitude:13.340197}).length)
 assert.equal(searchCatalog(data.places,'').length,0)
 assert.ok(searchCatalog(data.places,'',{latitude:52.530158,longitude:13.340197},'kneipe').every(p=>p.category==='kneipe'))
 const start=performance.now()
 for(let i=0;i<10;i++) searchCatalog(data.places,'Zum Stammtisch')
 console.log(`Catalog search average: ${((performance.now()-start)/10).toFixed(1)} ms`)
})
test('abort shared fetch; deduplicate and cache successful loads',async()=>{
 const realFetch=globalThis.fetch
 let calls=0
 try {
  globalThis.fetch=async (_url,options)=>{calls++;return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true}))}
  const controller=new AbortController(),promise=loadCatalog(controller.signal)
  controller.abort()
  await assert.rejects(promise,{name:'AbortError'})
  await new Promise(resolve=>setTimeout(resolve,0))
  calls=0
  globalThis.fetch=async url=>{calls++;return Response.json(String(url).endsWith('manifest.json')?manifest:data)}
  const [a,b]=await Promise.all([loadCatalog(new AbortController().signal),loadCatalog(new AbortController().signal)])
  assert.equal(a,b);assert.equal(calls,2)
  assert.equal(await loadCatalog(new AbortController().signal),a);assert.equal(calls,2)
 } finally {globalThis.fetch=realFetch}
})
