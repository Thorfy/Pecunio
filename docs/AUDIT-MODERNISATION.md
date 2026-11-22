# Plan de modernisation — Pecunio

_Version du 22/11/2026. Base auditée : `4fabb8c` (v0.5.3). Branche en cours : `chore/phase-0-tooling`._

## 1. Objectifs

1. **Fiabilité** : plus de données fausses, en double ou périmées, plus d'erreurs silencieuses.
2. **Code maintenable** : modules, dépendances à jour, typage, un seul endroit par responsabilité.
3. **Tests** : unitaires sur toute la logique de calcul, intégration de bout en bout avec l'extension chargée.
4. **Livraison sûre** : une version ne part sur le Chrome Web Store que si la CI est verte.

### Règles du chantier
- **Une phase = une PR**, l'extension reste publiable à la fin de chacune.
- **Test d'abord** : chaque bug du registre (§3) est reproduit par un test qui échoue avant d'être corrigé.
- **Refactor sans changement de comportement** : les phases de restructuration (3, 4) ne corrigent rien ; les corrections sont en phase 2.
- **Aucune donnée bancaire réelle** dans le dépôt : fixtures synthétiques uniquement.
- Le travail non commité d'avant l'audit est conservé dans `stash@{0}` (CacheStore, DateRange, ports multi-onglets, Onboarding, SettingsPanel). On y reprend des morceaux en phase 2, une fois couverts par des tests.

## 2. État des lieux

| Aspect | Constat |
|---|---|
| Code | ~6 300 lignes JS, 26 fichiers, classes globales sans modules |
| Chargement | Ordre des scripts maintenu à la main à 3 endroits (`manifest.json`, `popup.html`, `report.html`) |
| Stockage | `Settings` mélange préférences et cache API (toutes les transactions) |
| Dépendances | Chart.js 3.7.1 (2022), sankey 0.12, date-fns adapter 2.0, choices 11, html2pdf : copiées dans `libs/`, 1,2 Mo |
| Tests | Aucun test automatisé ; `docs/TESTING.md` = scénarios manuels pour la console |
| Outillage | ✅ Phase 0 : ESLint, Prettier, `.gitattributes`, vérification du manifest, CI |
| Points forts | Config centralisée, erreurs typées, validation des données API, retry avec backoff, modèles séparés, bonne doc d'architecture |

## 3. Registre des constats

Source : **C** = lecture du code, **L** = confirmé en conditions réelles dans Chrome (22/11/2026). Colonne « Phase » = phase qui le corrige.

### 3.1 Bugs

