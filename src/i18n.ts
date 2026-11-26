import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { SyntheticEvent } from 'react'
import de from './locales/de.json'
import en from './locales/en.json'

const LANGUAGE_KEY = 'berliner-language'

export function detectLanguage(): 'de' | 'en' {
    try {
        const saved = localStorage.getItem(LANGUAGE_KEY)
        if (saved === 'de' || saved === 'en') return saved
    } catch { /* Browsers may disable storage. */ }
    for (const language of navigator.languages ?? [navigator.language]) {
        const base = language.toLowerCase().split('-')[0]
        if (base === 'de' || base === 'en') return base
    }
    return 'en'
}

function updateDocument(language: string) {
    document.documentElement.lang = language
    document.title = 'Berliner'
    // Discard old-language custom validity messages; regenerate on next validation.
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input, textarea, select'
    ).forEach(field => field.setCustomValidity(''))
    try { localStorage.setItem(LANGUAGE_KEY, language) } catch { /* Optional preference. */ }
}

i18n.on('languageChanged', updateDocument)
void i18n.use(initReactI18next).init({
    resources: { de: { translation: de }, en: { translation: en } },
    lng: detectLanguage(),
    fallbackLng: 'en',
    supportedLngs: ['de', 'en'],
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    // Bundled dictionaries are available synchronously, including on a static host.
    initAsync: false
})

export function clearValidation(event: SyntheticEvent) {
    const field = event.target
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
        field.setCustomValidity('')
    }
}

export function translateValidation(event: SyntheticEvent) {
    const field = event.target
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
        field.setCustomValidity('')
        field.setCustomValidity(i18n.t(field.validity.valueMissing
            ? 'Bitte fülle dieses Feld aus.'
            : field.validity.typeMismatch ? 'Bitte gib eine gültige URL ein.' : 'Bitte überprüfe deine Eingabe.'))
    }
}

export default i18n
