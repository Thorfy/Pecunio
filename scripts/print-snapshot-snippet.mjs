// Affiche un extrait à coller dans la console de la page Bankin : il capture la
// page de façon anonymisée et copie le résultat dans le presse-papiers.
// Usage : npm run snapshot:snippet  (voir docs/TESTING.md)
import { BANKIN_SELECTORS } from '../js/bankin/BankinPage.js';
import { anonymizedSnapshot } from './bankin-snapshot.js';

const selectors = Object.values(BANKIN_SELECTORS);
const options = { keepText: [BANKIN_SELECTORS.ACTIVE_MONTH] };

console.log(
    `copy((${anonymizedSnapshot.toString()})(document, ${JSON.stringify(selectors)}, ${JSON.stringify(options)}));\n` +
        `console.log('Capture anonymisée copiée dans le presse-papiers.');`,
);
