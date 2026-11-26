import { useTranslation } from 'react-i18next'

export default function LanguageSwitcher() {
    const { t, i18n } = useTranslation()
    return (
        <nav className="language-switcher" aria-label={t('Sprache')}>
            {(['de', 'en'] as const).map(language => (
                <button
                    key={language}
                    type="button"
                    lang={language}
                    aria-pressed={i18n.resolvedLanguage === language}
                    onClick={() => void i18n.changeLanguage(language)}
                >
                    {language === 'de' ? 'Deutsch' : 'English'}
                </button>
            ))}
        </nav>
    )
}
