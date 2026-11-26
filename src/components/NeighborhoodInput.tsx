import { useTranslation } from 'react-i18next'
import { useId, useState } from 'react'
import { getDistrictForNeighborhood } from '../data/berlinOrtsteile'
import { suggestNeighborhoods } from '../services/neighborhoodSearch'

interface Props {
    required?: boolean
    value: string
    onChange: (value: string) => void
}

export default function NeighborhoodInput({ value, onChange, required = true }: Props) {
    const { t } = useTranslation()
    const id = useId()
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState(-1)
    const suggestions = suggestNeighborhoods(value)
    const valid = Boolean(getDistrictForNeighborhood(value))
    const expanded = open && suggestions.length > 0

    function choose(name: string) {
        onChange(name)
        setOpen(false)
        setActive(-1)
    }

    return (
        <div className="neighborhood-field">
            <label htmlFor={id}>{t("Ortsteil")}</label>
            <input
                id={id}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={expanded}
                aria-controls={expanded ? `${id}-list` : undefined}
                aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
                aria-describedby={`${id}-hint`}
                autoComplete="off"
                placeholder={t("z. B. Prenzlauer Berg")}
                value={value}
                required={required}
                onChange={event => {
                    onChange(event.target.value)
                    setActive(-1)
                    setOpen(true)
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => { setOpen(false); setActive(-1) }}
                onKeyDown={event => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault()
                        setOpen(true)
                        if (suggestions.length) {
                            setActive(current => event.key === 'ArrowDown'
                                ? (current + 1) % suggestions.length
                                : (current <= 0 ? suggestions.length - 1 : current - 1))
                        }
                    } else if (event.key === 'Enter' && expanded) {
                        event.preventDefault()
                        if (active >= 0) choose(suggestions[active])
                        else if (valid) setOpen(false)
                        else setActive(0)
                    } else if (event.key === 'Escape') {
                        event.preventDefault()
                        setOpen(false)
                        setActive(-1)
                    }
                }}
            />
            {expanded && (
                <ul id={`${id}-list`} role="listbox" aria-label={t("Ortsteile")} className="neighborhood-suggestions">
                    {suggestions.map((name, index) => (
                        <li
                            key={name}
                            id={`${id}-option-${index}`}
                            role="option"
                            aria-selected={index === active}
                            onPointerDown={event => event.preventDefault()}
                            onClick={() => choose(name)}
                        >
                            {name}
                        </li>
                    ))}
                </ul>
            )}
            <small id={`${id}-hint`} aria-live="polite">
                {valid ? t("Gültiger Ortsteil ausgewählt.")
                    : value.trim() && suggestions.length === 0
                        ? t("Kein passender Ortsteil gefunden. Bitte prüfe die Schreibweise.")
                        : t("Ortsteil eingeben und einen Vorschlag auswählen.")}
            </small>
        </div>
    )
}