| # | Gravité | Constat | Source | Phase |
|---|---|---|---|---|
| B1 | 🔴 | **Authentification d'un seul onglet** : `bg.js` garde un unique `portEvent`, le dernier onglet Bankin connecté écrase les autres → « Auth timeout » dans les autres onglets | C | 2a |
| B2 | 🔴 | **Headers non rejoués et perdus** : envoyés seulement lors d'une requête `/v2/accounts` ; si le content script se connecte après, ou si le service worker MV3 a été tué, attente jusqu'au timeout | C | 2a |
| B3 | 🔴 | **Transactions en double** : `_fetchPaginatedData` appelle la page suivante dans son `try` ; un échec de la page N fait retélécharger la page N‑1 et réinsérer ses données. Les 4xx sont aussi retentées | C | 2a |
| B4 | 🔴 | **Rafraîchissement multiplié** : chaque `build()` ajoute un écouteur sur `.refreshIcon`. Après 2 clics sur « Toggle chart type », **un** clic sur ↻ vide le cache et recharge les données **3 fois**. (Pas de cumul entre pages : Bankin recrée le bouton à chaque navigation) | C + L | 2b |
| B5 | 🟠 | **`build()` concurrents** : aucun verrou ; les 3 rafraîchissements de B4 lancent 3 constructions en parallèle, dont une échoue (`budgetChartBlock not found`) ; le compteur de ReviewPrompt compte deux fois le même build | C + L | 2b |
| B6 | 🔴 | **Graphiques périmés sur l'onglet Revenus** : `/categories/2` n'est pas reconnu (comparaison exacte de `location.href`), les graphiques de dépenses restent affichés et ne suivent plus le mois choisi | L | 2b |
| B7 | 🔴 | **CSV corrompu** : `encodeURI` laisse `#` → fichier tronqué ; guillemets non échappés ; formules Excel non neutralisées (`=`, `+`, `-`, `@`) ; nom de fichier avec des `/` | C | 2a |
| B8 | 🔴 | **Export qui plante sans message** : `account.getDisplayName()` sur un compte supprimé (`{}`) → `TypeError`, avalée car levée dans un callback `chrome.storage` hors du `try/catch` de la popup | C | 2a |
| B9 | 🟠 | **Dates décalées UTC/local** : rapport mensuel arrêté au 30 au lieu du 31 (et au 30/12 pour l'année) ; `DataManager.filterTransactions` exclut le jour de début ; `Config.toDateInputValue` donne la veille entre minuit et 1 h–2 h | C | 2a |
| B10 | ❓ | **Dates ramenées au 1er du mois** : `current_month` vaut 0 par défaut et `getAdjustedDate` fait toujours `setDate(1)` → colonne Date du CSV toujours au 1er, filtres par jour qui fonctionnent au mois. **À confirmer** : voulu pour les graphiques ? (cf. §6) | C | 2a |
| B11 | 🟠 | **Popup forcée à chaque page Bankin** : `openPopup` échoue sans geste utilisateur et laisse un badge « ! » permanent | C | 2b |
| B12 | 🟠 | **Rejet non intercepté** : l'extension démarre même sur `/signin` et lève `AuthenticationError: Auth timeout` au bout de 10 s ; aucun retour visible à l'utilisateur | C + L | 2b |
| B13 | 🟠 | **Settings utilisé comme cache** : chaque sauvegarde relit tout le stockage ; `clearAllSettings` vide tout `storage.local` ; le bouton ↻ écrit `cache_time_* = ""`, rejeté par la validation (warning à chaque clic) | C + L | 2a |
| B14 | 🟠 | **Filtrage écrit 3 fois** avec des règles différentes (`DataManager`, `DataMerger`, `BaseChartData`) : l'export n'exclut pas les catégories d'exception, `DataMerger` ignore la date si une seule borne est fournie | C | 2a |
| B15 | 🟠 | **`Evt` défaillant** : événements « collants » (un nouvel écouteur est rappelé pour un événement passé), `removeListener` sans effet, événements visibles et déclenchables par la page Bankin | C | 3 |
| B16 | 🟡 | **Écouteur `storage.onChanged` par `BudgetChart`**, jamais retiré | C | 2b |

### 3.2 Dette technique et qualité

| # | Constat | Phase |
|---|---|---|
| D1 | Couplage fort au DOM Bankin : classes CSS utilitaires (`.dbl.fs14.fw7.lh18.elp`…), IDs de catégories en dur (`326, 282, 2, 163`) | 4 |
| D2 | 134 `console.*` en production, dont des transactions brutes (données bancaires dans la console) | 2b |
| D3 | Classes globales + ordre de chargement maintenu à 3 endroits | 3 |
| D4 | Librairies copiées sans gestionnaire de paquets, Chart.js 3.7.1 | 3 |
| D5 | Wrappers callback → Promise inutiles en MV3 ; popup encore en callbacks | 2a / 3 |
| D6 | Code mort : `getAllSetting`, `mergeTransactionByCategoryLegacy`, `DataManager.filterTransactions`, `organizeTransactionsByCategory` (O(n × catégories²)). ✅ `LineBarChart.buildChart` déjà retiré | 3 |
| D7 | `Math.min(...dates)` sur des milliers d'éléments (dépassement de pile possible) | 2a |
| D8 | Données bancaires complètes en `storage.local` (+ `unlimitedStorage`), jamais purgées | 4 |
| D9 | Interface mi-française mi-anglaise (« Toggle chart type », « All Months », mois de l'axe en anglais) | 4 |
| D10 | Bouton « Toggle chart type » dessiné dans le canvas : inaccessible au clavier, aux lecteurs d'écran et aux tests e2e | 4 |
| D11 | Aucun indicateur visible pendant les ~6 s avant l'affichage des graphiques | 2b |
| D12 | Description du manifest : « Pecunio overload Bankin website » | 6 |
| D13 | 35 warnings ESLint (surtout `prefer-const`) | 3 |

### 3.3 Ce qui fonctionne (vérifié en réel)
- Page Comptes : graphique « Dépense sur N mois » et « Comparaison Budget Médian ».
- Page Catégories, onglet Dépenses : « Types de dépenses » et Sankey « Flux financiers », bien reconstruits au changement de mois.
- Navigation Comptes ↔ Catégories répétée : aucun doublon dans le DOM.
- Masquage des montants : flou appliqué et retiré proprement.
- Non vérifiés en réel : popup et rapport PDF (pages `chrome-extension://`, inaccessibles à l'outil utilisé) → couverts en phase 5.

## 4. Cible technique

| Sujet | Choix | Pourquoi |
|---|---|---|
| Build | **[WXT](https://wxt.dev)** (Vite) | Manifest généré, entrypoints background / content / popup / report, rechargement à chaud, zip propre |
| Langage | **TypeScript progressif** : `// @ts-check` + JSDoc, puis `.ts` module par module | Le JSDoc existe déjà ; typer l'API Bankin évite une classe entière de bugs |
| Dépendances | npm : `chart.js@4`, `chartjs-chart-sankey`, `chartjs-adapter-date-fns`, `choices.js`, `html2pdf.js` | Versions tracées, mises à jour automatisées |
| Tests unitaires | **Vitest** + happy-dom + faux `chrome.*` (`@webext-core/fake-browser`) | Rapide, même configuration que le build |
| Tests e2e | **Playwright**, extension chargée, Bankin simulé par `context.route` + pages HTML anonymisées | Parcours réel sans compte Bankin, popup et rapport inclus |
| Qualité | ESLint + Prettier + `.editorconfig` + `.gitattributes` ✅ | En place |
| CI/CD | GitHub Actions : lint, types, tests, build, e2e ; release en brouillon sur tag ✅ (partiel) | Plus de version cassée publiée |

Alternative si WXT est jugé trop structurant : Vite ou esbuild seul avec un manifest écrit à la main (plus simple, mais rechargement, zip et multi-entrées à faire soi-même).

## 5. Plan par phases

### Phase 0 — Base saine ✅ _(faite, ½ j)_
Branche `chore/phase-0-tooling`, 4 commits, **pas encore poussée**.
- `.gitattributes` (LF), `.editorconfig`, `.gitignore`.
- `package.json`, ESLint 9 (0 erreur, 35 warnings), Prettier (configuré, pas encore appliqué).
- `scripts/check-manifest.mjs` : fichiers référencés présents, fichiers JS orphelins, versions cohérentes.
- `scripts/package.sh` : zip limité aux fichiers de l'extension, contenu revérifié.
- CI sur PR (manifest, lint, zip) ; release sur tag → envoi **en brouillon**, sans `--auto-publish`.

**Reste à faire** : pousser, ouvrir la PR, vérifier que la CI passe sur GitHub (pas encore exécutée), merger.

### Phase 1 — Filet de tests unitaires _(1,5–2 j)_
But : couvrir la logique existante **sans la modifier**.
- **Harnais Vitest** : charge les fichiers globaux dans l'ordre du manifest (helper unique), faux `chrome.storage` / `chrome.runtime`.
- **Fixtures synthétiques** : générateur de transactions / catégories / comptes au format Bankin (pagination, `current_month`, compte supprimé, descriptions avec `#`, `"`, `=`). Aucune donnée réelle.
- **Cibles** : modèles (`fromRaw`, validation), `DataValidators`, `DataMerger` (merge, filtres, CSV, stats), `BaseChartData` (filtres, agrégations, médiane/moyenne), calculs de `BudgetChart`, `ReportFilters`, `ReportChartDataBuilder`, `DataManager._fetchPaginatedData` (fetch simulé : pagination, retry, 401/403/404/500).
- **Bugs documentés** : un test `test.fails` par bug testable unitairement (B3, B7, B8, B9, B10, B13, B14). Ils passeront au vert quand la phase 2 les corrigera.
- **Fuseaux horaires** : suite lancée en `TZ=Europe/Paris`, `America/New_York`, `UTC`.
- CI : job `test` + rapport de couverture.

**Terminé quand** : la CI exécute les tests sur 3 fuseaux ; couverture ≥ 80 % sur `js/models`, `js/services`, `js/report`, et sur les fonctions de calcul de `js/charts`.

### Phase 2 — Fiabilité _(2–3 j, 2 PR)_

**2a — Données et authentification** (B1–B3, B7–B10, B13, B14, D5, D7)
- `bg.js` : `Map<tabId, port>`, headers stockés dans `chrome.storage.session`, rejoués à chaque connexion. Reprise de la version du stash, complétée.
- Pagination itérative, retry par page, pas de retry sur les 4xx.
- `CacheStore` séparé de `Settings` (reprise du stash) ; suppression ciblée des clés, plus de `storage.local.clear()`.
- Module `DateRange` unique (dates `YYYY-MM-DD` en heure locale partout, reprise du stash) et un seul `TransactionFilter` pour graphiques, export et rapport.
- CSV : `Blob`, échappement RFC 4180, neutralisation des formules, nom de fichier sûr ; compte manquant géré ; popup en `async/await` avec erreurs affichées.
- B10 corrigé selon la décision prise en §6.

**2b — Cycle de vie dans la page** (B4–B6, B11, B12, B16, D2, D11)
- Détection de page par `pathname` (`/accounts`, `/categories`, `/categories/:id`) ; suppression des graphiques Pecunio quand la vue ne les concerne pas.
- Aucun chargement de données hors des pages utiles (pas sur `/signin`) ; erreurs d'authentification interceptées.
- `build()` sérialisé (file d'attente + annulation du build en cours) ; un seul détecteur de navigation à la place du polling 1 s.
- Chaque graphique expose `destroy()` (instance Chart.js + écouteurs via `AbortController`), appelé avant chaque reconstruction ; écouteur ↻ posé une seule fois.
- Suppression de l'`openPopup` automatique ; bandeau visible pour les erreurs (auth expirée, API indisponible) et pendant le chargement.
- Logger à niveaux, silencieux en production, sans données bancaires.

**Terminé quand** : tous les `test.fails` de la phase 1 sont passés au vert ; la recette manuelle §7 est validée dans Chrome.

### Phase 3 — Modules et build _(2–3 j)_
Restructuration **sans changement de comportement** (les tests des phases 1–2 servent de garde-fou).
- Migration WXT : `entrypoints/background`, `content`, `popup/`, `report/`.
- `export` / `import` partout ; dépendances injectées à la place des globales (`evt`, `settingClass`, `dataManager`) ; liste des globales retirée de `eslint.config.js`.
- `Evt` (événements DOM) remplacé par un émetteur en mémoire (B15).
- Libs via npm, `libs/` supprimé ; `check-manifest.mjs` et `package.sh` remplacés par le build WXT.
- Suppression du code mort (D6), warnings ESLint à zéro et passage des règles en `error` (D13).
- **Sous-étape séparée** : Chart.js 3 → 4 (+ plugins), avec comparaison visuelle avant/après.

**Terminé quand** : le zip WXT se charge dans Chrome et la recette §7 passe ; 0 warning ESLint.

### Phase 4 — Types, adaptateur Bankin, finitions _(2–3 j)_
- TypeScript : types de l'API Bankin et des réglages ; `tsc --noEmit` en CI.
- Schéma unique des réglages avec valeurs par défaut et **numéro de version + migrations** du stockage.
- **Adaptateur `BankinPage`** : tous les sélecteurs, la détection de page, la lecture du mois actif ; tests de contrat sur des snapshots HTML anonymisés (alerte dès que Bankin change son interface). IDs de catégories en configuration (D1).
- Interface entièrement en français, dates des axes en `fr` (D9) ; « Toggle chart type » remplacé par un vrai bouton HTML accessible (D10).
- Purge des données en cache à la déconnexion Bankin (à décider, §6) et mention dans la politique de confidentialité (D8).

### Phase 5 — Tests d'intégration et e2e _(2 j)_
- **POC en premier (½ j)** : vérifier que `webRequest.onBeforeSendHeaders` voit les requêtes interceptées par Playwright ; sinon le test injecte les headers dans `chrome.storage.session`.
- Tests de composants (Vitest + happy-dom) : popup (comptes, dates, export), AmountHider, ReviewPrompt.
- Scénarios Playwright (extension chargée, Bankin simulé) :
  1. Comptes → graphique temporel + budget affichés ;
  2. Catégories / Dépenses → types de dépenses + Sankey ; changement de mois → mise à jour ;
  3. Catégories / Revenus + changement de mois → aucun graphique de dépenses périmé (B6) ;
  4. « Toggle chart type » × 2 puis ↻ → un seul rechargement, aucune erreur console (B4, B5) ;
  5. deux onglets Bankin → les deux affichent leurs graphiques (B1) ;
  6. page `/signin` → aucune erreur console (B12) ;
  7. popup : changement de dates → l'onglet Bankin se met à jour ;
  8. export CSV (contenu vérifié) et génération du rapport PDF ;
  9. masquage des montants : flou appliqué puis retiré.

### Phase 6 — CI/CD et release _(½ j)_
- PR : lint → types → unitaires (3 fuseaux, seuil de couverture) → build → e2e.
- Tag `vX.Y.Z` : version unique (`package.json` → manifest), build, zip, envoi au store en brouillon ou en déploiement progressif ; changelog généré.
- Dependabot / Renovate (npm + Actions) ; description du manifest corrigée (D12).
- `--auto-publish` réactivable une fois les e2e stables.

### Récapitulatif

| Phase | Effort | Statut | Corrige |
|---|---|---|---|
| 0 Base saine | ½ j | ✅ à merger | — |
| 1 Tests unitaires | 1,5–2 j | prochaine | documente B3, B7–B10, B13, B14 |
| 2a Données & auth | 1,5 j | | B1–B3, B7–B10, B13, B14 |
| 2b Cycle de vie | 1–1,5 j | | B4–B6, B11, B12, B16 |
| 3 Modules + WXT | 2–3 j | | B15, D3–D6, D13 |
| 4 Types + adaptateur | 2–3 j | | D1, D8–D10 |
| 5 e2e | 2 j | | non-régression de tout le registre |
| 6 CI/CD | ½ j | | D12 |

**Total : 11 à 14 jours.** Les phases 0 → 2 règlent tout ce que voient les utilisateurs ; 3 → 6 rendent le code durable.

## 6. Décisions à prendre

| Sujet | Question | Quand |
|---|---|---|
| B10 | Ramener chaque transaction au 1er du mois est-il voulu ? Proposition : garder la vraie date pour l'export et le rapport, n'utiliser le mois de rattachement (`current_month`) que pour regrouper | avant 2a |
| Build | WXT (recommandé) ou Vite seul ? | avant 3 |
| TypeScript | Conversion complète en `.ts` ou JSDoc + `checkJs` seulement ? | avant 4 |
| Données | Purger le cache à la déconnexion de Bankin ? Durée de conservation ? | avant 4 |
| Publication | Réactiver la publication automatique après la phase 5, ou garder une validation manuelle ? | phase 6 |

## 7. Recette manuelle (avant chaque merge de phase 2 à 4)

Extension rechargée dans `chrome://extensions`, onglet Bankin rechargé, console ouverte :
1. `/accounts` : les deux graphiques apparaissent ; ↻ après 2 « Toggle chart type » → un seul rechargement dans la console.
2. `/categories` : donut + Sankey ; changer de mois deux fois.
3. Onglet Revenus, changer de mois : pas de graphique de dépenses.
4. Masquer / afficher les montants.
5. 4 allers-retours Comptes ↔ Catégories : aucun doublon.
6. Popup : modifier les dates, exporter le CSV (l'ouvrir), générer le rapport PDF.
7. Se déconnecter puis aller sur `/signin` : aucune erreur dans la console.
