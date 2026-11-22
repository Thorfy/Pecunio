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

Source : **C** = lecture du code, **L** = confirmé en conditions réelles dans Chrome (22/11/2026), **T** = reproduit par un test automatisé (`knownBug` dans `test/unit/`, phase 1). Colonne « Phase » = phase qui le corrige.

### 3.1 Bugs

| # | Gravité | Constat | Source | Phase |
|---|---|---|---|---|
| B1 | 🔴 | **Authentification d'un seul onglet** : `bg.js` garde un unique `portEvent`, le dernier onglet Bankin connecté écrase les autres → « Auth timeout » dans les autres onglets | C + T | ✅ 2a |
| B2 | 🔴 | **Headers non rejoués et perdus** : envoyés seulement lors d'une requête `/v2/accounts` ; si le content script se connecte après, ou si le service worker MV3 a été tué, attente jusqu'au timeout | C + T | ✅ 2a |
| B3 | 🔴 | **Transactions en double** : `_fetchPaginatedData` appelle la page suivante dans son `try` ; un échec de la page N fait retélécharger la page N‑1 et réinsérer ses données (test : `[1, 2, 1, 2, 3]`). Les 4xx (404…) sont aussi retentées | C + T | ✅ 2a |
| B4 | 🔴 | **Rafraîchissement multiplié** : chaque `build()` ajoute un écouteur sur `.refreshIcon`. Après 2 clics sur « Toggle chart type », **un** clic sur ↻ vide le cache et recharge les données **3 fois**. (Pas de cumul entre pages : Bankin recrée le bouton à chaque navigation) | C + L + T | ✅ 2b |
| B5 | 🟠 | **`build()` concurrents** : aucun verrou ; les 3 rafraîchissements de B4 lancent 3 constructions en parallèle, dont une échoue (`budgetChartBlock not found`) ; le compteur de ReviewPrompt compte deux fois le même build | C + L + T | ✅ 2b |
| B6 | 🔴 | **Graphiques périmés sur l'onglet Revenus** : `/categories/2` n'est pas reconnu (comparaison exacte de `location.href`), les graphiques de dépenses restent affichés et ne suivent plus le mois choisi | L + T | ✅ 2b |
| B7 | 🔴 | **CSV corrompu** : `encodeURI` laisse `#` → fichier tronqué ; guillemets non échappés ; formules Excel non neutralisées (`=`, `+`, `-`, `@`) ; nom de fichier avec des `/` | C + T | ✅ 2a |
| B8 | 🔴 | **Export qui plante sans message** : `account.getDisplayName()` sur un compte supprimé (`{}`) → `TypeError`, avalée car levée dans un callback `chrome.storage` hors du `try/catch` de la popup | C + T | ✅ 2a |
| B9 | 🟠 | **Dates décalées UTC/local** : rapport mensuel arrêté au 30 au lieu du 31 (et au 30/12 pour l'année) ; `DataManager.filterTransactions` exclut le jour de début **dans tout fuseau sauf UTC** ; `Config.toDateInputValue` donne la veille entre minuit et 1 h–2 h (France) ; à l'ouest de UTC, une dépense du 1er janvier est rangée en décembre (page Catégories) et tracée en **décembre de la même année** (graphique temporel) | C + T | ✅ 2a |
| B10 | 🟠 | **Dates ramenées au 1er du mois** : `current_month` vaut 0 par défaut et `getAdjustedDate` fait toujours `setDate(1)` → colonne Date du CSV toujours au 1er, filtres par jour qui fonctionnent au mois. **Décidé** : l'export garde la vraie date + une colonne « Budget Month » ; graphiques et filtres utilisent la date budgétaire (date réelle décalée de `current_month`, jour conservé) | C + T | ✅ 2a |
| B11 | 🟠 | **Popup forcée à chaque page Bankin** : `openPopup` échoue sans geste utilisateur et laisse un badge « ! » permanent | C + T | ✅ 2b |
| B12 | 🟠 | **Rejet non intercepté** : l'extension démarre même sur `/signin` et lève `AuthenticationError: Auth timeout` au bout de 10 s ; aucun retour visible à l'utilisateur | C + L + T | ✅ 2b |
| B13 | 🟠 | **Settings utilisé comme cache** : chaque sauvegarde relit tout le stockage ; `clearAllSettings` vide tout `storage.local` (y compris les catégories masquées et le rapport) ; le bouton ↻ écrit `cache_time_* = ""`, rejeté par la validation (warning à chaque clic) | C + L + T | ✅ 2a |
| B14 | 🟠 | **Filtrage écrit 3 fois** avec des règles différentes (`DataManager`, `DataMerger`, `BaseChartData`) : l'export n'exclut pas les catégories d'exception, `DataMerger` ignore la date si une seule borne est fournie | C + T | ✅ 2a |
| B15 | 🟠 | **`Evt` défaillant** : événements « collants » (un nouvel écouteur est rappelé pour un événement passé), `removeListener` sans effet, événements visibles et déclenchables par la page Bankin | C + T | ✅ 3c |
| B16 | 🟡 | **Écouteur `storage.onChanged` par `BudgetChart`**, jamais retiré | C + T | ✅ 2b |
| B17 | 🟠 | **Plantage du regroupement par catégorie** : `BaseChartData.mergeTransactionByCategory` fait `category.categories.forEach` sans vérifier ; une catégorie parente sans sous-catégories fait planter le Sankey | T | ✅ 2a |
| B18 | 🟠 | **Sankey : remboursements comptés comme dépenses** : les montants sont additionnés en valeur absolue ; une dépense de 100 € remboursée de 40 € apparaît comme 140 € de dépenses au lieu de 60 € | T | ✅ 2a |
| B19 | 🔴 | **Page Catégories vide si le navigateur n'est pas en français** : `applySettingOnDataByMonth` compare le nom du mois affiché par Bankin (« février ») au nom du mois dans la langue du navigateur (`toLocaleString('default')`) ; avec Chrome en anglais, aucune transaction ne correspond (non vérifié en réel : le Chrome testé est en français) | T | ✅ 2a |
| B20 | 🟠 | **Infobulle du graphique « Comparaison Budget Médian » : montants NaN** : `Number(context.parsed)` alors que Chart.js fournit un objet `{ x, y }` pour un graphique en barres (signalé par l'utilisateur le 22/11/2026, présent depuis février 2026) | L + T | ✅ 2a |
| B21 | 🟡 | **Modale « Un petit avis ? » affichée en double** : la vérification « déjà affichée » précède le délai de 2 s ; deux constructions rapprochées (chargement puis arrivée des données) programment chacune une modale (vu en recette de la phase 3a sur une installation neuve) | L + T | ✅ 3a |
| B22 | 🟡 | **Bandeau d'état déformé dans la page Bankin** : les règles CSS de Bankin sur tous les `button` (largeur, marges, fond, prioritaires) écrasent les styles en ligne du bandeau ; corrigé en isolant son contenu dans un Shadow DOM | L + T | ✅ 3b |
| B23 | 🔴 | **« Vibration » du graphique temporel** : canvas en `height: 100%` dans un conteneur sans hauteur fixe + ratio 2 ⇒ hauteur idéale 582,5 px, Chart.js alterne 582/583 px toutes les 20–30 ms et redessine en continu (mesuré : 65 redimensionnements en 7 s, sans fin) ; conteneur de 580 px et `maintainAspectRatio: false` | L + T | ✅ 3b |
| B24 | 🟠 | **Graphiques reconstruits deux fois au chargement** : construits depuis le cache puis reconstruits 50 ms plus tard à l'arrivée de données identiques (clignotement, travail inutile) ; la reconstruction est désormais ignorée quand l'empreinte données + réglages + page est inchangée | L + T | ✅ 3b |

### 3.2 Dette technique et qualité

| # | Constat | Phase |
|---|---|---|
| D1 | Couplage fort au DOM Bankin : classes CSS utilitaires (`.dbl.fs14.fw7.lh18.elp`…), IDs de catégories en dur (`326, 282, 2, 163`) | 4 |
| D2 | 134 `console.*` en production, dont des transactions brutes (données bancaires dans la console) — ✅ 2b : `Logger` (debug silencieux par défaut), plus de transactions dans la console | 2b |
| D3 | Classes globales + ordre de chargement maintenu à 3 endroits | ✅ 3a |
| D4 | Librairies copiées sans gestionnaire de paquets, Chart.js 3.7.1 — ✅ 3a : npm ; ✅ 3b : versions à jour + Dependabot | ✅ 3b |
| D5 | Wrappers callback → Promise inutiles en MV3 ; popup encore en callbacks | 2a / 3 |
| D6 | Code mort : `getAllSetting`, `DataManager.filterTransactions`, `organizeTransactionsByCategory` (O(n × catégories²))… ✅ phase 0 : `LineBarChart.buildChart` ; ✅ 3c : le reste (`mergeTransactionByCategoryLegacy` est en fait utilisé par le graphique temporel, conservé) | ✅ 3c |
| D7 | `Math.min(...dates)` sur des milliers d'éléments (dépassement de pile possible) | ✅ 2a |
| D8 | Données bancaires complètes en `storage.local` (+ `unlimitedStorage`), jamais purgées | 4 |
| D9 | Interface mi-française mi-anglaise (« Toggle chart type », « All Months », mois de l'axe en anglais) | 4 |
| D10 | Bouton « Toggle chart type » dessiné dans le canvas : inaccessible au clavier, aux lecteurs d'écran et aux tests e2e | 4 |
| D11 | Aucun indicateur visible pendant les ~6 s avant l'affichage des graphiques — ✅ 2b : bandeau « chargement de vos données… » après 1,5 s | 2b |
| D12 | Description du manifest : « Pecunio overload Bankin website » | 6 |
| D13 | 35 warnings ESLint (surtout `prefer-const`) | ✅ 3c |
| D14 | Visibilité des catégories stockée sous des clés de premier niveau nommées d'après les catégories (`"Logement": true`) : collisions possibles avec les autres clés, nettoyage impossible | 4 |

### 3.3 Ce qui fonctionne (vérifié en réel)
- Page Comptes : graphique « Dépense sur N mois » et « Comparaison Budget Médian ».
- Page Catégories, onglet Dépenses : « Types de dépenses » et Sankey « Flux financiers », bien reconstruits au changement de mois.
- Navigation Comptes ↔ Catégories répétée : aucun doublon dans le DOM.
- Masquage des montants : flou appliqué et retiré proprement.
- Non vérifiés en réel : popup et rapport PDF (pages `chrome-extension://`, inaccessibles à l'outil utilisé) → couverts en phase 5.

## 4. Cible technique

| Sujet | Choix | Pourquoi |
|---|---|---|
| Build | **[WXT](https://wxt.dev)** (Vite) ✅ | Manifest généré, entrypoints background / content / popup / report, rechargement à chaud, zip propre |
| Langage | **TypeScript progressif** : `// @ts-check` + JSDoc, puis `.ts` module par module | Le JSDoc existe déjà ; typer l'API Bankin évite une classe entière de bugs |
| Dépendances | npm : `chart.js@4`, `chartjs-chart-sankey`, `chartjs-adapter-date-fns`, `choices.js`, `html2pdf.js` | Versions tracées, mises à jour automatisées |
| Tests unitaires | **Vitest** + happy-dom + faux `chrome.*` maison ✅ | Rapide, même configuration que le futur build Vite/WXT |
| Tests e2e | **Playwright**, extension chargée, Bankin simulé par `context.route` + pages HTML anonymisées | Parcours réel sans compte Bankin, popup et rapport inclus |
| Qualité | ESLint + Prettier + `.editorconfig` + `.gitattributes` ✅ | En place |
| CI/CD | GitHub Actions : lint, types, tests, build, e2e ; release en brouillon sur tag ✅ (partiel) | Plus de version cassée publiée |

Alternative si WXT est jugé trop structurant : Vite ou esbuild seul avec un manifest écrit à la main (plus simple, mais rechargement, zip et multi-entrées à faire soi-même).

## 5. Plan par phases

### Phase 0 — Base saine ✅ _(faite, ½ j — PR Thorfy/Pecunio#12, mergée)_
- `.gitattributes` (LF), `.editorconfig`, `.gitignore`.
- `package.json`, ESLint 9 (0 erreur, 35 warnings), Prettier (configuré, pas encore appliqué).
- `scripts/check-manifest.mjs` : fichiers référencés présents, fichiers JS orphelins, versions cohérentes.
- `scripts/package.sh` : zip limité aux fichiers de l'extension, contenu revérifié.
- CI sur PR (manifest, lint, zip) ; release sur tag → envoi **en brouillon**, sans `--auto-publish`.

### Phase 1 — Filet de tests unitaires ✅ _(faite, PR Thorfy/Pecunio#13, mergée)_
But : couvrir la logique existante **sans la modifier** (aucun fichier de l'extension modifié).
- **Harnais Vitest 5** + happy-dom : un plugin de test expose les classes globales sur `globalThis`, les scripts sont importés dans l'ordre du manifest ; faux `chrome.*` maison (stockage callback + promesse, ports, événements).
- **Fixtures synthétiques** (`test/fixtures/bankin.js`) : catégories, comptes, transactions, pages d'API paginées. Aucune donnée réelle.
- **11 fichiers, 170 tests** : modèles, `DataValidators`, `DataMerger` (fusion, filtres, CSV, stats), rapport (`ReportFilters`, `ReportChartDataBuilder`, `ReportStorage`, `PdfExporter`), calculs de tous les graphiques, `DataManager` (pagination, retry, auth, cache), `Settings`, `Config`, `Evt`, `bg.js`.
- **20 bugs documentés** par des tests `knownBug` (B1, B2, B3, B7, B8, B9, B13, B14, B15, B17, B18, B19) : ils décrivent le comportement attendu et échouent tant que le bug existe. `npm run test:bugs` affiche leurs vrais messages d'échec. B10 : test du comportement actuel + `todo` en attendant la décision.
- **3 bugs découverts** par les tests : B17, B18, B19.
- **Fuseaux horaires** : `npm run test:tz` (Paris, New York, UTC) ; matrice identique en CI.
- **Couverture** (seuils bloquants en CI) : modèles 100 %, services ~98 %, rapport ~97 %, cœur ~92 %, `BaseChartData` ~89 %. Le rendu des graphiques et `js/ui` restent pour la phase 5.
- Non couverts unitairement : B4–B6, B11, B12, B16 (cycle de vie dans la page Bankin) et la partie de B9 située dans `popup.js` (rapport PDF) → phase 2b / 5.

### Phase 2 — Fiabilité _(2–3 j, 2 PR)_

**2a — Données et authentification** ✅ _(branche `fix/phase-2a-data-auth`)_ (B1–B3, B7–B10, B13, B14, B17–B19, D5, D7)
- `bg.js` : `Map<tabId, port>`, headers stockés dans `chrome.storage.session`, rejoués à chaque connexion. Reprise de la version du stash, complétée.
- Pagination itérative, retry par page, pas de retry sur les 4xx.
- `CacheStore` séparé de `Settings` (reprise du stash) ; suppression ciblée des clés, plus de `storage.local.clear()`.
- Module `DateRange` unique (dates `YYYY-MM-DD` en heure locale partout, reprise du stash) et un seul `TransactionFilter` pour graphiques, export et rapport.
- CSV : `Blob`, échappement RFC 4180, neutralisation des formules, nom de fichier sûr ; compte manquant géré ; popup en `async/await` avec erreurs affichées.
- B10 corrigé selon la décision prise en §6.

Réalisé : nouveaux modules `DateRange` (dates calendaires en heure locale, date budgétaire, mois FR/EN), `TransactionFilter` (filtre unique) et `CacheStore` (cache séparé des réglages) ; `bg.js` réécrit ; pagination itérative ; export CSV via `Blob` (UTF-8 + BOM, RFC 4180, formules neutralisées, colonne « Budget Month ») ; erreurs d'export affichées dans la popup. Choix : l'export CSV garde toutes les catégories (virements internes, épargne) ; le rapport PDF et les graphiques les excluent. Les graphiques respectent désormais « pas de date de fin ». Tests : 249, résultats identiques sous Paris, New York et UTC ; seuls B15 (×2) restent en `knownBug` (phase 3).

**2b — Cycle de vie dans la page** ✅ _(branche `fix/phase-2b-page-lifecycle`)_ (B4–B6, B11, B12, B16, D2, D11)
- Détection de page par `pathname` (`/accounts`, `/categories`, `/categories/:id`) ; suppression des graphiques Pecunio quand la vue ne les concerne pas.
- Aucun chargement de données hors des pages utiles (pas sur `/signin`) ; erreurs d'authentification interceptées.
- `build()` sérialisé (file d'attente + annulation du build en cours) ; un seul détecteur de navigation à la place du polling 1 s.
- Chaque graphique expose `destroy()` (instance Chart.js + écouteurs via `AbortController`), appelé avant chaque reconstruction ; écouteur ↻ posé une seule fois.
- Suppression de l'`openPopup` automatique ; bandeau visible pour les erreurs (auth expirée, API indisponible) et pendant le chargement.
- Logger à niveaux, silencieux en production, sans données bancaires.

Réalisé (2b) : `injected.js` réduit à la création des services ; tout le cycle de vie est dans `PageController` (testé : 35 tests). Constructions sérialisées et regroupées ; graphiques détruits avant chaque reconstruction ; écouteurs ↻ et sélecteur de mois posés une fois par élément ; page reconnue par son chemin (`/categories/2` = Revenus, graphiques de dépenses retirés) ; données chargées uniquement sur les pages à graphiques ; erreurs affichées dans un `StatusBanner` avec bouton « Recharger », et graphiques depuis le cache si l'API est indisponible ; réglages modifiés dans la popup appliqués à la page ouverte. La vérification périodique de l'URL est conservée comme filet de sécurité (l'API Navigation est utilisée quand elle existe), toutes les sources passant par la même détection.

**Terminé quand** : tous les tests `knownBug` de la phase 1 sont convertis en tests normaux et passent sous les 3 fuseaux ; la recette manuelle §7 est validée dans Chrome.

### Phase 3 — Modules et build _(2–3 j, 3 PR)_
Restructuration **sans changement de comportement** (les tests des phases 1–2 servent de garde-fou). Décidé : **WXT**.

**3a — Modules ES + WXT** ✅ _(branche `refactor/phase-3a-wxt-modules`)_
- `export` / `import` partout ; plus aucune classe globale. Instances injectées (`settings`, `cacheStore`) ou partagées par module (`evt` dans `js/core/events.js`).
- Build WXT : `entrypoints/background.js`, `content.js`, `popup/`, `report/` ; manifest généré (`wxt.config.js`, version de `package.json`) ; `public/` pour les images et html2pdf.
- Librairies via npm **aux mêmes versions** (Chart.js 3.7.1, sankey 0.12.0, adaptateur date-fns 2.0.0, Choices 11.0.2) ; `libs/` supprimé sauf html2pdf (`public/libs/`, chargé par balise script dans le rapport).
- `check-manifest.mjs` et `package.sh` remplacés par `wxt build` / `wxt zip` ; CI et release adaptées (Node 22).
- Tests : plus de plugin « legacy », les modules sont importés ; leurs exports restent exposés en global pendant la transition.

**3b — Dépendances** ✅ _(branche `chore/phase-3b-deps`)_ : Chart.js 3.7.1 → 4.6.1, chartjs-chart-sankey 0.12 → 0.22, chartjs-adapter-date-fns 2 → 3 (date-fns 2 → 4), Choices 11.0 → 11.2 ; html2pdf.js 0.14 via npm (fourni à `PdfExporter` par la page du rapport, plus de fichier dans `public/libs/`) ; seule option à adapter : `grid.borderColor` → `border.color` ; Dependabot (npm chaque semaine, groupes « charts » et « outillage », Actions chaque mois).

**3c — Nettoyage** ✅ _(branche `refactor/phase-3c-cleanup`)_ : `Evt` remplacé par un émetteur en mémoire (B15) ; seuls `data_loaded` et `settings_reloaded` restent, les événements jamais écoutés ou jamais émis sont supprimés et la popup suit les données via `chrome.storage.onChanged` ; code mort supprimé (D6, environ 600 lignes) ; 0 warning ESLint, règles en `error` et `--max-warnings=0` (D13) ; tests en imports explicites (plus de globales, `test/helpers/load.js` supprimé). Plus aucun test `knownBug` : tous les bugs documentés en phase 1 sont corrigés.

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
| 0 Base saine | ½ j | ✅ mergée (#12) | — |
| 1 Tests unitaires | 1,5–2 j | ✅ mergée (#13) | documente B1–B3, B7–B10, B13–B15, B17–B19 |
| 2a Données & auth | 1,5–2 j | ✅ mergée (#14) | B1–B3, B7–B10, B13, B14, B17–B20 |
| 2b Cycle de vie | 1–1,5 j | ✅ mergée (#15) | B4–B6, B11, B12, B16, D2, D11 |
| 3 Modules + WXT | 2–3 j | 3a ✅ (#16), 3b ✅ (#17), 3c ✅ PR à merger | B15, B21–B24, D3–D6, D13 |
| 4 Types + adaptateur | 2–3 j | prochaine | D1, D8–D10, D14 |
| 5 e2e | 2 j | | non-régression de tout le registre |
| 6 CI/CD | ½ j | | D12 |

**Total : 11 à 14 jours.** Les phases 0 → 2 règlent tout ce que voient les utilisateurs ; 3 → 6 rendent le code durable.

## 6. Décisions à prendre

| Sujet | Question | Quand |
|---|---|---|
| B10 | ✅ Décidé le 22/11/2026 : vraie date dans l'export + colonne mois de rattachement ; regroupement et filtres sur le mois de rattachement | — |
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
