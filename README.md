# Pecunio

![pecunio](https://github.com/Thorfy/Pecunio/assets/19363319/1df62f2c-aa19-496b-b445-7ce038870ee3)

**Pecunio** est une extension Chrome qui enrichit votre expérience Bankin avec des visualisations interactives et des outils pour mieux comprendre vos finances.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-blue?logo=google-chrome)](https://chromewebstore.google.com/detail/pecunio/jeomdpldhaigmdbjobamliaipijhmiie?github)

## ✨ Fonctionnalités

### 📊 Visualisations avancées

- **Graphiques temporels** : Suivez l'évolution de vos dépenses par catégorie sur plusieurs mois
- **Comparaison budgétaire** : Comparez vos dépenses entre différentes périodes avec médiane et moyenne
- **Diagramme de flux** : Visualisez le flux de vos dépenses de manière intuitive
- **Répartition par type** : Découvrez la répartition de vos dépenses (Essentiel, Plaisir, Épargne, Autre)

### 🎯 Outils pratiques

- **Filtrage avancé** : Sélectionnez des périodes, comptes et catégories spécifiques
- **Masquage des montants** : Protégez votre vie privée en masquant les montants sensibles
- **Export de données** : Exportez vos données pour analyse approfondie

## 🔒 Données et vie privée

- Pecunio lit vos données avec la session Bankin de votre navigateur ; rien n'est envoyé ailleurs que vers Bankin.
- Les transactions, catégories et comptes sont gardés en cache sur votre ordinateur (`chrome.storage.local`) pour afficher les graphiques plus vite.
- **Dès que Bankin affiche sa page de connexion** (déconnexion ou session expirée), Pecunio efface ce cache, les données du dernier rapport PDF et les en-têtes d'authentification. Seules vos préférences (période, comptes, catégories masquées, masquage des montants) sont conservées.
- Les boutons « Réinitialiser » de la popup effacent à la demande les données ou les préférences.

## 📸 Aperçu

<img width="387" height="594" alt="Capture d'écran 2025-09-05 121114" src="https://github.com/user-attachments/assets/f3c17660-2444-4fdb-9683-a892239f5216" />
<img width="387" height="600" alt="Capture d'écran 2025-09-05 121152" src="https://github.com/user-attachments/assets/bc0d9ca8-ddba-4fdb-965a-ab42016dea87" />
<img width="1914" height="741" alt="Capture d'écran 2025-09-05 122412" src="https://github.com/user-attachments/assets/755d77b5-5717-42f5-ae61-9a1997b91015" />
<img width="2009" height="1251" alt="image" src="https://github.com/user-attachments/assets/b64ec9c1-fb90-4e9a-a3e1-413ccd9bd3e3" />
<img width="1910" height="1005" alt="Capture d'écran 2025-09-05 122555" src="https://github.com/user-attachments/assets/5978b81b-8bcb-4337-8680-49db9eb3da7f" />
<img width="1903" height="728" alt="Capture d'écran 2025-09-05 122715" src="https://github.com/user-attachments/assets/71d092d0-1685-4851-98bd-756e7d1491ca" />

## 🚀 Installation

1. Installez l'extension depuis le [Chrome Web Store](https://chromewebstore.google.com/detail/pecunio/jeomdpldhaigmdbjobamliaipijhmiie?github)
2. Connectez-vous à votre compte Bankin
3. (Recommandé) **Épinglez Pecunio** à la barre d'outils pour y accéder rapidement
4. Les graphiques apparaissent automatiquement sur vos pages de comptes et catégories

## 💡 Comment ça marche ?

Pecunio s'intègre directement dans l'interface Bankin. Une fois installé, vous verrez automatiquement :

- Sur la **page des comptes** : Graphiques temporels et comparaison budgétaire
- Sur la **page des catégories** : Diagramme de flux et répartition par type de dépenses

Tous les graphiques sont interactifs et se mettent à jour selon vos filtres et sélections.

## 🛠️ Développement

Prérequis : Node.js 22+. L'extension est construite avec [WXT](https://wxt.dev) (Vite).

```bash
npm install         # dépendances et outillage
npm run dev         # build en continu + Chrome de développement avec l'extension chargée
npm run build       # build de production dans .output/chrome-mv3
npm run zip         # zip pour le Chrome Web Store dans .output/
npm run check       # lint + types + tests + build
npm test            # tests unitaires
npm run test:tz     # tests sous 3 fuseaux horaires
npm run test:e2e    # scénarios de bout en bout (Playwright, Bankin simulé)
npm run typecheck   # vérification des types (tsc sur le JSDoc)
npm run lint:fix    # corrections automatiques du lint
```

Organisation :

| Dossier | Contenu |
|---|---|
| `entrypoints/` | points d'entrée WXT : service worker, content script, popup, page du rapport |
| `js/` | code de l'extension en modules ES (cœur, adaptateur Bankin, modèles, graphiques, interface) |
| `public/` | fichiers copiés tels quels (images, html2pdf) |
| `test/` | tests Vitest (unitaires, et contrat avec les pages Bankin) |
| `scripts/` | outillage (tests sous plusieurs fuseaux, capture anonymisée des pages Bankin) |

Le manifest est généré par WXT à partir de `wxt.config.js` et de `entrypoints/` ; la version vient de `package.json`.

Les tests sont décrits dans [docs/TESTING.md](docs/TESTING.md).

Pour tester dans votre Chrome : `npm run build`, puis `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée » → dossier **`.output/chrome-mv3`** (et non plus la racine du dépôt). Après chaque `npm run build`, cliquer sur ↻ dans `chrome://extensions` puis recharger l'onglet Bankin.

La CI (`.github/workflows/ci.yml`) lance le lint, la vérification des types, le build, les tests unitaires (sous Paris, New York et UTC) et les scénarios de bout en bout sur chaque PR. Un tag `vX.Y.Z` (identique à la version de `package.json`) relance tous les contrôles et, s'ils passent, **publie** la version sur le Chrome Web Store (après l'examen de Google) puis la release GitHub. Procédure : [docs/RELEASE.md](docs/RELEASE.md) ; historique : [CHANGELOG.md](CHANGELOG.md).

Le plan de modernisation est décrit dans [docs/AUDIT-MODERNISATION.md](docs/AUDIT-MODERNISATION.md).
