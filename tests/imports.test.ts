import { test } from 'node:test'
import assert from 'node:assert/strict'
import { googleMapsUrl } from '../src/services/googleMapsUrls'
import { parseGoogleMapsLink, splitPlaceLabel, extractGoogleMapsPlaceName, resolveGoogleMapsLink } from '../src/services/googleMaps'
import worker, { resolveLink } from '../cloudflare/worker'
import { findPossibleDuplicates, duplicateConfirmationKey } from '../src/services/placeDuplicates'
const short='https://maps.app.goo.gl/Example123'
const long='https://www.google.com/maps/place/Zum+Stammtisch,+Bredowstra%C3%9Fe+15,+10551+Berlin/data=!3d52.530158!4d13.340197'
test('shared text, precise coordinates and conservative address split',()=>{
 assert.equal(googleMapsUrl(`Schau mal: ${short}`)?.href,short)
 assert.equal(parseGoogleMapsLink(short).kind,'short')
 assert.deepEqual(parseGoogleMapsLink(long),{kind:'coordinates',latitude:52.530158,longitude:13.340197})
 assert.deepEqual(splitPlaceLabel(extractGoogleMapsPlaceName(long)),{name:'Zum Stammtisch',address:'Bredowstraße 15, 10551 Berlin'})
 for(const name of ['Tom, Dick & Harry','Bar - Berlin']) assert.deepEqual(splitPlaceLabel(name),{name,address:''})
 assert.equal(parseGoogleMapsLink('https://www.google.com/maps/@52.5,13.4,15z').kind,'no_coordinates')
 assert.equal(parseGoogleMapsLink('https://www.google.com/maps/?q=200,300').kind,'no_coordinates')
})
test('URL allowlist rejects arbitrary hosts, credentials and ports',()=>{
 for(const url of ['https://google.com.evil.test/maps','https://google.evil/maps','https://www.google.com/url?q=x','https://user:pass@maps.app.goo.gl/a','https://maps.app.goo.gl:8443/a','http://maps.app.goo.gl/a','https://127.0.0.1/maps']) assert.equal(googleMapsUrl(url),null,url)
})
test('redirect resolver never fetches final page; blocks unsafe redirects and loops',async()=>{
 let calls=0
 assert.equal(await resolveLink(short,(async()=>{calls++;return new Response(null,{status:302,headers:{Location:long}})}) as typeof fetch),new URL(long).href)
 assert.equal(calls,1)
 for(const next of ['https://127.0.0.1/private',short]) await assert.rejects(resolveLink(short,(async()=>new Response(null,{status:302,headers:{Location:next}})) as typeof fetch))
 await assert.rejects(resolveLink(short,(async()=>new Response('No redirect')) as typeof fetch))
})
test('worker enforces origin, method, body size and rate limit',async()=>{
 const env={ALLOWED_ORIGINS:'https://thanu8848.github.io',LINK_LIMITER:{limit:async()=>({success:true})}}
 const req=(method:string,origin='https://thanu8848.github.io',body?:string)=>new Request('https://resolver.test/resolve',{method,headers:{Origin:origin},body})
 assert.equal((await worker.fetch(req('POST','https://evil.test','{}'),env)).status,403)
 assert.equal((await worker.fetch(req('GET'),env)).status,405)
 assert.equal((await worker.fetch(req('OPTIONS'),env)).status,204)
 assert.equal((await worker.fetch(req('POST',undefined,'x'.repeat(9000)),env)).status,413)
 assert.equal((await worker.fetch(req('POST',undefined,'{}'),{...env,LINK_LIMITER:{limit:async()=>({success:false})}})).status,429)
 assert.equal((await worker.fetch(req('POST',undefined,'{}'),env)).status,422)
})
test('long links work without server; unconfigured short links report fallback',async()=>{
 await assert.rejects(resolveGoogleMapsLink(short,undefined,new AbortController().signal),/resolver_unconfigured/)
 assert.equal(await resolveGoogleMapsLink(long,undefined,new AbortController().signal),new URL(long).href)
})
test('duplicates still detect near names and ignore own ID',()=>{
 const old={id:'old',name:'Café Sonne',latitude:52.5,longitude:13.4,category:'cafe' as const,district:'Mitte',status:'vorgemerkt' as const}
 const candidate={...old,id:'new',name:'Cafe-Sonne'}
 assert.equal(findPossibleDuplicates(candidate,[old]).length,1)
 assert.equal(findPossibleDuplicates(old,[old]).length,0)
 assert.equal(findPossibleDuplicates({...candidate,name:'Pizza Mond'},[old]).length,0)
 assert.notEqual(duplicateConfirmationKey(candidate,[old]),duplicateConfirmationKey({...candidate,latitude:52.6},[old]))
})
