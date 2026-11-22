// Tests de bugs connus (registre de docs/AUDIT-MODERNISATION.md).
//
// `knownBug('B7 — attendu : …', fn)` décrit le comportement CORRECT.
// Tant que le bug existe, le test échoue et Vitest le compte comme
// « expected fail » (la suite reste verte). Quand le bug est corrigé, le test
// passe… et Vitest le signale en erreur : il faut alors remplacer
// `knownBug` par `test` et supprimer le test « comportement actuel » associé.
//
// `npm run test:bugs` (ou PECUNIO_SHOW_BUGS=1) exécute ces tests comme des
// tests normaux pour voir leurs vrais messages d'échec, et vérifier qu'ils
// échouent pour la bonne raison.
import { test } from 'vitest';

const showBugs = Boolean(process.env.PECUNIO_SHOW_BUGS) || import.meta.env.MODE === 'bugs';

export const knownBug = showBugs ? test : test.fails;
