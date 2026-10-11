# Momentum — suivi d'habitudes premium, privé et hors-ligne

> *Deviens constant. Construis ta meilleure version.*

PWA responsive (React 19 + TypeScript + Vite + Tailwind CSS 4). Toutes les données restent sur l'appareil (IndexedDB) : aucun compte, aucune synchronisation cloud, fonctionne sans Internet une fois chargée.

## Installation et démarrage

Prérequis : Node.js ≥ 20 (testé avec Node 24, npm 11).

```bash
npm install
npm run dev        # serveur de développement → http://localhost:5173
npm test           # tests unitaires + intégration (Vitest)
npm run typecheck  # vérification TypeScript
npm run build      # build de production + service worker dans dist/
npm run preview    # servir le build localement
```

> Si Vitest expire au démarrage de ses workers (cas observé sous Windows), le projet est déjà configuré avec `pool: 'threads'`.

## Déploiement

`dist/` est un site statique (routage par hash `#/…`, donc aucune règle de réécriture serveur) : à déposer tel quel sur Netlify, Cloudflare Pages, GitHub Pages, ou un simple hébergement statique **en HTTPS** (requis pour le service worker et l'installation). `base: './'` permet un sous-dossier.
Installation : menu du navigateur → « Installer l'application » / « Ajouter à l'écran d'accueil ».

## Architecture

```
src/
  domain/      Logique métier pure (aucun React, aucune I/O) → entièrement testée
    types.ts       modèles + version de schéma
    dates.ts       dates logiques YYYY-MM-DD, arithmétique sans UTC/DST
    habits.ts      règles d'atteinte, planning, pauses
    stats.ts       jour / habitude / période, séries, quotas, score
    insights.ts    observations descriptives (seuil min. de données)
    goals.ts       progression des objectifs et défis (règles explicites)
    gamification.ts points, niveaux, badges, records (dérivés des données)
    backup.ts      validation de sauvegarde + export CSV
  db/          IndexedDB (idb) : stores, migrations, transactions
  store/       État zustand + actions (optimiste puis persistance, rollback si échec)
  ui/          Composants réutilisables (kit, HabitRow, HabitForm, Heatmap, rappels)
  pages/       Aujourd'hui, Habitudes, Détail, Calendrier, Statistiques, Profil,
               Objectifs, Routines, Journal, Focus, Recherche
  i18n/        FR (langue source = clé) + EN
```

## Modèle de données (schéma v1)

| Store | Contenu clé |
|---|---|
| `habits` | `id, name, description?, icon, color, categoryId, createdAt, startDate, endDate?, schedule, tracking, target?, unit?, archived, pauses[], order` |
| `logs` (HabitLog) | `id = habitId_date` (pas de doublon possible), `habitId, date, value, note?, updatedAt` |
| `categories` | `id, name, color, icon, order` |
| `goals` | `title, deadline?, priority, status, habitIds[], rule{manual\|completions\|rate}` |
| `routines` / `routineLogs` | étapes ordonnées (libres ou liées à une habitude) ; étapes libres cochées par jour |
| `focusSessions` | `date, seconds, plannedSeconds, completed, habitId?, label?` |
| `journal` | `id = date`, humeur/énergie/réussite/difficulté/note/intention |
| `reminders` | `habitId, time, days[], enabled, remindIfDone` |
| `challenges` | objectif de validations sur une période |
| `achievements` | **réservé** (les badges sont dérivés des données, non persistés) |
| `meta.prefs` | `UserPreferences` |

`HabitSchedule` : `daily` · `weekdays{0..6}` · `weekly_quota{timesPerWeek}` · `dates[]`. Types de suivi : binaire, quantité, durée (minutes). Le « quota hebdomadaire » est une **fréquence** applicable à tout type de suivi.
Les statistiques (séries, taux, scores) ne sont **jamais stockées** : elles sont recalculées depuis les logs. Les dates sont des chaînes locales `YYYY-MM-DD` distinctes des horodatages techniques (`createdAt`, `updatedAt`).

## Règles de calcul (testées)

- **Atteinte** : binaire → valeur ≥ 1 ; quantité/durée → valeur ≥ objectif.
- **Score** = occurrences terminées / occurrences prévues × 100, agrégé sur les occurrences réelles (jamais une moyenne de moyennes), plafonné à 100, `null` (affiché « — ») s'il n'y a rien de prévu. Jours futurs ignorés. Jours non programmés ≠ échec.
- **Séries (jours imposés)** : seules les occurrences programmées comptent ; un jour programmé et manqué casse la série ; *aujourd'hui non encore fait n'interrompt pas la série*.
- **Quotas hebdomadaires** : série en **semaines** (quota atteint). Semaine en cours non atteinte = « en cours » (ni échec, ni comptée). Quota plafonné au nombre de jours actifs de la semaine. Dans le score d'un jour, un quota ne compte que s'il est réalisé ce jour-là.
- **Archivage** : crée une pause (`pauses`), l'historique est conservé ; la restauration referme la pause (les jours archivés ne comptent pas comme manqués).
- **Premier jour de semaine** configurable (impacte quotas, calendrier, graphiques hebdomadaires).
- **Objectifs** : règle choisie par l'utilisateur (manuelle, validations, taux) ; une habitude faite ne vaut jamais « objectif atteint » automatiquement.
- **Gamification** : 10 points par occurrence réellement terminée ; badges dérivés des données ; désactivable.

## Fonctionnalités terminées

Aujourd'hui (anneau, navigation de date, quotas, filtres) · CRUD habitudes (4 fréquences, 3 types de suivi, archivage/restauration/suppression avec confirmation, réordonnancement) · catégories par défaut modifiables (suppression sans perte d'habitudes) · calendrier mensuel + détail jour + correction rétroactive · détail d'habitude (séries, taux, calendrier thermique) · statistiques (6 périodes dont personnalisée, graphiques jour/semaine/mois, par catégorie, par habitude, observations) · objectifs + défis · routines (étapes libres ou liées, sans double comptage) · journal · minuteur de concentration (robuste aux interruptions, session partielle sur choix) · rappels · recherche · export JSON/CSV, restauration validée (doublons, schéma, références orphelines), effacement à double confirmation · thèmes clair/sombre, accent, FR/EN, format de date · PWA hors-ligne.

## Limites connues

- **Notifications** : une PWA sans serveur push ne peut pas notifier application fermée. Les rappels se déclenchent tant que l'application est ouverte (fenêtre de 15 min après l'heure, une fois par jour/rappel) ; sinon repli sur un message dans l'application.
- Les données ne sont pas récupérables en cas de perte/réinitialisation de l'appareil → utiliser l'export JSON régulièrement. Aucune synchro multi-appareils.
- Le fuseau horaire est celui de l'appareil au moment de la saisie ; voyager ne réécrit pas l'historique.
- Le réordonnancement se fait par boutons haut/bas (pas de glisser-déposer).
- Traduction anglaise : les noms d'habitudes/catégories par défaut créés en français restent tels quels (données utilisateur).
- Non testé : compilation native iOS/Android (non applicable : PWA) ; test sur appareils réels ; tests E2E multi-navigateurs.
