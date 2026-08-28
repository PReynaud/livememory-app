# Handoff — Concerts + profil public (`/concerts`, `/u/:username`)

**Statut :** design validé pour implémentation  
**Date :** 2026-08-28  
**Source visuelle :** `public-profile-prototype.html` (OpenDesign)  
**Repo cible :** `livememory-app`  
**Périmètre :** UI / copy / états / filtres client — **ne pas** réécrire API, RLS, store Pinia core, ni `sortEventsForConcerts`

**Prérequis :** handoffs Accueil (`handoff-home-add.md`) et layout 768px (`handoff-index.md`) — réutiliser `AppEventCard`, chips quiet Going, wells si polish cartes appliqué.

---

## Prompt Cursor (à coller)

```text
Implémente le redesign Concerts + profil public à partir de @handoff-concerts-list.md
et du prototype @public-profile-prototype.html (copie locale si besoin).

Contraintes :
- Ne change pas la logique métier / API / store core — UI, filtres client, copy et états validés.
- Respecte LiveMemory : palette stricte, Going = 4 rôles, dark-only, Public Sans.
- Largeur max-w-3xl (768px) — voir handoff-index.md.
- Une PR = concerts.vue + u/[username].vue + composants liste/filtre extraits.

Cibles :
- app/pages/concerts.vue
- app/pages/u/[username].vue
- app/components/AppEventCard.vue (si écart wells/chips vs Accueil)
- app/components/AppFilterConcertSheet.vue (nouveau — suggéré)
- app/components/AppEventListControls.vue (nouveau — suggéré)
- app/composables/useEventListTabs.ts (nouveau — suggéré)
- app/composables/useConcertListFilters.ts (nouveau — suggéré)

Lis la handoff en entier avant de coder. Checklist de fin de PR dans le fichier.
```

---

## Objectif produit

Unifier l’expérience **liste de concerts** entre :

| Route | Visiteur | Connecté (owner) |
|---|---|---|
| `/concerts` | — (auth) | Journal complet + chips + Add |
| `/u/:username` | Liste partagée readonly | Même rendu liste (header public si non connecté) |

**Problème résolu :** la liste passée va « exploser » — séparer **À venir** / **Souvenirs** via onglets, puis affiner avec une **feuille Filtrer** (glass, comme Add).

---

## Même squelette, deux contextes

| Élément | `/concerts` | `/u/:username` |
|---|---|---|
| Chrome | Nav glass (`AppGlassNav`) | Header public (logo + Se connecter) — **existant** |
| Titre H1 | **Concerts** | **{username}** |
| Cartes | `AppEventCard` interactif | `AppEventCard` **`readonly`** |
| Chips Going | Oui (lignes festival + soirée selon règles card) | Non |
| Onglets + filtres | Oui | Oui (même UI, données `sharedListStore.groups`) |
| Load more | Oui, onglet **Souvenirs** seulement | Non (v1 — liste partagée chargée en entier) |
| Empty à venir | CTA **Ajouter un concert** → `addSheet.openSheet()` | Copy muted seulement |
| Création event | Nav **+** et empty CTA uniquement | — |

Le prototype utilise un switch démo **Concerts / Profil public** — **ne pas shipper** ; ce sont deux routes distinctes en prod.

---

## Fichiers à toucher

| Zone | Fichier | Action |
|---|---|---|
| Page Concerts | `app/pages/concerts.vue` | Refonte liste : onglets, filtres, retirer toolbar création |
| Page publique | `app/pages/u/[username].vue` | Ajouter onglets + filtres (readonly) |
| Cartes | `app/components/AppEventCard.vue` | Aligner wells/chips sur Accueil si pas déjà fait |
| Sheet filtres | `app/components/AppFilterConcertSheet.vue` | **Nouveau** — pattern glass Add |
| Contrôles liste | `app/components/AppEventListControls.vue` | **Nouveau** — tabs + barre filtre + chips actifs |
| Tabs | `app/composables/useEventListTabs.ts` | **Nouveau** — split upcoming/past |
| Filtres | `app/composables/useConcertListFilters.ts` | **Nouveau** — état draft/applied, persistence par tab |
| Store events | `app/stores/events.ts` | **Référence** — `visibleEvents`, `loadMoreEvents`, `sortEventsForConcerts` |
| Store shared | `app/stores/shared-list.ts` | **Référence** — `groups` |
| Domaine | `shared/domain/events.ts` | **Référence** — `sortEventsForConcerts`, fuseau Paris |

