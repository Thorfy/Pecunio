# Audit & plan de modernisation — Pecunio

_Audit du 22/11/2026 sur `HEAD` = `4fabb8c` (v0.5.3), arbre de travail propre._
_Le travail non commité précédent est conservé dans `stash@{0}` (CacheStore, DateRange, Onboarding, SettingsPanel…)._

## 1. État des lieux

| Aspect | Constat |
|---|---|
| Taille | ~6 300 lignes JS maison, 26 fichiers, + 1,2 Mo de libs copiées dans `libs/` |
| Architecture | Classes globales sans modules. L'ordre de chargement est défini 3 fois à la main (`manifest.json`, `popup.html`, `report.html`). Instances globales (`evt`, `settingClass`, `dataManager`) utilisées implicitement depuis les classes |
| Stockage | `Settings` mélange préférences utilisateur **et** cache API (`cache_data_*` : toutes les transactions). Chaque `setSettings` relit tout le stockage, transactions comprises |
| Dépendances | Chart.js **3.7.1** (2022 ; v4 actuelle), sankey 0.12, adapter date-fns 2.0, choices 11, html2pdf (900 Ko), sans gestionnaire de paquets |
| Outillage | Aucun : pas de `package.json`, lint, formatage, typage, `.gitignore`, `.gitattributes` (`core.autocrlf=true` → warnings LF/CRLF) |
| Tests | Aucun test automatisé. `docs/TESTING.md` = scénarios manuels à coller dans la console |
| CI/CD | Sur tag `v*` : zip de **tout le dépôt** (docs, .github, .vscode) et publication **directe** sur le Chrome Web Store (`--auto-publish`), sans aucune vérification |
| Docs | Bonne base (`ARCHITECTURE.md`, une doc par service) |

Points positifs : Config centralisée, erreurs typées (`AuthenticationError`, `APIError`, `ValidationError`), validation des données API, retry avec backoff, échappement HTML dans le rapport, modèles `Transaction/Account/Category` déjà séparés. Le code se prête bien à un découpage en modules testables.

## 2. Bugs et risques de fiabilité

### 🔴 Élevée — bugs réels

