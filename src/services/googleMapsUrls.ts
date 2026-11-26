const GOOGLE_HOSTS = new Set(['google.com', 'google.de', 'google.at', 'google.ch', 'google.co.uk', 'google.fr', 'google.es', 'google.it', 'google.nl', 'google.ca', 'google.com.au'])
export function googleMapsUrl(input: string): URL | null {
    try {
        const extracted = input.trim().match(/https:\/\/[^\s<>]+/i)?.[0]
        const url = new URL(extracted ?? input.trim())
        if (url.protocol !== 'https:' || url.username || url.password || url.port || url.href.length > 4096) return null
        const host = url.hostname.toLowerCase()
        if (host === 'maps.app.goo.gl' && /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return url
        if (host === 'goo.gl' && /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return url
        const base = host.replace(/^(www|maps)\./, '')
        if (GOOGLE_HOSTS.has(base) && (url.pathname === '/maps' || url.pathname.startsWith('/maps/') || host.startsWith('maps.'))) return url
        return null
    } catch { return null }
}
export function isShortMapsUrl(url: URL): boolean {
    return url.hostname === 'maps.app.goo.gl' || url.hostname === 'goo.gl'
}
