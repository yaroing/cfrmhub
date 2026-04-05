import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import fr from './locales/fr.json'

const STORAGE = 'cfrm_lang'

function detectLang(): string {
  if (typeof localStorage === 'undefined') return 'fr'
  return localStorage.getItem(STORAGE) ?? 'fr'
}

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: detectLang(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE, lng)
})

export default i18n
