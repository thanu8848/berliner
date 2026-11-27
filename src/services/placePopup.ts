import i18n from '../i18n'
import type { Place } from '../types/place'
import { categoryLabels, statusLabels } from '../data/placeLabels'

// Informationsfenster für einen gespeicherten Ort
export function createPlacePopup(
    place: Place,
    onEdit: (place: Place) => void,
    onDelete: (place: Place) => void
) {
    const t = i18n.t.bind(i18n)
    const content = document.createElement('div')

    // Name
    const title = document.createElement('h3')
    title.textContent = place.name

    // Kategorie und Bezirk
    const category = document.createElement('p')
    category.textContent =
        `${t(categoryLabels[place.category])} · ${place.neighborhood ?? place.district}`

    // Entdeckerstatus
    const status = document.createElement('p')
    status.textContent =
        t('Status: {{status}}', { status: t(statusLabels[place.status]) })

    content.append(title, category, status)

    if (place.address) {
        const address = document.createElement('p')
        address.textContent = place.address
        content.append(address)
    }

    // Küche
    if (place.cuisine && place.cuisine.length > 0) {
        const cuisine = document.createElement('p')
        cuisine.textContent =
            t('Küche: {{cuisine}}', { cuisine: place.cuisine.join(', ') })

        content.append(cuisine)
    }

    // Sitzmöglichkeiten
    if (place.seating) {
        const seating = document.createElement('p')

        const seatingLabels = {
            yes: t("Ja"),
            no: t("Nein"),
            unknown: t("Unbekannt")
        }

        seating.textContent =
            t('Sitzplätze: {{seating}}', { seating: seatingLabels[place.seating.available] })

        content.append(seating)

        if (place.seating.available === 'yes') {
            const details: string[] = []

            if (place.seating.capacity === 'few') {
                details.push(t("Wenige Sitzplätze"))
            }

            if (place.seating.capacity === 'many') {
                details.push(t("Viele Sitzplätze"))
            }

            if (place.seating.indoor) {
                details.push(t("Drinnen"))
            }

            if (place.seating.outdoor) {
                details.push(t("Draußen"))
            }

            if (place.seating.cozy) {
                details.push(t("Gemütlich"))
            }

            if (place.seating.cramped) {
                details.push(t("Eng"))
            }

            if (details.length > 0) {
                const seatingDetails = document.createElement('p')
                seatingDetails.textContent = details.join(' · ')
                content.append(seatingDetails)
            }
        }
    }

    // Notizen
    if (place.notes) {
        const notes = document.createElement('p')
        notes.textContent = place.notes
        content.append(notes)
    }

    // Website
    if (place.website && /^https?:\/\//i.test(place.website)) {
        const website = document.createElement('a')
        website.href = place.website
        website.target = '_blank'
        website.rel = 'noopener noreferrer'
        website.textContent = t("Website öffnen")

        const websiteContainer = document.createElement('p')
        websiteContainer.append(website)
        content.append(websiteContainer)
    }

    
    // Navigation mit Google Maps
    const navigation = document.createElement('a')

// Gespeicherten Google-Maps-Link prüfen
    let googleMapsUrl: string | null = null

    if (place.googleMapsUrl) {
        try {
            const url = new URL(place.googleMapsUrl)

            const host = url.hostname.toLowerCase()

            const isGoogleMaps =
                url.protocol === 'https:' &&
                (
                    host === 'maps.app.goo.gl' ||
                    (host === 'goo.gl' &&
                        url.pathname.startsWith('/maps/')) ||
                    (
                        [
                            'google.com',
                            'www.google.com',
                            'maps.google.com',
                            'google.de',
                            'www.google.de'
                        ].includes(host) &&
                        url.pathname.startsWith('/maps')
                    )
                )

            if (isGoogleMaps) {
                googleMapsUrl = url.href
            }
        } catch {
            // Ungültiger Link: andere Navigationsmethode verwenden
        }
    }

// Adresse bevorzugen, sonst Koordinaten verwenden
    const destination =
        place.address?.trim() ||
        `${place.latitude},${place.longitude}`

// Navigationsziel festlegen
    navigation.href = googleMapsUrl ??
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`

    navigation.target = '_blank'
    navigation.rel = 'noopener noreferrer'

    navigation.textContent = googleMapsUrl
        ? t('Ort in Google Maps öffnen')
        : t('Route in Google Maps öffnen')
    const navigationContainer = document.createElement('p')
    navigationContainer.append(navigation)

    content.append(navigationContainer)

    // Aktionen: Bearbeiten und Löschen
    const actions = document.createElement('div')
    actions.className = 'popup-actions'

    const editButton = document.createElement('button')
    editButton.type = 'button'
    editButton.textContent = t("Bearbeiten")

    editButton.addEventListener('click', (event) => {
        event.stopPropagation()
        onEdit(place)
    })

    const deleteButton = document.createElement('button')
    deleteButton.type = 'button'
    deleteButton.textContent = t("Löschen")

    deleteButton.addEventListener('click', (event) => {
        event.stopPropagation()
        onDelete(place)
    })

    actions.append(editButton, deleteButton)
    content.append(actions)

    return content
}