**Retirer de `concerts.vue` :**

- Boutons **New night** / **New festival**
- Formulaire inline création event (`createKind`, `submitCreate`, champs name/date/place)
- Création event reste via **Add sheet** (`useAddConcertSheetStore`) + CTA empty

**Hors scope :** refonte `profile.vue` (settings), pagination API filtres, album art.

---

## Layout

- Container : `UContainer` **`max-w-3xl`** (768px) — pas `max-w-lg`
- Padding page : `py-8`, `space-y-4` entre blocs majeurs
- Titre : `text-[34px] font-bold tracking-tight leading-tight`
- Chrome-safe bas si nav glass : ~88px (padding liste)

---

## Architecture suggérée

### `useEventListTabs`

```ts
type ListTab = 'upcoming' | 'past';

// Frontière : event.start_date vs civilDateInTimeZone(now, PARIS) — même règle que sortEventsForConcerts
function splitEvents(events: EventRecord[]): { upcoming: EventRecord[]; past: EventRecord[] }
```

- Onglet actif persisté en `sessionStorage` ou `useState` (optionnel v1)
- Compteurs : `upcoming.length`, `past.length` **avant** filtres (badges onglets)

### `useConcertListFilters`

- État **par onglet** : `filters.upcoming`, `filters.past` (ids string[])
- Champ artiste par onglet : `artistQuery.upcoming`, `artistQuery.past`
- Draft dans la sheet jusqu’à **Appliquer**
- Filtres appliqués = AND entre critères + recherche artiste (insensible casse, match partiel sur noms concerts)

### Composants

```
AppEventListControls
├── list-tabs (À venir | Souvenirs)
├── list-filter-bar
│   ├── btn-filter (+ badge count)
│   ├── filter-active-chips (chips retirables)
│   └── btn-filter-clear (si 2+ filtres)
└── slot default → liste cartes

AppFilterConcertSheet
├── scrim + dialog (pattern AppAddConcertSheet)
├── panneaux glass par section critère
├── option-chips (toggle multi)
├── input Artiste (search)
└── footer Réinitialiser | Appliquer
```

---

## Onglets période (P0)

### Style — fond sombre + bordure rose (accessibilité)

**Ne pas** utiliser fill Going sur l’onglet actif (confusion avec chips / mauvais contraste texte noir).

| État | Style |
|---|---|
| Inactif | `background: #1a1a1a`, `border: 1px #2e2e2e`, texte muted |
| Actif | `border: 2px #ff4d8a`, texte **blanc**, fond `#1a1a1a` |
| Hover inactif | texte fg, bordure légèrement éclaircie |
| Compteur | pill `border 1px accent`, texte accent (inactif) ; idem sur actif |

- `role="tablist"` / `role="tab"` / `aria-selected`
- `aria-controls` → panel liste
- Navigation clavier : flèches gauche/droite entre tabs
- `min-height: 44px`

### Labels copy (FR prototype)

| ID | Label UI |
|---|---|
| `upcoming` | **À venir** |
| `past` | **Souvenirs** |

EN actuel si i18n : mapper clés ; vocabulaire produit « Souvenirs » aligné stats Accueil.

### Comportement données

| Onglet | Source tri | Ordre |
|---|---|---|
| À venir | `start_date >= today` (Paris) | ASC par `start_date` |
| Souvenirs | `start_date < today` | DESC par `start_date` |

Réutiliser `sortEventsForConcerts` puis **filtrer** le bucket actif — ne pas re-trier différemment.

**Concerts store :** aujourd’hui `visibleEvents` = slice fenêtre sur liste **globale** triée upcoming+past mélangés. **Changement requis :**

1. Calculer `upcomingEvents` et `pastEvents` à partir de `events` triés
2. Appliquer filtres sur le bucket de l’onglet actif
3. `visibleEvents` = slice fenêtre **uniquement sur le bucket actif** (surtout Souvenirs + load more)
4. `loadMoreEvents` : incrémenter fenêtre **seulement si `listTab === 'past'`** (ou les deux buckets avec fenêtres séparées)

Documenter dans le store ou composable pour éviter régression pagination.

**Profil public :** `groups` déjà chargés — filtrer côté client par `group.event.start_date` ; pas de load more v1.

---

## Barre filtres (P0 UI, P1 logique étendue)

### Niveau 1 — Tabs (bucket temporel)

Découpe obligatoire avant scroll infini.

### Niveau 2 — Filtres (affinage dans le bucket)

