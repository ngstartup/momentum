import { beforeEach, describe, expect, it } from 'vitest'
import { useApp, type HabitInput } from './app'
import { resetDBConnection } from '../db/db'
import { todayStr } from '../domain/dates'
import { habitStats } from '../domain/stats'
import { buildLogIndex } from '../domain/habits'
import { logsToCsv, parseBackup } from '../domain/backup'

const input = (over: Partial<HabitInput> = {}): HabitInput => ({
  name: 'Lecture', icon: 'book-open', color: '#D8B56D', categoryId: 'cat_reading',
  startDate: '2026-01-01', endDate: null, schedule: { kind: 'daily' }, tracking: 'binary', ...over,
})

async function freshDb() {
  await resetDBConnection()
  indexedDB.deleteDatabase('momentum')
  useApp.setState({ ready: false })
  await useApp.getState().init()
}

describe('store + IndexedDB', () => {
  beforeEach(freshDb)

  it('crée les catégories par défaut au premier lancement', () => {
    expect(useApp.getState().categories).toHaveLength(9)
  })

  it('crée, valide sans doublon (double clic), puis persiste après redémarrage', async () => {
    const h = await useApp.getState().addHabit(input())
    const t = todayStr()
    // double déclenchement concurrent : un seul état final cohérent
    await Promise.all([useApp.getState().setLogValue(h.id, t, 1), useApp.getState().setLogValue(h.id, t, 1)])
    expect(useApp.getState().logs).toHaveLength(1)

    await resetDBConnection() // simule fermeture / réouverture
    useApp.setState({ habits: [], logs: [], ready: false })
    await useApp.getState().init()
    expect(useApp.getState().habits).toHaveLength(1)
    expect(useApp.getState().logs).toHaveLength(1)
  })

  it('toggle puis annulation retire la validation', async () => {
    const h = await useApp.getState().addHabit(input())
    const t = todayStr()
    await useApp.getState().toggleHabit(h.id, t)
    expect(useApp.getState().logs[0].value).toBe(1)
    await useApp.getState().toggleHabit(h.id, t)
    expect(useApp.getState().logs).toHaveLength(0)
  })

  it('refuse un nom vide et un planning invalide', async () => {
    await expect(useApp.getState().addHabit(input({ name: '  ' }))).rejects.toThrow()
    await expect(useApp.getState().addHabit(input({ schedule: { kind: 'weekdays', weekdays: [] } }))).rejects.toThrow()
  })

  it('modification, archivage, restauration : historique conservé', async () => {
    const h = await useApp.getState().addHabit(input({ tracking: 'quantity', target: 10, unit: 'pages' }))
    await useApp.getState().setLogValue(h.id, '2026-02-01', 12)
    await useApp.getState().updateHabit(h.id, { name: 'Lire 10 pages' })
    await useApp.getState().archiveHabit(h.id)
    let cur = useApp.getState().habits[0]
    expect(cur.archived).toBe(true)
    expect(cur.name).toBe('Lire 10 pages')
    expect(useApp.getState().logs).toHaveLength(1)
    await useApp.getState().restoreHabit(h.id)
    cur = useApp.getState().habits[0]
    expect(cur.archived).toBe(false)
    expect(cur.pauses).toHaveLength(0)
  })

  it('suppression de catégorie : les habitudes sont conservées et réaffectées', async () => {
    const h = await useApp.getState().addHabit(input())
    await useApp.getState().deleteCategory('cat_reading', null)
    expect(useApp.getState().habits.find((x) => x.id === h.id)?.categoryId).toBeNull()
    expect(useApp.getState().categories.some((c) => c.id === 'cat_reading')).toBe(false)
  })

  it('suppression d’une habitude supprime ses logs et références', async () => {
    const h = await useApp.getState().addHabit(input())
    await useApp.getState().setLogValue(h.id, '2026-02-01', 1)
    await useApp.getState().deleteHabit(h.id)
    expect(useApp.getState().logs).toHaveLength(0)
    await resetDBConnection()
    useApp.setState({ ready: false })
    await useApp.getState().init()
    expect(useApp.getState().logs).toHaveLength(0)
  })

  it('statistiques mises à jour après validation', async () => {
    const h = await useApp.getState().addHabit(input({ startDate: '2026-10-01' }))
    for (const d of ['2026-10-12', '2026-10-13']) await useApp.getState().setLogValue(h.id, d, 1)
    const s = habitStats(useApp.getState().habits[0], buildLogIndex(useApp.getState().logs), '2026-10-14', 1)
    expect(s.currentStreak).toBe(2)
  })

  it('exportation puis restauration', async () => {
    const h = await useApp.getState().addHabit(input())
    await useApp.getState().setLogValue(h.id, '2026-02-01', 1)
    const text = JSON.stringify(useApp.getState().exportBackup())
    await useApp.getState().eraseAll()
    expect(useApp.getState().habits).toHaveLength(0)
    const r = await useApp.getState().restoreBackup(text)
    expect(r.ok).toBe(true)
    expect(useApp.getState().habits).toHaveLength(1)
    expect(useApp.getState().logs).toHaveLength(1)
    expect(logsToCsv(useApp.getState())).toContain('2026-02-01')
  })

  it('une sauvegarde invalide ne modifie rien', async () => {
    await useApp.getState().addHabit(input())
    const bad = await useApp.getState().restoreBackup('{"app":"momentum","schemaVersion":1,"data":{"habits":[{"id":"a"},{"id":"a"}]}}')
    expect(bad.ok).toBe(false)
    expect((await useApp.getState().restoreBackup('pas du json')).ok).toBe(false)
    expect(useApp.getState().habits).toHaveLength(1)
  })

  it('détecte les identifiants en double', () => {
    const r = parseBackup(JSON.stringify({
      app: 'momentum', schemaVersion: 1,
      data: { habits: [
        { id: 'a', name: 'x', startDate: '2026-01-01', schedule: { kind: 'daily' }, tracking: 'binary' },
        { id: 'a', name: 'y', startDate: '2026-01-01', schedule: { kind: 'daily' }, tracking: 'binary' },
      ] },
    }))
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('double')
  })
})
