# Audit des écrans et fonctionnalités — Pecunio

_22/11/2026 — après la modernisation (phases 0 à 6, `docs/AUDIT-MODERNISATION.md`)._

## 1. Méthode

- **Pages Bankin réelles** parcourues dans Chrome avec l'extension (version de la phase 4c) : Comptes, Catégories / Dépenses, Catégories / Revenus, détail d'une catégorie. Aucune donnée réelle n'est reproduite ici.
- **Popup et rapport PDF** capturés avec Playwright sur le Bankin simulé (données synthétiques) : Claude in Chrome ne peut pas ouvrir les pages `chrome-extension://`.
- **Styles** relevés dans la page (polices, couleurs, cartes) pour comparer Pecunio et Bankin.

Gravité : 🔴 gêne réelle ou défaut, 🟠 confusion ou lisibilité, 🟡 finition.

## 2. Constats par écran

### 2.1 Page Comptes (graphique temporel + comparaison budget)

| # | Gravité | Constat | Recommandation |
|---|---|---|---|
| U1 | 🔴 | **Masquage des montants incohérent** : icône « œil barré » et graphiques en mode masqué, mais solde et montants des comptes en clair ; sur la page Catégories, total flouté mais liste en clair. Vu avec la version 4c ; cause probable : la double écriture de la préférence corrigée par B25 (phase 5b) | Revérifier avec la version actuelle ; si le défaut persiste, test e2e « recharger la page en mode masqué » |
| U2 | 🟠 | **Graphique temporel très dense** : 114 mois et 17 catégories empilées ; revenus (au-dessus de zéro) et dépenses (en dessous) dans le même empilement ; impossible de lire un mois ou une tendance | Période par défaut de 12 mois, boutons **6 m / 12 m / 24 m / Tout** au-dessus du graphique ; ligne **solde du mois** (revenus − dépenses) superposée |
| U3 | 🟠 | **La période ne se règle que dans la popup** (« Période d'export ») alors qu'elle filtre aussi les graphiques | Boutons de période dans la page (U2) ; renommer dans la popup « Période analysée (graphiques et export) » |
| U4 | 🟠 | **Comparaison budget difficile à lire** : les revenus (~+3 000) écrasent l'échelle des dépenses ; libellés « Colonne Gauche (Principale) / Colonne Droite (Comparaison) » techniques ; 5 listes déroulantes ; noms de catégories inclinés | Dépenses seules, **barres horizontales triées** par montant, écart affiché (« +12 % ») ; libellés « Période » / « Comparer à » ; préréglages « Ce mois vs médiane », « Cette année vs l'an dernier » |
| U5 | 🟡 | Titre avec emoji (« 📊 Comparaison Budget Médian ») alors que Bankin n'en utilise pas ; « Médian » dans le titre alors que le calcul peut être une moyenne | Titres sobres comme ceux de Bankin (« \| Comparaison du budget ») |
| U6 | 🟡 | Le titre « Dépenses sur N mois » et les graduations sont dessinés dans le canvas : police de Chart.js, pas celle de Bankin (voir §3) | Police et couleurs de Bankin pour Chart.js |

### 2.2 Page Catégories — Dépenses (types de dépenses + flux financiers)

| # | Gravité | Constat | Recommandation |
|---|---|---|---|
| U7 | 🟠 | **Types de dépenses sans chiffres** : donut sans montant ni pourcentage visible (infobulle seulement) ; carte moins haute que celle de Bankin à côté (vide en dessous) | Total et part « Essentiel » au centre, pourcentages dans la légende ; cartes de même hauteur |
| U8 | 🟠 | **Flux financiers** : très lisible pour les grosses catégories, mais les petites sous-catégories se chevauchent (libellés de 2–3 px de flux) | Regrouper les flux sous 2 % en « Autres » ; montant au survol (déjà présent), pourcentage du budget dans l'infobulle |
| U9 | 🟡 | Nœud « Restant » : notion pas évidente (budget − dépenses) | « Épargné / non dépensé » ; en rouge « Dépassement » quand les dépenses dépassent les revenus |

### 2.3 Catégories — Revenus et détail d'une catégorie

| # | Gravité | Constat | Recommandation |
|---|---|---|---|
| U10 | 🟠 | **Rien sur l'onglet Revenus** : seul le donut de Bankin (souvent 1–2 sources) | Évolution des revenus sur 12 mois par source, revenu médian, mois atypiques (§4, G6) |
| U11 | 🟠 | **Rien sur le détail d'une catégorie** (`/categories/:id`) : on voit le mois, jamais la tendance | Historique de la catégorie sur 12 mois avec médiane et mois en cours mis en avant (§4, G3) |

### 2.4 Popup

| # | Gravité | Constat | Recommandation |
|---|---|---|---|
| U12 | 🔴 | **Requêtes vers `img.shields.io`** à chaque ouverture (badges « installed » et « release ») : un service tiers apprend l'usage de l'extension et l'adresse IP, en contradiction avec « rien n'est envoyé ailleurs que vers Bankin » (README) | Supprimer les badges ; afficher la version locale (déjà là) et un lien « Nouveautés » vers les releases |
| U13 | 🟠 | Popup très longue (≈ 1 600 px) : instructions d'épinglage en tête, puis « Aller sur Bankin », période, comptes, export, deux boutons de réinitialisation au même niveau que les actions | Ordre : période → comptes → actions ; épinglage en bandeau fermable ; réinitialisations repliées dans « Avancé » |
| U14 | 🟠 | Deux notions de période (« Période d'export » et « Période du rapport PDF ») sans lien expliqué | Rapport : « Même période » par défaut, ou année/mois explicites |
| U15 | 🟡 | Préréglages de période absents | Boutons « Ce mois », « 3 mois », « 12 mois », « Tout » |
| U16 | 🟡 | Icônes en emoji (📌 🔗 📅 🏦 📊 📄 🔄 ⚙️) : rendu variable selon le système | Icônes SVG cohérentes, ou aucune |

### 2.5 Rapport PDF

| # | Gravité | Constat | Recommandation |
|---|---|---|---|
| U17 | 🔴 | **Graphique « Par catégorie » qui sort de la page** : la grille `1fr 1fr` (`.charts-pair`) laisse le canvas imposer sa largeur | `grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)` ; vérifier le PDF généré |
| U18 | 🔴 | **« Barres empilées » mal empilées** (évolution mensuelle) : `stacked` sur l'axe Y seulement ; les barres sont décalées et flottent | `stacked: true` sur X et Y |
| U19 | 🟠 | « Répartition par catégorie » en **polarArea** : graduations radiales illisibles, comparaison des surfaces trompeuse | Barres horizontales triées, ou donut avec pourcentages |
| U20 | 🟡 | Mois de l'évolution écrits à la main (« Jan, Fév, Mar ») ; couleurs des catégories différentes de celles de Bankin ; nœud « Dépenses » vert-jaune dans le flux | Mois via `Intl` (« janv. 2024 ») ; couleurs des catégories Bankin (comme dans la page) |
| U21 | 🟡 | Pas de solde mensuel ni de taux d'épargne dans le rapport | Ajouter G1 (§4) |

## 3. Style et cohérence avec Bankin

| Élément | Bankin | Pecunio aujourd'hui | Recommandation |
|---|---|---|---|
| Police | Open Sans | police système (`-apple-system, Segoe UI…`) ; Chart.js : Helvetica par défaut | Open Sans partout : `Chart.defaults.font.family` et CSS injecté |
| Couleur du texte | bleu nuit `#00213c` | `#333`, et gris `#666` dans les graphiques | `#00213c` pour les titres, `#5b6b7c` pour les textes secondaires et graduations |
| Couleur d'accent | violet `#6562fc` | dégradé `#667eea → #764ba2` (boutons, popup) | Violet de Bankin, sans dégradé, dans la page ; la popup peut garder son identité |
| Cartes | blanches, titre « \| Titre » avec barre à gauche | proche (`pecunio-section`, bordure `#f0f0f0`) | Garder ; même hauteur pour les cartes côte à côte |
| Couleurs des catégories | classes `categoryColor_<id>` | reprises dans les graphiques de la page ✅, pas dans le rapport | Les transmettre au rapport |
| Emojis dans les titres | aucun | « 📊 », légendes « 🏠 Essentiel… » | Les retirer |

Un fichier unique de **jetons de style** (`js/ui/theme.js` : police, couleurs, grille) appliqué à Chart.js et au CSS injecté éviterait les écarts.

## 4. Nouveaux graphiques proposés

Données disponibles pour chaque transaction : date, montant signé, catégorie et sous-catégorie, compte, type de dépense (essentiel, plaisir, épargne…), libellé, mois de rattachement.

| # | Graphique | Où | Question à laquelle il répond | Effort | Valeur |
|---|---|---|---|---|---|
| G1 | **Solde mensuel et taux d'épargne** : barres revenus − dépenses (vert / rouge) par mois + courbe du taux d'épargne | Comptes (au-dessus du graphique temporel), rapport | « Est-ce que j'épargne chaque mois, et combien ? » | S | ⭐⭐⭐ |
| G2 | **Rythme du mois** : dépenses cumulées jour par jour du mois en cours vs cumul médian des mois précédents | Catégories / Dépenses (mois en cours) | « Suis-je en avance ou en retard sur mon rythme habituel ? » | M | ⭐⭐⭐ |
| G3 | **Historique d'une catégorie** : 12 derniers mois, médiane en pointillés, mois affiché mis en avant, sous-catégories empilées | Détail d'une catégorie | « Mes dépenses de courses augmentent-elles ? » | S | ⭐⭐⭐ |
| G4 | **Abonnements et dépenses récurrentes** : libellés qui reviennent chaque mois à montant proche → liste avec coût mensuel et annuel, dernier prélèvement, variation de prix | Comptes ou Catégories (carte « Récurrent ») | « Combien me coûtent mes abonnements, lesquels ont augmenté ? » | M | ⭐⭐⭐ |
| G5 | **Plus fortes variations** : catégories dont la dépense du mois s'écarte le plus de leur médiane (« Loisirs +45 % ») | Catégories / Dépenses | « Qu'est-ce qui a dérapé ce mois-ci ? » | S | ⭐⭐ |
| G6 | **Revenus sur 12 mois** par source, revenu médian | Catégories / Revenus | « Mes revenus sont-ils stables ? » | S | ⭐⭐ |
| G7 | **Cette année vs l'an dernier** : cumul des dépenses mois par mois, deux courbes | Comptes ou rapport | « Est-ce que je dépense plus que l'an dernier à la même date ? » | S | ⭐⭐ |
| G8 | **Calendrier des dépenses** (carte de chaleur jour par jour sur l'année) | Rapport, ou carte dépliable | « Quels jours je dépense le plus ? » | M | ⭐ |
| G9 | **Plus grosses dépenses / principaux libellés** du mois | Catégories / Dépenses | « Où est passé l'argent ce mois-ci ? » | S | ⭐⭐ |

Effort : S = quelques heures (données déjà agrégées par les graphiques existants), M = une journée (calcul nouveau, ex. détection des récurrences).

Pistes écartées pour l'instant : prévision de fin de mois (peu fiable sans historique long et régulier), patrimoine par compte (Bankin ne fournit pas l'historique des soldes, seulement les transactions).

## 5. Feuille de route proposée

| Lot | Contenu | Pourquoi d'abord |
|---|---|---|
| **UX-1 Corrections** ✅ | U1 (vérifier), U12 (shields.io), U17, U18, U19, U20 ; police et couleurs de Bankin (§3, `theme.js`) | Défauts visibles et vie privée ; base visuelle commune pour la suite |
| **UX-2 Lisibilité** | U2–U5 (période dans la page, solde superposé, comparaison budget repensée), U7–U9, popup réorganisée (U13–U16) — découpé en **UX-2a** (page Comptes ✅) et **UX-2b** (Catégories, popup) | Les écrans existants deviennent utiles sans rien ajouter |
| **UX-3 Nouveaux graphiques** | G1, G3, G2, puis G5 | Plus forte valeur pour un effort faible à moyen ; G3 et G6 occupent des pages aujourd'hui vides |
| **UX-4 Exploration** | G4 (récurrents), G6, G7, G9, G8 | Plus d'effort ou de valeur à confirmer |

Chaque lot : tests unitaires des calculs, scénarios e2e sur le Bankin simulé, recette sur le vrai Bankin, une PR.

### Suivi

**UX-1** ✅ _(branche `feat/ux-1-fixes-theme`)_ :
- U1 : **le défaut persistait après B25 sur le vrai Bankin**. Cause : au chargement, Bankin met à jour ses montants en réécrivant leur attribut `class`, ce qui effaçait la classe de flou posée élément par élément par Pecunio. Le masquage repose désormais sur une classe posée sur `<html>` et une règle CSS qui floute tous les montants ciblés par l'adaptateur, y compris ceux réécrits ou ajoutés plus tard. Le Bankin simulé reproduit cette réécriture ; le scénario e2e 9b échoue avec l'ancienne version et passe avec la nouvelle.
- U12 : badges `img.shields.io` retirés de la popup ; **le rapport chargeait aussi sa police depuis Google Fonts** : Open Sans est désormais embarquée (`@fontsource/open-sans`). Test unitaire (aucune ressource externe dans la popup et le rapport) et scénario e2e (aucune requête hors Bankin).
- U17 : grille du rapport en `minmax(0, 1fr)`. U18 : barres empilées sur les deux axes. U19 : donut au lieu de l'aire polaire. U20 : mois via `Intl` (« janv. 2024 ») et couleurs des catégories de Bankin dans le rapport (`js/bankin/categoryColors.js`), sous-catégories du flux de la couleur de leur parent.
- §3 : `js/ui/theme.js` (Open Sans, bleu nuit `#00213c`, violet `#6562fc`) appliqué à Chart.js et au CSS injecté ; emojis retirés des titres et légendes ; cartes côte à côte de même hauteur ; titre « Comparaison du budget ».

**UX-2a** ✅ _(branche `feat/ux-2a-accounts-charts`)_ :
- Graphique temporel (U2, U3, U6) : 12 mois par défaut, boutons **6 mois / 12 mois / 24 mois / Tout**, vue simplifiée (revenus, 5 catégories de dépenses principales de la période, « Autres dépenses ») ou **toutes les catégories**, **ligne du solde du mois** ; préférences `chartRange` et `chartDetailed`. Calculs dans `js/charts/timeline.js` (testés).
- Comparaison du budget (U4, U5) : préréglages **Ce mois-ci**, **Mois dernier** (par défaut), **Cette année** face à la médiane des 12 mois précédents ou à l'an dernier, et **Personnaliser** (les listes de choix, repliées) ; dépenses seules en barres horizontales triées, synthèse « total et écart », écart par catégorie dans l'infobulle ; préférence `budgetPreset`. Calculs dans `js/charts/budgetComparison.js` (testés).

## 6. Questions à trancher

Réponses du 22/11/2026 : 1 → vue simplifiée par défaut ; 2 → préréglages + « Personnaliser » ; 3 → abonnements plus tard ; 4 → popup à l'identité Pecunio (violet, vert, Open Sans, logo).

1. **Graphique temporel** : remplacer l'empilement de 17 catégories par défaut (ex. solde + 5 premières catégories + « Autres ») ou garder la vue complète en option ?
2. **Comparaison budget** : garder les 5 listes déroulantes (souplesse) ou passer à des préréglages (simplicité) ?
3. **Abonnements (G4)** : utile pour toi ? La détection repose sur les libellés et peut se tromper (faux positifs à valider).
4. **Popup** : garder son style propre (dégradé violet) ou l'aligner sur Bankin ?
