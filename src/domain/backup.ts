import type { BackupFile, Habit } from './types'
import { DEFAULT_PREFS, SCHEMA_VERSION } from './types'
import { isValidDateStr } from './dates'

export interface ParseResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  backup?: BackupFile
}

const COLLECTIONS = [
  'habits', 'logs', 'categories', 'goals', 'routines', 'routineLogs',
  'focusSessions', 'journal', 'reminders', 'achievements', 'challenges',
] as const

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Valide un fichier de sauvegarde SANS rien modifier. Les erreurs bloquent la
 * restauration ; les avertissements (ex. références orphelines supprimées) non.
 */
export function parseBackup(text: string): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['Le fichier n’est pas un JSON valide.'], warnings }
  }
  if (!isObj(raw) || raw.app !== 'momentum' || !isObj(raw.data)) {
    return { ok: false, errors: ['Ce fichier n’est pas une sauvegarde Momentum.'], warnings }
  }
  if (typeof raw.schemaVersion !== 'number' || raw.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, errors: [`Version de schéma non prise en charge (${String(raw.schemaVersion)}).`], warnings }
  }
  const src = raw.data
  const data: Record<string, unknown> = {}
  for (const c of COLLECTIONS) {
    const arr = src[c]
    if (arr === undefined) { data[c] = []; continue }
    if (!Array.isArray(arr)) { errors.push(`« ${c} » doit être une liste.`); continue }
    const ids = new Set<string>()
    for (const [i, item] of arr.entries()) {
      if (!isObj(item) || typeof item.id !== 'string' || !item.id) {
        errors.push(`${c}[${i}] : identifiant manquant.`)
        continue
      }
      if (ids.has(item.id)) errors.push(`${c} : identifiant en double « ${item.id} ».`)
      ids.add(item.id)
    }
    data[c] = arr
  }
  const habits = (data.habits ?? []) as Habit[]
  for (const h of habits) {
    if (typeof h.name !== 'string' || !h.name.trim()) errors.push(`Habitude ${h.id} : nom manquant.`)
    if (!isValidDateStr(h.startDate)) errors.push(`Habitude ${h.id} : date de début invalide.`)
    if (!h.schedule || typeof h.schedule !== 'object') errors.push(`Habitude ${h.id} : planning manquant.`)
    if (!['binary', 'quantity', 'duration'].includes(h.tracking)) errors.push(`Habitude ${h.id} : type de suivi inconnu.`)
  }
  const logs = (data.logs ?? []) as { id: string; habitId?: unknown; date?: unknown; value?: unknown }[]
  for (const l of logs) {
    if (typeof l.habitId !== 'string' || !isValidDateStr(l.date) || typeof l.value !== 'number' || !Number.isFinite(l.value) || l.value < 0)
      errors.push(`Entrée ${l.id} invalide.`)
    else if (l.id !== `${l.habitId}_${l.date}`) errors.push(`Entrée ${l.id} : identifiant incohérent.`)
  }
  if (errors.length) return { ok: false, errors: errors.slice(0, 12), warnings }

  const habitIds = new Set(habits.map((h) => h.id))
  const before = logs.length
  data.logs = logs.filter((l) => habitIds.has(l.habitId as string))
  if ((data.logs as unknown[]).length !== before) warnings.push(`${before - (data.logs as unknown[]).length} entrée(s) orpheline(s) ignorée(s).`)
  data.habits = habits.map((h) => ({ ...h, pauses: h.pauses ?? [], archived: h.archived ?? false }))
  data.prefs = { ...DEFAULT_PREFS, ...(isObj(src.prefs) ? src.prefs : {}) }

  return { ok: true, errors, warnings, backup: { app: 'momentum', schemaVersion: SCHEMA_VERSION, exportedAt: Number(raw.exportedAt) || Date.now(), data: data as unknown as BackupFile['data'] } }
}

const csvCell = (v: unknown) => {
  const s = String(v ?? '')
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function logsToCsv(data: Pick<BackupFile['data'], 'habits' | 'logs' | 'categories'>): string {
  const hab = new Map(data.habits.map((h) => [h.id, h]))
  const cat = new Map(data.categories.map((c) => [c.id, c.name]))
  const rows = ['date,habit_id,habit,category,value,unit,note']
  for (const l of [...data.logs].sort((a, b) => a.date.localeCompare(b.date))) {
    const h = hab.get(l.habitId)
    rows.push([l.date, l.habitId, h?.name, h?.categoryId ? cat.get(h.categoryId) : '', l.value, h?.unit ?? '', l.note ?? ''].map(csvCell).join(','))
  }
  return rows.join('\n')
}
