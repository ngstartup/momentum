import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { useApp } from './store/app'
import { resetDBConnection } from './db/db'

async function boot() {
  await resetDBConnection()
  indexedDB.deleteDatabase('momentum')
  window.location.hash = ''
  useApp.setState({ ready: false, habits: [], logs: [] })
  return render(<App />)
}

describe('application (intégration UI)', () => {
  beforeEach(async () => { document.body.innerHTML = '' })

  it('création, validation, navigation, statistiques et persistance après réouverture', async () => {
    const user = userEvent.setup()
    const view = await boot()

    // état vide explicite
    expect(await screen.findByText('Bienvenue sur Momentum')).toBeInTheDocument()

    // création d'une habitude via le formulaire (avec validation d'un nom vide)
    await user.click(screen.getByRole('button', { name: /Créer une habitude/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    expect(await within(dialog).findByText('Le nom est obligatoire.')).toBeInTheDocument()
    await user.type(within(dialog).getByPlaceholderText('Ex. Lire 10 pages'), 'Méditer')
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // validation en un clic + anneau de progression
    const validate = await screen.findByRole('button', { name: 'Valider Méditer' })
    await user.click(validate)
    expect(await screen.findByRole('button', { name: 'Annuler la validation de Méditer' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1 sur 1 terminées')).toBeInTheDocument()

    // statistiques mises à jour
    await user.click(screen.getAllByRole('link', { name: /Statistiques/ })[0])
    expect(await screen.findByText('Taux de réussite', {}, { timeout: 15000 })).toBeInTheDocument()
    expect(await screen.findByText('100,0 %')).toBeInTheDocument()

    // navigation : calendrier et habitudes
    await user.click(screen.getAllByRole('link', { name: /Calendrier/ })[0])
    expect(await screen.findByRole('grid', {}, { timeout: 10000 })).toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: /Habitudes/ })[0])
    expect(await screen.findByText('Méditer', {}, { timeout: 10000 })).toBeInTheDocument()

    // fermeture / réouverture : tout est relu depuis IndexedDB
    view.unmount()
    await resetDBConnection()
    useApp.setState({ ready: false, habits: [], logs: [] })
    window.location.hash = '#/today'
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Annuler la validation de Méditer' })).toBeInTheDocument()
  }, 30000)
})
