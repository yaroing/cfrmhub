import type { Category } from '../types'

export function categoryLabel(c: Pick<Category, 'label_fr' | 'label_en'> | null | undefined, lang: string): string {
  if (!c) return '—'
  if (lang.startsWith('en') && c.label_en) return c.label_en
  return c.label_fr
}
