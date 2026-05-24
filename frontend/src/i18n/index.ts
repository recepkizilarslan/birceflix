import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import tr from './locales/tr.json'
import en from './locales/en.json'
import de from './locales/de.json'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
      de: { translation: de },
    },
    fallbackLng: 'tr',
    supportedLngs: ['tr', 'en', 'de'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'birceflix.lang',
    },
    returnEmptyString: false,
  })

/** Map our active i18n lang code → an Intl BCP-47 locale for date/number
 *  formatting AND for forwarding to TMDB's `language` query param.
 *  Backend's uiLanguageSchema allow-lists the exact strings this returns,
 *  so adding a new locale here requires the same string to be added there. */
export function intlLocale(): string {
  const lng = (i18n.language || 'tr').toLowerCase()
  if (lng.startsWith('en')) return 'en-US'
  if (lng.startsWith('de')) return 'de-DE'
  return 'tr-TR'
}

export default i18n
