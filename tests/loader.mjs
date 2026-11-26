import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
registerHooks({
 resolve(specifier,context,next) {
  if(specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/.test(specifier)) {
   const url=new URL(specifier+'.ts',context.parentURL)
   if(existsSync(url)) return {url:url.href,shortCircuit:true}
  }
  return next(specifier,context)
 },
 load(url,context,next) {
  if(url.endsWith('.ts')) return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8').replaceAll('import.meta.env.BASE_URL',"'/berliner/'")),shortCircuit:true}
  return next(url,context)
 }
})