1. **Un seul onglet reçoit l'authentification** — [bg.js:8](../bg.js) garde un unique `portEvent` : le dernier onglet Bankin connecté l'écrase, les autres ne reçoivent jamais les headers → « Auth timeout » au bout de 10 s.
2. **Headers non rejoués et perdus au réveil du service worker** — les headers ne sont envoyés qu'au moment d'une requête `/v2/accounts`. Si le content script se connecte après (cas fréquent), ou si le SW MV3 a été tué (après ~30 s d'inactivité, mémoire perdue), il attend jusqu'au timeout.
3. **Doublons de transactions possibles à la pagination** — `DataManager._fetchPaginatedData` appelle la page suivante *dans* son `try`. Si la page N échoue après ses retries, le `catch` de la page N‑1 la retélécharge et réinsère ses ressources → transactions comptées deux fois. Les 4xx (hors 401/403) sont aussi retentées.
4. **Fuites d'écouteurs à chaque navigation** — chaque `build()` :
   - ajoute un listener `click` sur `.refreshIcon` ([LineBarChart.js:23](../js/charts/LineBarChart.js)) → après N passages, un clic = N rechargements API ;
   - ajoute un `chrome.storage.onChanged` par `BudgetChart` ([BudgetChart.js:155](../js/charts/BudgetChart.js)), jamais retiré ;
   - recrée des `Chart` sans toujours détruire les précédents.
5. **`build()` non ré-entrant** — déclenché par le polling d'URL (1 s), `data_loaded`, `pecunio_chart_type_changed` et le sélecteur de mois, sans verrou → constructions concurrentes, graphiques dupliqués.
6. **Export CSV corrompu** — [DataMerger.js:253](../js/services/DataMerger.js) :
   - `encodeURI` n'encode pas `#` → fichier **tronqué** à la première description qui en contient un ;
   - guillemets non échappés → colonnes décalées ;
   - pas de neutralisation des formules (`=`, `+`, `-`, `@`) pour Excel ;
   - nom de fichier via `toLocaleDateString()` → contient des `/`.
7. **Crash de l'export si un compte n'existe plus** — `account.getDisplayName()` sur le fallback `{}` ([DataMerger.js:200](../js/services/DataMerger.js)) → `TypeError`. Comme le `try/catch` de la popup entoure un `chrome.storage.local.get(…, callback)`, l'erreur **n'est pas interceptée** : aucun message à l'utilisateur, le clic ne fait rien.
8. **Dates décalées par les conversions UTC/local** (France = UTC+1) :
   - rapport PDF : `new Date(year, month, 0).toISOString()` donne la veille → fin de mois = 30 mars au lieu du 31, fin d'année = 30 décembre ;
   - `DataManager.filterTransactions` compare minuit local à minuit UTC → les transactions du **jour de début** sont exclues ;
   - export CSV : `getAdjustedDate().toISOString()` ;
   - `Config.toDateInputValue` (`toISOString`) → date du jour fausse entre minuit et 1 h (2 h en été).
9. **À confirmer — dates ramenées au 1er du mois** : `Transaction.fromRaw` met `current_month` à `0` par défaut, et `getAdjustedDate` fait alors toujours `setDate(1)`. Conséquences : la colonne Date du CSV vaut le 1er du mois pour **toutes** les transactions, et les bornes de dates en jours fonctionnent en réalité au mois. Si c'est voulu pour les graphiques, l'export devrait garder la vraie date.

### 🟠 Moyenne

10. **Popup ouverte de force à chaque page Bankin** — [injected.js:11](../injected.js) envoie `openPopup` à chaque chargement → échec sans geste utilisateur, et badge « ! » permanent.
11. **`Settings` sert aussi de cache** : chaque sauvegarde de cache relit l'ensemble du stockage, déclenche `settings_reloaded` et `settings_updated`. `refreshData` supprime 6 clés une par une (6 événements). `clearAllSettings` fait `chrome.storage.local.clear()` et efface **tout**.
12. **Filtrage des transactions écrit 3 fois** (`DataManager.filterTransactions` — jamais appelé —, `DataMerger._filterTransactions`, `BaseChartData.applySettingOnData`) avec des règles différentes : l'export n'exclut pas `EXCEPTION_IDS` ; `DataMerger` ignore la date si une seule borne est fournie.
13. **`Evt` « collant »** : un événement déjà émis rappelle aussitôt tout nouveau listener ; `removeListener` ne retire pas le listener DOM. Les événements passent par `document`, donc la page Bankin peut les voir et les déclencher.
14. **Rejets de promesse non gérés** : `DataManager.initializationPromise` (timeout, port déconnecté) n'a pas de `catch` et l'utilisateur ne voit aucun retour.
15. **Couplage fort au DOM Bankin** : classes CSS utilitaires (`.dbl.fs14.fw7.lh18.elp`, `.dtc.vam.tar.w30`…), comparaison exacte `location.href === ".../accounts"` (échoue avec un query-string ou un hash), IDs de catégories en dur (`326, 282, 2, 163`).
16. **Logs volumineux et sensibles** : 134 `console.*`. `DataMerger` logue chaque transaction filtrée (des milliers de lignes par export) et les transactions brutes invalides (données bancaires dans la console).

### 🟡 Basse / hygiène

17. `bg.js` : `onMessage` renvoie toujours `true` ; `REQUIRED_HEADERS` dupliqué avec `Config`.
18. Wrappers callback → Promise sur `chrome.storage` inutiles (MV3 renvoie déjà des promesses) ; popup encore en callbacks.
19. Code mort / legacy : `getAllSetting()`, `mergeTransactionByCategoryLegacy`, `DataManager.filterTransactions`, `organizeTransactionsByCategory` en O(n × catégories²).
20. `Math.min(...dates)` sur des milliers d'éléments (risque de dépassement de pile sur un gros historique).
21. Données bancaires complètes en `storage.local` (+ `unlimitedStorage`), jamais purgées → à mentionner dans la politique de confidentialité.
22. Description du manifest : « Pecunio overload Bankin website ».

## 3. Cible technique recommandée

| Sujet | Recommandation | Pourquoi |
|---|---|---|
| Framework d'extension | **[WXT](https://wxt.dev)** (Vite) | Manifest généré, entrypoints background / content / popup / report, HMR, zip propre, `fake-browser` pour les tests |
| Langage | TypeScript **progressif** (`// @ts-check` + JSDoc existant, puis `.ts` module par module) | Le JSDoc est déjà présent ; typer l'API Bankin attrape beaucoup de bugs |
| Dépendances | npm : `chart.js@4`, `chartjs-chart-sankey`, `chartjs-adapter-date-fns`, `choices.js`, `html2pdf.js` | Versions tracées, mises à jour automatisées |
| Qualité | ESLint (flat config) + Prettier + `.editorconfig` + `.gitattributes` (`* text=auto eol=lf`) | Style homogène, fin des warnings CRLF |
| Tests unitaires | **Vitest** + happy-dom + `@webext-core/fake-browser` | Rapide, même config que Vite |
| Tests d'intégration | **Playwright** avec l'extension chargée (`--load-extension`), `sync.bankin.com` et `app2.bankin.com` servis depuis des fixtures anonymisées via `context.route` | Teste le vrai parcours sans compte Bankin |
| CI | PR : lint + typecheck + tests + build. Publication sur tag **seulement si tout est vert**, zip issu du build | Un tag ne peut plus publier une version cassée |

> Alternative plus légère : Vite ou esbuild seul, qui bundle les 3 entrées avec un manifest écrit à la main. Moins de magie, mais il faut refaire ce que WXT fournit.

## 4. Plan par phases

Chaque phase = une PR ; l'extension reste publiable à la fin de chacune.

### Phase 0 — Base saine (½ j)
- `.gitignore`, `.gitattributes`, `.editorconfig` ; normalisation LF dans un commit dédié.
- `package.json` minimal, ESLint + Prettier (en warnings, sans reformatage massif mélangé au fonctionnel).
- CI : job `lint` sur PR ; le zip de publication ne contient plus que l'extension ; **retrait de `--auto-publish`** en attendant les tests.

### Phase 1 — Filet de tests sur la logique pure (1–2 j)
Sans changer l'architecture : un helper Vitest charge les classes globales dans l'ordre du manifest. Tests sur :
- `Transaction/Account/Category.fromRaw`, `DataValidators` ;
- `DataMerger` (merge, filtres, CSV, stats) ;
- `BaseChartData` (`applySettingOnData`, `applySettingOnDataByMonth`, `mergeTransactionByCategory`, médiane/moyenne) et calculs de `BudgetChart` ;
- `ReportFilters`, `ReportChartDataBuilder` ;
- `DataManager._fetchPaginatedData` avec `fetch` simulé (pagination, retry, 401).

Tests lancés sous plusieurs fuseaux (`TZ=Europe/Paris`, `TZ=America/New_York`, `TZ=UTC`). Fixtures : réponses API Bankin anonymisées, avec pagination.
**On écrit d'abord les tests qui reproduisent les bugs 3, 6, 7, 8, 9 et 12, puis on corrige.**

### Phase 2 — Fiabilité (2 j)
- `bg.js` : `Map<tabId, port>`, headers dans `chrome.storage.session`, rejoués à la connexion.
- Pagination itérative avec retry par page, sans retry sur les 4xx.
- Séparer `CacheStore` (données API) de `Settings` (préférences) ; suppression ciblée des clés au lieu de `storage.local.clear()`.
- Un seul module `DateRange` (dates `YYYY-MM-DD` en heure locale partout) et un seul `TransactionFilter` partagé par graphiques, export et rapport.
- `build()` sérialisé ; un seul détecteur de navigation à la place du polling ; `destroy()` sur chaque graphique (Chart.js + listeners via `AbortController`).
- CSV via `Blob` + échappement RFC 4180 + neutralisation des formules ; correction du compte manquant ; popup en `async/await` avec erreurs affichées.
- Suppression de l'`openPopup` automatique ; bandeau d'erreur visible (auth expirée, API KO) ; logger avec niveaux, silencieux en production.

> `stash@{0}` contient déjà une partie de ce travail (`CacheStore`, `DateRange`, ports multi-onglets avec rejeu des headers ; mais pas `storage.session`). On peut y reprendre des morceaux, **cette fois couverts par les tests de la phase 1**.

### Phase 3 — Modules + build (2–3 j)
- Migration vers WXT : `entrypoints/background`, `content`, `popup/`, `report/`.
- `export`/`import` classe par classe ; dépendances injectées à la place des globales.
- Libs via npm, **Chart.js 3 → 4**, suppression de `libs/`.
- `Evt` remplacé par un petit émetteur en mémoire ; suppression du code mort.

### Phase 4 — TypeScript & isolation du DOM Bankin (2 j, progressif)
- Types de l'API Bankin et schéma unique des réglages (valeurs par défaut + numéro de version pour migrer le stockage).
- Tous les accès au DOM Bankin dans **un seul adaptateur** (`BankinPage`) : sélecteurs, détection de page par `pathname`, lecture du mois actif. Des tests de « contrat » sur des snapshots HTML détectent la casse au prochain changement d'interface de Bankin.

### Phase 5 — Tests d'intégration / e2e (2 j)
- Tests de composants (Vitest + happy-dom) : popup (comptes, dates, export), AmountHider, ReviewPrompt.
- Playwright avec l'extension chargée :
  1. page Comptes (snapshot) → auth → graphiques LineBar + Budget affichés ;
  2. page Catégories → ExpenseType + Sankey ;
  3. deux onglets Bankin ouverts → les deux affichent leurs graphiques (bug 1) ;
  4. 5 navigations aller-retour → un seul jeu de graphiques, un seul appel API au clic refresh (bug 4) ;
  5. popup → changement de dates → mise à jour de l'onglet ;
  6. export CSV (contenu vérifié) et génération du rapport.
- ⚠️ POC à faire en début de phase : vérifier que `webRequest.onBeforeSendHeaders` voit les requêtes interceptées par Playwright. Sinon, le test injecte directement les headers dans `storage.session`.

### Phase 6 — CI/CD & release (½ j)
- PR : lint → typecheck → tests unitaires (+ seuil de couverture sur la logique) → build → e2e.
- Tag : build → zip → upload sur le store (publication manuelle ou déploiement progressif), changelog, version unique (`package.json` → manifest).
- Dependabot/Renovate ; `actions/setup-node@v3` → v4.

## 5. Effort indicatif

| Phase | Effort | Gain |
|---|---|---|
| 0 Base | ½ j | Historique propre, CI minimale |
| 1 Tests logique | 1–2 j | Filet avant tout refactor |
| 2 Fiabilité | 2 j | Corrige les bugs visibles par les utilisateurs |
| 3 Modules + WXT | 2–3 j | Développement moderne, dépendances à jour |
| 4 TS + adaptateur DOM | 2 j | Résistance aux changements de Bankin |
| 5 Intégration/e2e | 2 j | Non-régression de bout en bout |
| 6 CI/CD | ½ j | Plus de release cassée |

**Total : 10 à 12 jours.** Les phases 0 à 2 apportent l'essentiel de la fiabilité sans changer d'architecture ; les phases 3 à 6 sont la modernisation proprement dite.
