# Handoff — LiveMemory redesign (index implémentation)

**Statut :** design validé pour implémentation  
**Date :** 2026-08-28  
**Repo cible :** `livememory-app`  
**Source visuelle :** prototypes HTML OpenDesign (copies dans `_bmad-output/design/`)

---

## Prompt Cursor (vue d’ensemble)

```text
Implémente le redesign LiveMemory v1 à partir de @_bmad-output/design/handoff-index.md
et des handoffs + prototypes listés dans ce fichier.

Ordre recommandé :
1. Layout global 768px + tokens partagés
2. Accueil + sheet Add (handoff-home-add.md)
3. Détail Event festival/soirée (handoff-festival-detail.md)
4. Concerts + profil public + filtres (handoff-concerts-list.md)

Contraintes transverses :
- Palette LiveMemory stricte (#000, #fff, #ff4d8a, #1a1a1a, #a3a3a3, #2e2e2e)
- Going = 4 rôles seulement (selected nav, outline CTA, badge néon, quiet chip pointillé)
- Dark-only, Public Sans, blur+fill (pas d’ombres sauf glow chip Going)
- Ne pas réécrire logique métier / API / store — UI, copy, états, composants partagés
- Réutiliser AppEventCard, AppAttendanceChip, AppAddConcertSheet, AppGlassNav

Lis chaque handoff avant de coder la zone correspondante.
```

---

## Documents & prototypes

| Zone | Handoff | Prototype | PR suggérée |
|---|---|---|---|
| **Layout global** | § ci-dessous | tous les prototypes | PR 0 ou inclus dans PR 1 |
| **Accueil + Add** | `handoff-home-add.md` | `home-add-prototype.html` | PR 1 |
| **Détail Event** | `handoff-festival-detail.md` | `festival-detail-prototype.html` | PR 2 |
| **Concerts + `/u/:username`** | `handoff-concerts-list.md` | `public-profile-prototype.html` | PR 3 |

Copier dans le repo : `_bmad-output/design/` (handoffs + HTML).

---

## Ordre d’implémentation recommandé

### PR 0 — Fondations transverses (peut être fusionné avec PR 1)

1. **Largeur contenu `max-w-3xl` (768px)** sur toutes les pages liste et Event (voir § Layout global).
2. **Composants partagés** issus des handoffs Accueil :
   - `AppAttendanceChip` (quiet / confirmé / attended)
   - Patterns wells bill, section labels ALL CAPS
3. **Util share** : `app/utils/share-event.ts` (handoff festival).

### PR 1 — Accueil + sheet Add

Voir `handoff-home-add.md` — ne pas shipper spotlight carte, barre démo OpenDesign.

### PR 2 — Détail Event (`/e/:id`)

Voir `handoff-festival-detail.md` — dépend des chips/wells PR 1.

### PR 3 — Concerts + profil public

Voir `handoff-concerts-list.md` — dépend des cartes/chips PR 1 ; réutilise sheet Add pour création.

---

## Layout global — largeur 768px (P0 transverse)

**Décision produit :** toutes les pages « liste / log » utilisent la même largeur que le profil public — **`max-w-3xl` (768px)**, pas `max-w-lg` (512px).

Aligné sur `EXPERIENCE.md` / `DESIGN.md` planning (`max-w-3xl` pour lists et Event).

### Fichiers à mettre à jour

| Fichier | Actuel | Cible |
|---|---|---|
| `app/pages/home.vue` | `max-w-lg` | `max-w-3xl` |
| `app/pages/concerts.vue` | `max-w-lg` | `max-w-3xl` |
| `app/pages/e/[id].vue` | `max-w-lg` | `max-w-3xl` |
| `app/pages/u/[username].vue` | `max-w-lg` | `max-w-3xl` |
| `app/components/AppGlassNav.vue` | inset ~512px | inset `calc(768px - 24px)` ou token partagé |
| Sheets (Add, Filter) | largeur nav | même inset que glass nav |

### Tokens layout (référence prototypes)

