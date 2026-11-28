// Presentation only: never use this label for matching, deduplication or storage.
export function compactAddress(address: string): string {
    const parts = address.split(',').map(part => part.trim()).filter(Boolean)
    const house = /^\d+[a-z]?(?:\s*[-/]\s*\d+[a-z]?)?$/i
    const street = /(?:straße|strasse|str\.|weg|allee|platz|damm|ufer|chaussee|gasse|steig|ring|promenade|zeile|pfad|markt|\bAm\b|\bAn der\b)/i
    let line = ''
    for (let i = 0; i < parts.length; i++) {
        if (!street.test(parts[i])) continue
        if (/\s\d+[a-z]?(?:[-/]\d+[a-z]?)?$/i.test(parts[i])) line = parts[i]
        else if (i > 0 && house.test(parts[i - 1])) line = `${parts[i]} ${parts[i - 1]}`
        else if (i + 1 < parts.length && house.test(parts[i + 1])) line = `${parts[i]} ${parts[i + 1]}`
        if (line) break
    }
    // Unknown formats remain intact instead of presenting a guessed address.
    if (!line) return address
    const postcode = parts.find(part => /^\d{5}(?:\s|$)/.test(part))?.match(/^\d{5}/)?.[0]
    return postcode ? `${line} · ${postcode}` : line
}
