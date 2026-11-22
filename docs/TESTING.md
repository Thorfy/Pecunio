# Tests — Pecunio

## Tests unitaires (Vitest)

```bash
npm test               # toute la suite
npm run test:watch     # relance à chaque modification
npm run test:coverage  # + rapport de couverture (coverage/index.html)
npm run test:tz        # suite sous Europe/Paris, America/New_York et UTC
npm run test:bugs      # exécute les tests de bugs connus comme des tests normaux
```

> Sous Windows avec Git Bash, `TZ=… npx vitest` ne change pas le fuseau (MSYS intercepte la variable) : utiliser `npm run test:tz`.

### Organisation

| Dossier / fichier | Rôle |
|---|---|
| `vitest.config.js` | Environnement happy-dom, seuils de couverture, résolution ESM de Chart.js |
| `test/setup/vitest.setup.js` | Faux `chrome` neuf pour chaque test, console silencieuse (`PECUNIO_TEST_LOGS=1` pour la réafficher) |
| `test/helpers/fake-chrome.js` | `chrome.storage` (callback et promesse), `runtime` (ports, messages), `webRequest`, `tabs`, `action` |
| `test/helpers/known-bug.js` | `knownBug(...)` pour les bugs du registre |
| `test/helpers/timezone.js` | `EAST_OF_UTC`, `WEST_OF_UTC`, `NOT_UTC` pour les tests dépendant du fuseau |
| `test/helpers/page-controller.js` | Fausse fenêtre et fausses classes de graphiques pour `PageController` |
| `test/fixtures/bankin.js` | Données **synthétiques** au format de l'API Bankin (`tx()`, `CATEGORIES`, `ACCOUNTS`, `apiPage()`…) |
| `test/fixtures/bankin-pages/*.html` | Captures **anonymisées** des pages Comptes et Catégories de Bankin |
| `test/unit/*.test.js` | Tests, un fichier par domaine |
| `test/contract/*.test.js` | Tests de contrat : l'adaptateur `BankinPage` sur les captures des vraies pages |

### Écrire un test

```js
import { expect, test } from 'vitest';
import { Transaction } from '../../js/models/Transaction.js';
import { tx } from '../fixtures/bankin.js';

test('fromRaw lit le montant', () => {
    expect(Transaction.fromRaw(tx({ amount: -12 })).amount).toBe(-12);
});
```

- Chaque test importe les modules dont il a besoin (`js/...`) ; ESLint signale tout import manquant.

- **Jamais de données réelles** : utiliser ou étendre `test/fixtures/bankin.js`.
- Le stockage du faux `chrome` est lisible directement : `chrome.storage.local._data`.
- Dates : préférer `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(...)`.

### Bugs connus (`knownBug`)

Chaque bug du registre ([AUDIT-MODERNISATION.md](AUDIT-MODERNISATION.md) §3) testable unitairement a un test qui décrit le **comportement attendu** :

```js
knownBug('B7 — attendu : un « # » ne tronque pas le fichier exporté', () => { ... });
```

- Tant que le bug existe, le test échoue et compte comme « expected fail » : la suite reste verte.
- Quand le bug est corrigé, le test passe et Vitest le signale en erreur : remplacer `knownBug` par `test`, et supprimer le test « comportement actuel » associé s'il existe.
- `npm run test:bugs` montre les vrais messages d'échec, pour vérifier qu'un `knownBug` échoue pour la bonne raison (et pas à cause d'une erreur dans le test).
- Les bugs qui dépendent du fuseau utilisent `(NOT_UTC ? knownBug : test)(...)`.

## Tests de contrat Bankin

Tout ce que Pecunio lit de la page Bankin passe par l'adaptateur `js/bankin/BankinPage.js`. Les tests de `test/contract/` le vérifient sur des captures anonymisées des vraies pages (`test/fixtures/bankin-pages/`) : chaque élément utilisé est présent, le mois affiché est lu, et `PageController` construit ses graphiques.

**Quand Bankin change son interface** (graphiques absents, bouton de masquage disparu…), recapturer les pages :

1. `npm run snapshot:snippet` affiche un extrait de code.
2. Dans Chrome, sur la page Bankin à capturer (Comptes ou Catégories, connecté, extension active), ouvrir la console (F12) et y coller l'extrait : la capture anonymisée est copiée dans le presse-papiers.
3. La coller dans `test/fixtures/bankin-pages/accounts.html` ou `categories.html`, en gardant le commentaire d'en-tête (date de capture).
4. **Relire la capture avant de la commiter** : aucun nom, montant ou numéro ne doit y figurer (les textes deviennent « Texte », les montants « 0,00 € »).
5. `npm test` : les tests de contrat indiquent les éléments introuvables (`missingElements`) ; corriger les sélecteurs dans `BANKIN_SELECTORS`.

L'anonymisation a lieu dans le navigateur, avant la copie ; elle est testée dans `test/unit/bankin-snapshot.test.js`.

## Recette manuelle dans Chrome

Avant de merger une phase qui touche au comportement, suivre la recette du §7 de [AUDIT-MODERNISATION.md](AUDIT-MODERNISATION.md) avec l'extension non empaquetée (`chrome://extensions` → recharger l'extension **et** l'onglet Bankin).

## Tests d'intégration

Prévus en phase 5 (Playwright avec l'extension chargée et Bankin simulé).
