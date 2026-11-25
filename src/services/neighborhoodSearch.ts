import { berlinOrtsteile } from '../data/berlinOrtsteile'

function normalize(value: string): string {
    return value.toLocaleLowerCase('de-DE').normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss')
        .replace(/[^a-z]/g, '')
}

function distance(a: string, b: string): number {
    let row = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
        const next = [i]
        for (let j = 1; j <= b.length; j++) {
            next[j] = Math.min(next[j - 1] + 1, row[j] + 1,
                row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
        }
        row = next
    }
    return row[b.length]
}

export function suggestNeighborhoods(input: string): string[] {
    const query = normalize(input)
    if (!query) return []
    const tokens = input.trim().split(/[\s-]+/).map(normalize).filter(Boolean)
    return berlinOrtsteile.map(name => {
        const candidate = normalize(name)
        let score = Infinity
        if (candidate === query) score = 0
        else if (candidate.startsWith(query)) score = 1
        else if (candidate.includes(query)) score = 2
        else if (tokens.length > 1 && tokens.every(token => candidate.includes(token))) score = 3
        else if (query.length >= 4) {
            const edits = Math.min(distance(query, candidate),
                distance(query, candidate.slice(0, query.length)))
            if (edits <= Math.min(3, Math.floor(query.length / 4))) score = 4 + edits
        }
        return { name, score }
    }).filter(item => Number.isFinite(item.score))
        .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, 'de'))
        .slice(0, 6).map(item => item.name)
}