```css
--max-w: 768px;           /* contenu principal */
--page-x: 16px;           /* 24px à partir de md (768px) */
--chrome-safe: 88px;      /* padding bas listes avec nav glass */
```

Nav glass / sheets : `max-width: calc(var(--max-w) - 24px)` centré.

**Exception :** `app/pages/profile.vue` (settings compte) peut rester `max-w-lg` ou passer en `max-w-3xl` — hors scope redesign liste ; trancher en PR séparée si besoin.

---

## Discipline Going (rappel — toutes les PR)

Going (`#ff4d8a`) **uniquement** dans :

1. Nav item **selected** (fill)
2. **Outline CTA** principal (bordure 2px, fond transparent, 44px)
3. Chip Going **confirmé** (plein + glow `0 0 8px` ~40% Going)
4. Chip **quiet** Going (texte + bordure **pointillée** rose)

**Add (+)** nav : cercle blanc — ni selected, ni CTA Going.

**Onglets liste** (Concerts) : fond surface sombre + **bordure rose** sur l’actif — **pas** de fill Going (meilleur contraste / a11y).

**Actions utilitaires** (share, edit, filtrer) : blanc + glass — pas d’accent Going.

---

## Patterns glass réutilisables

| Niveau | Usage | Blur ref. |
|---|---|---|
| Nav / pill header | `AppGlassNav`, actions Modifier·Partager | ~24–40px |
| Sheet coque | Add, Filter | ~28px |
| Panneau form | `.form-panel` dans sheets | ~16px |
| Input / chip option | champs, filtres | ~12px |

Dérivés via `color-mix` sur tokens existants — pas de nouveaux hex.

---

## Décisions produit à valider côté dev/PM

| Sujet | Décision design | Impact code |
|---|---|---|
| Partager Event | Visible owner **et** membre (pas seulement copy owner) | `e/[id].vue`, `share-event.ts` |
| Soirée attendance | Chip unique event-level ; **pas** « Attend this night » | `e/[id].vue`, tests e2e |
| Concerts création | **Retirer** toolbar New night/festival + formulaire inline | `concerts.vue`, tests e2e |
| Filtres liste | v1 client-side ; catalogue extensible | nouveau composant sheet + composable |
| Load more | Uniquement onglet **Souvenirs** (passés) | `concerts.vue` + store window |
| Copy UI | FR dans prototypes ; mapper i18n selon convention repo | strings touchées |

---

## Tests — impact global

| Zone | Fichiers typiques |
|---|---|
| Accueil | `tests/e2e/home-featured.spec.ts`, `tests/unit/home-featured.spec.ts` |
| Event détail | `tests/e2e/attend-this-night.spec.ts`, `joiner-attendance`, `event-join` |
| Concerts | `tests/e2e/concerts-add.spec.ts`, `concerts-edit.spec.ts`, `polish-lists` |
| Profil public | `tests/unit/shared-list.spec.ts`, e2e shared list si existant |
| Layout | snapshots largeur si présents |

Ne pas casser : guards domaine attendance, `sortEventsForConcerts`, RLS, Add sheet métier.

---

## Checklist release redesign v1

- [ ] `max-w-3xl` sur home, concerts, e/[id], u/[username]
- [ ] Accueil + Add conformes `handoff-home-add.md`
- [ ] Event détail conforme `handoff-festival-detail.md`
- [ ] Concerts + `/u/:username` conformes `handoff-concerts-list.md`
- [ ] Going 4 rôles respecté partout
- [ ] Pas de barres `.dev-bar` / toggles démo OpenDesign en prod
- [ ] Focus-visible, aria, reduced-motion sur sheets et listes
- [ ] Tests e2e/unit mis à jour
- [ ] Captures avant/après par écran

---

## Fichiers OpenDesign → repo

```
_bmad-output/design/
├── handoff-index.md              ← ce fichier
├── handoff-home-add.md
├── handoff-festival-detail.md
├── handoff-concerts-list.md
├── home-add-prototype.html
├── festival-detail-prototype.html
└── public-profile-prototype.html
```
