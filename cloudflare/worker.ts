import { handleGeocode } from './geocode'
import type { GeocodeEnv } from './geocode'
export { AddressGeocoder } from './geocode'
import { googleMapsUrl, isShortMapsUrl } from '../src/services/googleMapsUrls'
interface Env extends GeocodeEnv {
    ALLOWED_ORIGINS: string
    LINK_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> }
}
// Follow only allowlisted redirects. Never fetch arbitrary hosts, cookies or Google page content.
export async function resolveLink(input: string, requestFetch: typeof fetch = fetch): Promise<string> {
    let current = googleMapsUrl(input)
    if (!current) throw new Error('invalid_link')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 7000)
    try {
        for (let hop = 0; hop < 5; hop++) {
            if (!isShortMapsUrl(current)) return current.href
            const response = await requestFetch(current.href, { redirect: 'manual', signal: controller.signal, headers: { Accept: 'text/html' } })
            const next = response.headers.get('location')
            await response.body?.cancel()
            if (![301, 302, 303, 307, 308].includes(response.status) || !next) throw new Error('unresolved')
            const validated = googleMapsUrl(new URL(next, current).href)
            if (!validated) throw new Error('unsafe_redirect')
            current = validated
        }
        if (!isShortMapsUrl(current)) return current.href
        throw new Error('too_many_redirects')
    } finally { clearTimeout(timer) }
}
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const origin = request.headers.get('Origin') ?? ''
        const allowed = env.ALLOWED_ORIGINS.split(',').map(value => value.trim()).filter(Boolean)
        const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
        if (!allowed.includes(origin)) return new Response('Forbidden', { status: 403 })
        if (new URL(request.url).pathname === '/geocode') {
            const response = await handleGeocode(request, env)
            return new Response(response.body, { status: response.status, headers })
        }
        if (new URL(request.url).pathname !== '/resolve') return new Response('Not found', { status: 404, headers })
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
        if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers })
        const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
        if (!env.LINK_LIMITER || !(await env.LINK_LIMITER.limit({ key: ip })).success) return new Response(JSON.stringify({ error: 'rate_limit' }), { status: 429, headers })
        // Bound actual streamed bytes, not only a caller-controlled Content-Length.
        if (!request.body) return new Response('{}', { status: 400, headers })
        const reader = request.body.getReader()
        let size = 0
        const chunks: Uint8Array[] = []
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.length
            if (size > 8192) { await reader.cancel(); return new Response('{}', { status: 413, headers }) }
            chunks.push(value)
        }
        try {
            const body = new Uint8Array(size)
            let offset = 0
            for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length }
            const data = JSON.parse(new TextDecoder().decode(body))
            if (typeof data.url !== 'string') throw new Error('invalid_link')
            const url = await resolveLink(data.url)
            return new Response(JSON.stringify({ url }), { headers })
        } catch {
            return new Response(JSON.stringify({ error: 'unresolved' }), { status: 422, headers })
        }
    }
}
