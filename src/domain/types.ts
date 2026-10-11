/** Date logique locale au format YYYY-MM-DD (jamais convertie via UTC). */
export type DateStr = string
/** Horodatage technique (ms epoch). */
export type Timestamp = number

export const SCHEMA_VERSION = 1

export type TrackingType = 'binary' | 'quantity' | 'duration'

export type HabitSchedule =
  | { kind: 'daily' }
  /** weekdays: 0 = dimanche … 6 = samedi */
  | { kind: 'weekdays'; weekdays: number[] }
  /** quota de jours par semaine, sans jour imposé */
  | { kind: 'weekly_quota'; timesPerWeek: number }
  | { kind: 'dates'; dates: DateStr[] }

export interface Habit {
  id: string
  name: string
  description?: string
  icon: string
  color: string
  categoryId: string | null
  createdAt: Timestamp
  startDate: DateStr
  endDate: DateStr | null
  schedule: HabitSchedule
  tracking: TrackingType
  /** objectif numérique (quantity / duration, en minutes pour duration) */
  target?: number
  unit?: string
  archived: boolean
  /** périodes pendant lesquelles l'habitude est suspendue (archivage) ; to = null → en cours */
  pauses: { from: DateStr; to: DateStr | null }[]
  order: number
}

/** Une entrée par (habitude, date). id = `${habitId}_${date}` : pas de doublon possible. */
export interface HabitLog {
  id: string
  habitId: string
  date: DateStr
  /** binaire : 1 ; quantitatif / durée : valeur saisie */
  value: number
  note?: string
  updatedAt: Timestamp
}

export interface Category {
  id: string
  name: string
  color: string
  icon: string
  order: number
}

export type GoalStatus = 'active' | 'done' | 'paused'
export type GoalProgressRule =
  /** progression = valeur courante saisie / cible */
  | { kind: 'manual'; current: number; target: number; unit?: string }
  /** progression = nb de validations des habitudes liées depuis la création / cible */
  | { kind: 'completions'; target: number }
  /** progression = taux de réussite des habitudes liées depuis la création */
  | { kind: 'rate' }

export interface Goal {
  id: string
  title: string
  description?: string
  deadline: DateStr | null
  priority: 'low' | 'medium' | 'high'
  status: GoalStatus
  habitIds: string[]
  rule: GoalProgressRule
  createdAt: Timestamp
  createdDate: DateStr
}

export type RoutinePeriod = 'morning' | 'afternoon' | 'evening'

export interface RoutineStep {
  id: string
  title: string
  minutes: number
  /** si défini, l'étape référence une habitude existante (validée via l'habitude) */
  habitId?: string
}

export interface Routine {
  id: string
  name: string
  period: RoutinePeriod
  steps: RoutineStep[]
  createdAt: Timestamp
}

/** Étapes cochées (indépendantes) d'une routine pour un jour ; id = `${routineId}_${date}`. */
export interface RoutineLog {
  id: string
  routineId: string
  date: DateStr
  doneStepIds: string[]
  completedAt?: Timestamp
}

export interface FocusSession {
  id: string
  date: DateStr
  startedAt: Timestamp
  /** secondes réellement effectuées */
  seconds: number
  plannedSeconds: number
  completed: boolean
  habitId?: string
  label?: string
}

export interface DailyJournal {
  /** id = date */
  id: DateStr
  date: DateStr
  mood?: 1 | 2 | 3 | 4 | 5
  energy?: 1 | 2 | 3 | 4 | 5
  win?: string
  difficulty?: string
  note?: string
  tomorrow?: string
  updatedAt: Timestamp
}

export interface Reminder {
  id: string
  habitId: string
  time: string // HH:MM
  /** 0..6 ; vide = tous les jours */
  days: number[]
  enabled: boolean
  /** rappeler même si l'habitude est déjà terminée */
  remindIfDone: boolean
}

export interface Achievement {
  id: string // = identifiant du badge
  unlockedAt: Timestamp
  date: DateStr
}

export interface Challenge {
  id: string
  title: string
  habitId: string | null
  /** nombre de validations visé sur la période */
  target: number
  startDate: DateStr
  endDate: DateStr
  createdAt: Timestamp
}

export type ThemeMode = 'dark' | 'light'
export type Lang = 'fr' | 'en'
export type DateFormat = 'dmy' | 'mdy' | 'iso'

export interface UserPreferences {
  displayName: string
  theme: ThemeMode
  accent: string
  lang: Lang
  dateFormat: DateFormat
  /** 0 = dimanche, 1 = lundi … */
  weekStart: 0 | 1 | 6
  gamification: boolean
  notifications: boolean
  startPage: 'today' | 'habits' | 'calendar' | 'stats'
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  onboardingDone: boolean
  samplesOffered: boolean
}

export const DEFAULT_PREFS: UserPreferences = {
  displayName: '',
  theme: 'dark',
  accent: '#D8B56D',
  lang: 'fr',
  dateFormat: 'dmy',
  weekStart: 1,
  gamification: true,
  notifications: false,
  startPage: 'today',
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  onboardingDone: false,
  samplesOffered: false,
}

export interface BackupFile {
  app: 'momentum'
  schemaVersion: number
  exportedAt: Timestamp
  data: {
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
  }
}
