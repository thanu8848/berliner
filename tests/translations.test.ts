import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
test('all static UI translation keys and placeholders exist in both languages',()=>{
 const de=JSON.parse(fs.readFileSync('src/locales/de.json','utf8')),en=JSON.parse(fs.readFileSync('src/locales/en.json','utf8'))
 assert.deepEqual(Object.keys(de).sort(),Object.keys(en).sort())
 for(const key of Object.keys(de)) assert.deepEqual((de[key].match(/{{\w+}}/g)||[]).sort(),(en[key].match(/{{\w+}}/g)||[]).sort(),key)
 for(const file of fs.readdirSync('src/components').filter(f=>f.endsWith('.tsx')).map(f=>'src/components/'+f).concat(['src/App.tsx'])) {
  const text=fs.readFileSync(file,'utf8')
  for(const m of text.matchAll(/\bt\((['"])([^'"\n]+)\1/g)) assert.ok(m[2].replaceAll('\\n','\n') in de,`${file}: ${m[2]}`)
 }
})
