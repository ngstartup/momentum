import { Plus } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { SAMPLE_HABITS } from '../domain/samples'
import { todayStr } from '../domain/dates'
import { Button, toast } from './kit'

/** Exemples facultatifs, ajoutés uniquement sur action explicite ; modifiables et supprimables ensuite. */
export function SampleLibrary() {
  const { t } = useT()
  const { categories, addHabit } = useApp()
  async function add(key: string) {
    const s = SAMPLE_HABITS.find((x) => x.key === key)!
    const cat = categories.some((c) => c.id === s.input.categoryId) ? s.input.categoryId : null
    await addHabit({ ...s.input, categoryId: cat, startDate: todayStr() })
    toast(t('Habitude ajoutée.'))
  }
  return (
    <details className="card mt-5 p-4">
      <summary className="cursor-pointer text-sm font-medium">{t('Exemples à personnaliser')}</summary>
      <p className="my-2 text-xs text-muted">{t('Ce ne sont pas des données : rien n’est ajouté sans votre action.')}</p>
      <div className="flex flex-wrap gap-2">
        {SAMPLE_HABITS.map((s) => <Button key={s.key} small onClick={() => add(s.key)}><Plus size={14} />{t(s.label)}</Button>)}
      </div>
    </details>
  )
}
