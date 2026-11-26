import i18n from '../i18n'

// MapLibre creates controls outside React. Keep labels current without resetting the map.
export function bindMapLanguage(container: HTMLElement): () => void {
    const labels: Record<string, string> = {
        '.maplibregl-ctrl-geolocate': 'Meinen Standort anzeigen',
        '.maplibregl-canvas': 'Karte',
        '.maplibregl-marker': 'Kartenmarkierung',
        '.maplibregl-ctrl-zoom-in': 'Vergrößern',
        '.maplibregl-ctrl-zoom-out': 'Verkleinern',
        '.maplibregl-ctrl-compass': 'Karte nach Norden ausrichten',
        '.maplibregl-ctrl-attrib-button': 'Vollständige Quellenangabe anzeigen',
        '.maplibregl-popup-close-button': 'Informationsfenster schließen'
    }
    const update = () => {
        for (const [selector, key] of Object.entries(labels)) {
            container.querySelectorAll<HTMLElement>(selector).forEach(element => {
                const label = i18n.t(key)
                element.setAttribute('aria-label', label)
                if (element.tagName === 'BUTTON') element.title = label
            })
        }
    }
    const observer = new MutationObserver(update)
    observer.observe(container, { childList: true, subtree: true })
    i18n.on('languageChanged', update)
    update()
    return () => {
        observer.disconnect()
        i18n.off('languageChanged', update)
    }
}
