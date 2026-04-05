import { useTranslation } from 'react-i18next'
import { enUS, fr } from 'date-fns/locale'

export function useDateFnsLocale() {
  const { i18n } = useTranslation()
  return i18n.language.startsWith('en') ? enUS : fr
}