```
[ Filtrer ▾ ]  [chip 2025 ×] [chip Paris ×]  Tout effacer
```

| Élément | Comportement |
|---|---|
| **Filtrer** | Ouvre `AppFilterConcertSheet` |
| **Badge** sur Filtrer | Nombre de critères actifs (options + artiste si non vide) |
| **Chips actifs** | Un chip par critère ; × retire le critère et rafraîchit la liste |
| **Tout effacer** | Visible si ≥ 2 filtres actifs |
| **Hint muted** | Si 0 filtre : « Artiste, lieu, statut Going… » (à venir) / « Année, artiste, lieu… » (souvenirs) |

---

## Feuille Filtrer (P0)

Même langage glass que **Add** (`handoff-home-add.md`) :

| Niveau | Token / classe |
|---|---|
| Coque | `--sheet-glass`, blur ~28px, coins sup xl |
| Panneaux | `.form-panel`, blur ~16px |
| Options | `.option-chip` — surface + bordure 2px accent si sélectionné |
| Input artiste | `.input`, blur ~12px, hauteur 44px |

### Structure

- Eyebrow : nom de l’onglet actif (**À venir** / **Souvenirs**)
- Titre : **Filtrer**
- Corps : sections dynamiques + panneau **Artiste** (toujours)
- Footer : contexte « N critères sélectionnés » + **Réinitialiser** (ghost) + **Appliquer** (outline Going 44px)

### Interactions

| Action | Effet |
|---|---|
| Tap option | Toggle sélection (multi-select AND) |
| Réinitialiser | Vide draft dans la sheet, ne ferme pas |
| Appliquer | Persiste filtres pour l’onglet actif, ferme, filtre liste, toast « N filtres appliqués » |
| Escape / scrim | Ferme sans appliquer (draft perdu ou conservé — choisir : **perdu** comme Add) |
| Enter dans Artiste | Appliquer |
| Focus trap | Tant que sheet ouverte |

### Catalogue critères (v1 — client-side)

**À venir**

| Section | Options (ids) |
|---|---|
| Statut | `going`, `attended` |
| Type | `festival`, `night` |
| Lieu | `place-paris`, `place-lyon`, `place-bristol` (+ dynamique depuis données user en v1.1) |
| Période | `month` (ce mois-ci, calendrier Paris) |

**Souvenirs**

| Section | Options |
|---|---|
| Année | `year-2025`, `year-2024`, … (dériver années présentes dans les events) |
| Statut | `attended`, `going` |
| Type | `festival`, `night` |
| Lieu | idem |

**Artiste** : champ texte, filtre sur `concert.artist` (tous concerts de l’event).

### Règles matching (v1)

```ts
// Pseudo — implémenter dans useConcertListFilters
function matchesStatus(event, concerts, attendance, filterId): boolean
function matchesType(event, filterId): boolean  // festival | single_night
function matchesPlace(event, filterId): boolean   // suffixe ville normalisée
function matchesYear(event, filterId): boolean   // start_date year
function matchesMonth(event, filterId): boolean    // start_date in current month Paris
function matchesArtist(concerts, query): boolean
```

- Statut **going** : au moins un concert de l’event avec attendance `going` (ou `eventGoingStatus` pour soirée)
- Statut **attended** : idem `attended` / passé
- Tous les filtres sélectionnés = **AND**
- Liste vide filtrée : **« Aucun concert ne correspond à vos filtres. »** (pas confondre avec empty tab)

### v2 (documenter, ne pas bloquer v1)

- Lieux / années dynamiques depuis données
- Persistence `localStorage` par user
- Filtres côté API si volume extrême
- Profil public : même sheet, sans chips sur cartes

---

## Liste cartes

- `space-y-2.5` entre cartes (existant)
- `AppEventCard` avec props existantes
- **Concerts** : chips interactifs (règles inchangées — festival par ligne, soirée event-level sur card Accueil pattern si applicable)
- **Public** : `readonly` — pas de chips

### Empty states

| Contexte | Onglet | Copy | CTA |
|---|---|---|---|
| Concerts | À venir | Rien à venir pour le moment. | **Ajouter un concert** → Add sheet |
| Concerts | Souvenirs | Aucun souvenir enregistré. | — |
| Public | À venir | Aucun concert à venir sur cette liste. | — |
| Public | Souvenirs | Aucun souvenir enregistré. | — |
| Filtre sans résultat | any | Aucun concert ne correspond à vos filtres. | Réouvrir Filtrer (optionnel) |

### Load more

