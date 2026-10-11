import { type DBSchema, type IDBPDatabase, openDB } from 'idb'
import type {
  Achievement, BackupFile, Category, Challenge, DailyJournal, FocusSession, Goal, Habit,
  HabitLog, Reminder, Routine, RoutineLog, UserPreferences,
} from '../domain/types'
import { DEFAULT_PREFS, SCHEMA_VERSION } from '../domain/types'

export const DB_NAME = 'momentum'
export const DB_VERSION = 1

interface MomentumDB extends DBSchema {
  habits: { key: string; value: Habit }
  logs: { key: string; value: HabitLog; indexes: { byHabit: string; byDate: string } }
  categories: { key: string; value: Category }
  goals: { key: string; value: Goal }
  routines: { key: string; value: Routine }
  routineLogs: { key: string; value: RoutineLog }
  focusSessions: { key: string; value: FocusSession }
  journal: { key: string; value: DailyJournal }
  reminders: { key: string; value: Reminder }
  achievements: { key: string; value: Achievement }
  challenges: { key: string; value: Challenge }
  meta: { key: string; value: unknown }
}

export type StoreName =
  | 'habits' | 'logs' | 'categories' | 'goals' | 'routines' | 'routineLogs' | 'focusSessions'
  | 'journal' | 'reminders' | 'achievements' | 'challenges'
export const STORES: StoreName[] = [
  'habits', 'logs', 'categories', 'goals', 'routines', 'routineLogs', 'focusSessions',
  'journal', 'reminders', 'achievements', 'challenges',
]

let dbPromise: Promise<IDBPDatabase<MomentumDB>> | null = null

/** Migrations : une branche par version, appliquées dans l'ordre. */
export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<MomentumDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _new, tx) {
        if (oldVersion < 1) {
          for (const s of STORES) {
            if (s === 'logs') {
              const st = db.createObjectStore('logs', { keyPath: 'id' })
              st.createIndex('byHabit', 'habitId')
              st.createIndex('byDate', 'date')
            } else db.createObjectStore(s, { keyPath: 'id' })
          }
          db.createObjectStore('meta')
        }
        void tx
      },
    })
  }
  return dbPromise
}

/** Utilisé par les tests pour repartir d'une base vierge. */
export async function resetDBConnection() {
  if (dbPromise) (await dbPromise).close()
  dbPromise = null
}

export async function loadPrefs(): Promise<UserPreferences> {
  const db = await getDB()
  const p = (await db.get('meta', 'prefs')) as Partial<UserPreferences> | undefined
  return { ...DEFAULT_PREFS, ...(p ?? {}) }
}

export async function savePrefs(p: UserPreferences) {
  const db = await getDB()
  await db.put('meta', p, 'prefs')
}

export type AllData = BackupFile['data']

export async function loadAll(): Promise<AllData> {
  const db = await getDB()
  const [habits, logs, categories, goals, routines, routineLogs, focusSessions, journal, reminders, achievements, challenges, prefs] =
    await Promise.all([
      db.getAll('habits'), db.getAll('logs'), db.getAll('categories'), db.getAll('goals'),
      db.getAll('routines'), db.getAll('routineLogs'), db.getAll('focusSessions'), db.getAll('journal'),
      db.getAll('reminders'), db.getAll('achievements'), db.getAll('challenges'), loadPrefs(),
    ])
  return { habits, logs, categories, goals, routines, routineLogs, focusSessions, journal, reminders, achievements, challenges, prefs }
}

export async function putItem<S extends StoreName>(store: S, value: MomentumDB[S]['value']) {
  const db = await getDB()
  await db.put(store, value)
}

export async function putMany<S extends StoreName>(store: S, values: MomentumDB[S]['value'][]) {
  const db = await getDB()
  const tx = db.transaction(store, 'readwrite')
  await Promise.all([...values.map((v) => tx.store.put(v)), tx.done])
}

export async function deleteItem(store: StoreName, id: string) {
  const db = await getDB()
  await db.delete(store, id)
}

/** Suppression d'une habitude et de tout ce qui en dépend, en une seule transaction. */
export async function deleteHabitCascade(habitId: string) {
  const db = await getDB()
  const tx = db.transaction(['habits', 'logs', 'reminders', 'routines', 'goals', 'challenges', 'focusSessions'], 'readwrite')
  await tx.objectStore('habits').delete(habitId)
  const logKeys = await tx.objectStore('logs').index('byHabit').getAllKeys(habitId)
  await Promise.all(logKeys.map((k) => tx.objectStore('logs').delete(k)))
  for (const r of await tx.objectStore('reminders').getAll()) if (r.habitId === habitId) await tx.objectStore('reminders').delete(r.id)
  for (const r of await tx.objectStore('routines').getAll()) {
    if (r.steps.some((s) => s.habitId === habitId))
      await tx.objectStore('routines').put({ ...r, steps: r.steps.filter((s) => s.habitId !== habitId) })
  }
  for (const g of await tx.objectStore('goals').getAll()) {
    if (g.habitIds.includes(habitId)) await tx.objectStore('goals').put({ ...g, habitIds: g.habitIds.filter((i) => i !== habitId) })
  }
  for (const c of await tx.objectStore('challenges').getAll()) if (c.habitId === habitId) await tx.objectStore('challenges').put({ ...c, habitId: null })
  for (const f of await tx.objectStore('focusSessions').getAll()) if (f.habitId === habitId) await tx.objectStore('focusSessions').put({ ...f, habitId: undefined })
  await tx.done
}

/** Remplace tout le contenu en une transaction (les données ont été validées avant). */
export async function replaceAll(data: AllData) {
  const db = await getDB()
  const names: ('meta' | StoreName)[] = [...STORES, 'meta']
  const tx = db.transaction(names, 'readwrite')
  for (const s of STORES) await (tx.objectStore(s) as any).clear()
  const put = (s: StoreName, items: { id: string }[]) => Promise.all(items.map((i) => (tx.objectStore(s) as any).put(i)))
  await Promise.all([
    put('habits', data.habits), put('logs', data.logs), put('categories', data.categories),
    put('goals', data.goals), put('routines', data.routines), put('routineLogs', data.routineLogs),
    put('focusSessions', data.focusSessions), put('journal', data.journal), put('reminders', data.reminders),
    put('achievements', data.achievements), put('challenges', data.challenges),
    tx.objectStore('meta').put(data.prefs, 'prefs'),
  ])
  await tx.done
}

export function makeBackup(data: AllData): BackupFile {
  return { app: 'momentum', schemaVersion: SCHEMA_VERSION, exportedAt: Date.now(), data }
}
