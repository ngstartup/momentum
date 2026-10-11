import { create } from 'zustand'
import type {
  Achievement, BackupFile, Category, Challenge, DailyJournal, FocusSession, Goal, Habit, HabitLog,
  Reminder, Routine, RoutineLog, UserPreferences,
} from '../domain/types'
import { DEFAULT_PREFS } from '../domain/types'
import {
  type AllData, deleteHabitCascade, deleteItem, loadAll, makeBackup, putItem, putMany, replaceAll, savePrefs,
} from '../db/db'
import { isDone, logId, validateSchedule } from '../domain/habits'
import { todayStr } from '../domain/dates'
import { parseBackup } from '../domain/backup'

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`)

export const DEFAULT_CATEGORIES: Omit<Category, 'order'>[] = [
  { id: 'cat_study', name: 'Études et apprentissage', color: '#7FA6D8', icon: 'graduation-cap' },
  { id: 'cat_work', name: 'Travail et projets', color: '#D8B56D', icon: 'briefcase' },
  { id: 'cat_health', name: 'Santé et sport', color: '#8FAF9A', icon: 'dumbbell' },
  { id: 'cat_reading', name: 'Lecture', color: '#C79BD8', icon: 'book-open' },
  { id: 'cat_spirit', name: 'Spiritualité', color: '#9FD8CF', icon: 'moon' },
  { id: 'cat_finance', name: 'Finances', color: '#D8C27F', icon: 'wallet' },
  { id: 'cat_growth', name: 'Développement personnel', color: '#E39B7B', icon: 'sprout' },
  { id: 'cat_relations', name: 'Relations', color: '#D88FA6', icon: 'users' },
  { id: 'cat_other', name: 'Autres', color: '#9CA3AF', icon: 'shapes' },
]

export type HabitInput = Omit<Habit, 'id' | 'createdAt' | 'archived' | 'pauses' | 'order'>

export interface AppState {
  ready: boolean
  error: string | null
  habits: Habit[]
  logs: HabitLog[]
  categories: Category[]
  goals: Goal[]
  routines: Routine[]
  routineLogs: RoutineLog[]
  focusSessions: FocusSession[]
  journal: DailyJournal[]
  reminders: Reminder[]
  achievements: Achievement[]
  challenges: Challenge[]
  prefs: UserPreferences

  init: () => Promise<void>
  clearError: () => void
  addHabit: (input: HabitInput) => Promise<Habit>
  updateHabit: (id: string, patch: Partial<HabitInput>) => Promise<void>
  archiveHabit: (id: string) => Promise<void>
  restoreHabit: (id: string) => Promise<void>
  deleteHabit: (id: string) => Promise<void>
  reorderHabits: (orderedIds: string[]) => Promise<void>
  setLogValue: (habitId: string, date: string, value: number, note?: string) => Promise<void>
  toggleHabit: (habitId: string, date: string) => Promise<void>
  saveCategory: (c: Omit<Category, 'order'> & { order?: number }) => Promise<void>
  deleteCategory: (id: string, reassignTo: string | null) => Promise<void>
  reorderCategories: (orderedIds: string[]) => Promise<void>
  saveItem: <K extends 'goals' | 'routines' | 'focusSessions' | 'journal' | 'reminders' | 'challenges' | 'routineLogs' | 'achievements'>(
    store: K, item: AppState[K][number]) => Promise<void>
  removeItem: (store: 'goals' | 'routines' | 'focusSessions' | 'journal' | 'reminders' | 'challenges' | 'routineLogs', id: string) => Promise<void>
  setPrefs: (patch: Partial<UserPreferences>) => Promise<void>
  exportBackup: () => BackupFile
  restoreBackup: (text: string) => Promise<{ ok: boolean; errors: string[]; warnings: string[] }>
  eraseAll: () => Promise<void>
}

const pick = (s: AppState): AllData => ({
  habits: s.habits, logs: s.logs, categories: s.categories, goals: s.goals, routines: s.routines,
  routineLogs: s.routineLogs, focusSessions: s.focusSessions, journal: s.journal, reminders: s.reminders,
  achievements: s.achievements, challenges: s.challenges, prefs: s.prefs,
})

const emptyData = (): AllData => ({
  habits: [], logs: [], categories: [], goals: [], routines: [], routineLogs: [], focusSessions: [],
  journal: [], reminders: [], achievements: [], challenges: [], prefs: { ...DEFAULT_PREFS },
})

export const useApp = create<AppState>((set, get) => {
  /** Applique l'état en mémoire tout de suite (UI réactive, pas de double clic), puis persiste ; revient en arrière en cas d'échec. */
  async function optimistic(next: Partial<AppState>, persist: () => Promise<unknown>) {
    const prev = pick(get())
    set(next)
    try {
      await persist()
    } catch (e) {
      console.error(e)
      set({ ...prev, error: 'save' })
    }
  }

  return {
    ready: false,
    error: null,
    ...emptyData(),

    async init() {
      const data = await loadAll()
      if (data.categories.length === 0 && !data.prefs.onboardingDone && data.habits.length === 0) {
        const cats = DEFAULT_CATEGORIES.map((c, order) => ({ ...c, order }))
        await putMany('categories', cats)
        data.categories = cats
      }
      set({ ...data, ready: true })
    },
    clearError: () => set({ error: null }),

    async addHabit(input) {
      if (!input.name.trim()) throw new Error('name')
      const err = validateSchedule(input.schedule)
      if (err) throw new Error(err)
      const habit: Habit = {
        ...input,
        name: input.name.trim(),
        id: uid(),
        createdAt: Date.now(),
        archived: false,
        pauses: [],
        order: get().habits.reduce((m, h) => Math.max(m, h.order), -1) + 1,
      }
      await optimistic({ habits: [...get().habits, habit] }, () => putItem('habits', habit))
      return habit
    },

    async updateHabit(id, patch) {
      const cur = get().habits.find((h) => h.id === id)
      if (!cur) return
      if (patch.name !== undefined && !patch.name.trim()) throw new Error('name')
      if (patch.schedule) {
        const err = validateSchedule(patch.schedule)
        if (err) throw new Error(err)
      }
      const next = { ...cur, ...patch, name: (patch.name ?? cur.name).trim() }
      await optimistic({ habits: get().habits.map((h) => (h.id === id ? next : h)) }, () => putItem('habits', next))
    },

    async archiveHabit(id) {
      const cur = get().habits.find((h) => h.id === id)
      if (!cur || cur.archived) return
      const next = { ...cur, archived: true, pauses: [...cur.pauses, { from: todayStr(), to: null as string | null }] }
      await optimistic({ habits: get().habits.map((h) => (h.id === id ? next : h)) }, () => putItem('habits', next))
    },

    async restoreHabit(id) {
      const cur = get().habits.find((h) => h.id === id)
      if (!cur || !cur.archived) return
      const t = todayStr()
      const pauses = cur.pauses.map((p) => (p.to === null ? { from: p.from, to: addYesterday(t) } : p))
        .filter((p) => p.to! >= p.from)
      const next = { ...cur, archived: false, pauses }
      await optimistic({ habits: get().habits.map((h) => (h.id === id ? next : h)) }, () => putItem('habits', next))
    },

    async deleteHabit(id) {
      const s = get()
      await optimistic(
        {
          habits: s.habits.filter((h) => h.id !== id),
          logs: s.logs.filter((l) => l.habitId !== id),
          reminders: s.reminders.filter((r) => r.habitId !== id),
          routines: s.routines.map((r) => ({ ...r, steps: r.steps.filter((st) => st.habitId !== id) })),
          goals: s.goals.map((g) => ({ ...g, habitIds: g.habitIds.filter((i) => i !== id) })),
          challenges: s.challenges.map((c) => (c.habitId === id ? { ...c, habitId: null } : c)),
          focusSessions: s.focusSessions.map((f) => (f.habitId === id ? { ...f, habitId: undefined } : f)),
        },
        () => deleteHabitCascade(id),
      )
    },

    async reorderHabits(orderedIds) {
      const pos = new Map(orderedIds.map((id, i) => [id, i]))
      const habits = get().habits.map((h) => (pos.has(h.id) ? { ...h, order: pos.get(h.id)! } : h))
      await optimistic({ habits }, () => putMany('habits', habits.filter((h) => pos.has(h.id))))
    },

    async setLogValue(habitId, date, value, note) {
      const v = Number.isFinite(value) ? Math.max(0, value) : 0
      const id = logId(habitId, date)
      const existing = get().logs.find((l) => l.id === id)
      if (v === 0 && !(note ?? existing?.note)) {
        if (!existing) return
        await optimistic({ logs: get().logs.filter((l) => l.id !== id) }, () => deleteItem('logs', id))
        return
      }
      const log: HabitLog = { id, habitId, date, value: v, note: note ?? existing?.note, updatedAt: Date.now() }
      const logs = existing ? get().logs.map((l) => (l.id === id ? log : l)) : [...get().logs, log]
      await optimistic({ logs }, () => putItem('logs', log))
    },

    async toggleHabit(habitId, date) {
      const h = get().habits.find((x) => x.id === habitId)
      if (!h) return
      const cur = get().logs.find((l) => l.id === logId(habitId, date))?.value ?? 0
      if (isDone(h, cur)) await get().setLogValue(habitId, date, 0)
      else await get().setLogValue(habitId, date, h.tracking === 'binary' ? 1 : (h.target && h.target > 0 ? h.target : 1))
    },

    async saveCategory(c) {
      const exists = get().categories.some((x) => x.id === c.id)
      const cat: Category = { ...c, name: c.name.trim(), order: c.order ?? get().categories.length }
      if (!cat.name) throw new Error('name')
      const categories = exists ? get().categories.map((x) => (x.id === c.id ? cat : x)) : [...get().categories, cat]
      await optimistic({ categories }, () => putItem('categories', cat))
    },

    async deleteCategory(id, reassignTo) {
      const s = get()
      const affected = s.habits.filter((h) => h.categoryId === id).map((h) => ({ ...h, categoryId: reassignTo }))
      const habits = s.habits.map((h) => affected.find((a) => a.id === h.id) ?? h)
      await optimistic({ categories: s.categories.filter((c) => c.id !== id), habits }, async () => {
        await putMany('habits', affected)
        await deleteItem('categories', id)
      })
    },

    async reorderCategories(orderedIds) {
      const pos = new Map(orderedIds.map((id, i) => [id, i]))
      const categories = get().categories.map((c) => ({ ...c, order: pos.get(c.id) ?? c.order }))
      await optimistic({ categories }, () => putMany('categories', categories))
    },

    async saveItem(store, item) {
      const list = get()[store] as { id: string }[]
      const it = item as { id: string }
      const next = list.some((x) => x.id === it.id) ? list.map((x) => (x.id === it.id ? it : x)) : [...list, it]
      await optimistic({ [store]: next } as Partial<AppState>, () => putItem(store, item as never))
    },

    async removeItem(store, id) {
      const list = get()[store] as { id: string }[]
      await optimistic({ [store]: list.filter((x) => x.id !== id) } as Partial<AppState>, () => deleteItem(store, id))
    },

    async setPrefs(patch) {
      const prefs = { ...get().prefs, ...patch }
      await optimistic({ prefs }, () => savePrefs(prefs))
    },

    exportBackup: () => makeBackup(pick(get())),

    async restoreBackup(text) {
      const res = parseBackup(text) // validation complète AVANT toute écriture
      if (!res.ok || !res.backup) return { ok: false, errors: res.errors, warnings: res.warnings }
      try {
        await replaceAll(res.backup.data)
      } catch (e) {
        console.error(e)
        return { ok: false, errors: ['Écriture impossible : vos données actuelles n’ont pas été modifiées.'], warnings: res.warnings }
      }
      set({ ...res.backup.data })
      return { ok: true, errors: [], warnings: res.warnings }
    },

    async eraseAll() {
      const d = emptyData()
      d.prefs = { ...DEFAULT_PREFS, onboardingDone: true }
      await replaceAll(d)
      set({ ...d })
    },
  }
})

function addYesterday(t: string): string {
  const d = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) - 86400000)
  return d.toISOString().slice(0, 10)
}
