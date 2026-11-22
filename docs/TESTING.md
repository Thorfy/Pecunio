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
| `test/helpers/load.js` | `loadContentScripts()` importe tous les modules de `js/` et expose leurs exports sur `globalThis` (transition) ; `loadScripts([...])` pour un sous-ensemble |
| `test/helpers/fake-chrome.js` | `chrome.storage` (callback et promesse), `runtime` (ports, messages), `webRequest`, `tabs`, `action` |
| `test/helpers/known-bug.js` | `knownBug(...)` pour les bugs du registre |
| `test/helpers/timezone.js` | `EAST_OF_UTC`, `WEST_OF_UTC`, `NOT_UTC` pour les tests dépendant du fuseau |
| `test/fixtures/bankin.js` | Données **synthétiques** au format de l'API Bankin (`tx()`, `CATEGORIES`, `ACCOUNTS`, `apiPage()`…) |
| `test/unit/*.test.js` | Tests, un fichier par domaine |

### Écrire un test

```js
import { beforeAll, expect, test } from 'vitest';
import { tx } from '../fixtures/bankin.js';
import { loadContentScripts } from '../helpers/load.js';

beforeAll(loadContentScripts); // Transaction, DataMerger, etc. deviennent globaux
// (ou, pour un nouveau test : import { Transaction } from '../../js/models/Transaction.js';)

test('une dépense est négative', () => {
    expect(Transaction.fromRaw(tx({ amount: -12 })).isExpense()).toBe(true);
});
```

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

## Recette manuelle dans Chrome

Avant de merger une phase qui touche au comportement, suivre la recette du §7 de [AUDIT-MODERNISATION.md](AUDIT-MODERNISATION.md) avec l'extension non empaquetée (`chrome://extensions` → recharger l'extension **et** l'onglet Bankin).

## Tests d'intégration

Prévus en phase 5 (Playwright avec l'extension chargée et Bankin simulé).