- Visible **uniquement** : `/concerts` + onglet **Souvenirs** + `hasMoreEvents` + pas d’erreur
- Label : **Charger plus** (ghost full width)
- Comportement store : étendre fenêtre sur bucket **past** filtré

---

## Retrait toolbar création (P0 — décision explicite)

### Avant (code actuel)

```vue
<UButton label="New night" ... />
<UButton label="New festival" ... />
<!-- + formulaire inline si createKind -->
```

### Après (design validé)

- **Aucun** bouton New night/festival sous le titre
- Création event :
  1. Nav glass **+** → `AppAddConcertSheet`
  2. Empty state **Ajouter un concert** → même sheet
- Le flux « créer event puis redirect `/e/:id` » via formulaire inline est **retiré** de cette page (reste possible via Add sheet + redirect existant si configuré)

### Impact tests

Mettre à jour les e2e qui cliquent **New night** / **New festival** sur `/concerts` :

| Fichier | Migration |
|---|---|
| `tests/e2e/concerts-add.spec.ts` | Utiliser Add nav + sheet |
| `tests/e2e/concerts-edit.spec.ts` | Idem |
| `tests/unit/concerts-domain.spec.ts` | Retirer assertion `New night` sur page si remplacé |

---

## Going — discipline onglets vs chips

| Élément | Accent Going ? |
|---|---|
| Onglet actif (bordure) | Oui — **bordure seulement** (pas fill) |
| Compteur onglet | Bordure + texte accent |
| Chip filtre actif | Bordure pointillée accent (quiet chip pattern) |
| Bouton Appliquer | Outline CTA (1 par sheet) |
| Bouton Filtrer | Utilitaire blanc/glass — **pas** Going |

---

## Accessibilité (P0)

- Tabs : pattern WAI-ARIA tabs complet
- Filter sheet : `role="dialog"`, `aria-modal`, `aria-labelledby`
- Chips filtre : `aria-label` « Retirer le filtre {label} »
- Toast filtres : `role="status"`, `aria-live="polite"`
- `prefers-reduced-motion` : couper transitions sheet/tabs
- Cibles ≥ 44px sur tabs, Filtrer, chips

---

## Copy FR (prototype → app)

| Contexte | FR |
|---|---|
| Titre concerts | Concerts |
| Tab upcoming | À venir |
| Tab past | Souvenirs |
| Filtrer | Filtrer |
| Appliquer | Appliquer |
| Réinitialiser | Réinitialiser |
| Tout effacer | Tout effacer |
| Load more | Charger plus |
| Empty upcoming (owner) | Rien à venir pour le moment. |
| Add CTA | Ajouter un concert |
| Filter empty | Aucun concert ne correspond à vos filtres. |

---

## Deltas vs code actuel

| Actuel | Cible design |
|---|---|
| Liste unique upcoming+past mélangés | Onglets À venir / Souvenirs |
| Pas de filtres | Sheet Filtrer + chips actifs |
| `max-w-lg` | `max-w-3xl` |
| Toolbar New night/festival + form inline | Retiré — Add nav + empty CTA |
| `/u/:username` liste plate | Même onglets + filtres, readonly |
| Load more sur liste globale | Load more sur **Souvenirs** (past) |

---

## Checklist PR

- [ ] `max-w-3xl` sur `concerts.vue` et `u/[username].vue`
- [ ] Onglets surface + bordure rose actif ; compteurs ; clavier
- [ ] Split upcoming/past (Paris) aligné `sortEventsForConcerts`
- [ ] `AppFilterConcertSheet` glass (pattern Add)
- [ ] Filtres client AND + artiste + chips retirables
- [ ] Persistence filtres **par onglet**
- [ ] Load more uniquement Souvenirs + fenêtre store adaptée
- [ ] Retrait New night/festival + form inline concerts
- [ ] Empty states + filter empty distincts
- [ ] Public : readonly, pas load more, pas CTA Add
- [ ] Going discipline (pas fill tab Going)
- [ ] Focus trap sheet ; aria ; reduced-motion
- [ ] Tests e2e/unit migrés (New night → Add sheet)
- [ ] Captures Concerts + /u/:username (les deux onglets, filtre actif)

---

## Référence fichiers OpenDesign

Copier dans le repo, ex. `_bmad-output/design/` :

1. `handoff-concerts-list.md` (ce fichier)  
2. `public-profile-prototype.html` (référence interactive ; ignorer switch démo et barre d’états)

Ensuite dans Cursor : coller le **Prompt Cursor** en haut de ce document.
