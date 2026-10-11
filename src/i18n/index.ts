import { useApp } from '../store/app'
import type { Lang } from '../domain/types'
import { en } from './en'

/**
 * i18n : le français est la langue source, la clé EST la phrase française.
 * Une phrase absente du dictionnaire anglais retombe sur le français.
 * Paramètres : « {n} » remplacé par params.n.
 */
export function translate(lang: Lang, fr: string, params?: Record<string, string | number>): string {
  let s = lang === 'en' ? (en[fr] ?? fr) : fr
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v))
  return s
}

export function useT() {
  const lang = useApp((s) => s.prefs.lang)
  const t = (fr: string, params?: Record<string, string | number>) => translate(lang, fr, params)
  return { t, lang, locale: lang === 'en' ? 'en-GB' : 'fr-FR' }
}
