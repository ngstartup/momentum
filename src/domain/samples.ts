import type { HabitInput } from '../store/app'

/** Bibliothèque d'exemples : proposés, jamais imposés ni insérés sans action de l'utilisateur. */
export interface SampleHabit { key: string; label: string; input: Omit<HabitInput, 'startDate'> }

export const SAMPLE_HABITS: SampleHabit[] = [
  { key: 'it', label: 'Apprentissage informatique', input: { name: 'Apprendre l’informatique', icon: 'code', color: '#7FA6D8', categoryId: 'cat_study', endDate: null, schedule: { kind: 'daily' }, tracking: 'duration', target: 45, unit: 'min' } },
  { key: 'read', label: 'Lecture', input: { name: 'Lecture', icon: 'book-open', color: '#C79BD8', categoryId: 'cat_reading', endDate: null, schedule: { kind: 'daily' }, tracking: 'quantity', target: 10, unit: 'pages' } },
  { key: 'sport', label: 'Sport (3 fois / semaine)', input: { name: 'Sport', icon: 'dumbbell', color: '#8FAF9A', categoryId: 'cat_health', endDate: null, schedule: { kind: 'weekly_quota', timesPerWeek: 3 }, tracking: 'binary' } },
  { key: 'trading', label: 'Analyse et préparation du trading', input: { name: 'Analyse du marché', icon: 'trending-up', color: '#D8B56D', categoryId: 'cat_finance', endDate: null, schedule: { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }, tracking: 'binary' } },
  { key: 'spirit', label: 'Lecture spirituelle', input: { name: 'Lecture spirituelle', icon: 'moon', color: '#9FD8CF', categoryId: 'cat_spirit', endDate: null, schedule: { kind: 'daily' }, tracking: 'binary' } },
]
