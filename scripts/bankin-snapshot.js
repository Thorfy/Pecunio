/**
 * Capture anonymisée d'une page Bankin, pour les tests de contrat de
 * l'adaptateur BankinPage (test/contract/).
 *
 * La fonction s'exécute DANS la page Bankin (console du navigateur) : la
 * capture est anonymisée avant de quitter le navigateur. On ne garde que :
 * - les éléments ciblés par les sélecteurs de l'adaptateur, leurs ancêtres et
 *   quelques niveaux de descendants ;
 * - les attributs `id` et `class` (sans longues suites de chiffres) ;
 * - des textes neutralisés : « Texte », montants remplacés par « 0,00 € »,
 *   autres chiffres par 0 (« 05/09/2025 » → « 00/00/0000 ») ; seul le mois
 *   affiché est gardé tel quel.
 * Les éléments ajoutés par Pecunio sont retirés et le donut de Bankin, déplacé
 * par Pecunio, est remis à sa place.
 *
 * Mode d'emploi : docs/TESTING.md (« Tests de contrat Bankin »).
 *
 * Autonome (aucun import) : `npm run snapshot:snippet` en fait un extrait à
 * coller dans la console.
 */

/**
 * @param {Document} doc page Bankin
 * @param {string[]} selectors sélecteurs à conserver
 * @param {{ keepText?: string[], maxMatches?: number, maxDepth?: number, maxChildren?: number }} [options]
 *   keepText : sélecteurs dont le texte est gardé s'il a la forme « Mois AAAA »
 * @returns {string} HTML du `body` anonymisé
 */
export function anonymizedSnapshot(doc, selectors, options = {}) {
    const { keepText = [], maxMatches = 3, maxDepth = 3, maxChildren = 4 } = options;
    const ELEMENT = 1;
    const TEXT = 3;
    const root = /** @type {Element} */ (doc.body.cloneNode(true));

    const isPecunio = (el) =>
        /pecunio/i.test(`${el.getAttribute('class') || ''} ${el.id || ''}`) || ['hideButton', 'budgetChartBlock'].includes(el.id);

    // 1. Défaire les changements de Pecunio
    root.querySelectorAll('.pecunio-donut-wrapper').forEach((wrapper) => {
        const row = wrapper.closest('.pecunio-charts-row');
        const anchor = row || wrapper;
        for (const child of Array.from(wrapper.children)) {
            if (!isPecunio(child)) anchor.parentElement.insertBefore(child, anchor);
        }
    });
    root.querySelectorAll('script, style, noscript, iframe, link, template, canvas, img').forEach((el) => el.remove());
    Array.from(root.querySelectorAll('*')).filter(isPecunio).forEach((el) => el.remove());

    // 2. Éléments à garder
    const keep = new Set([root]);
    const keepSubtree = (el, depth) => {
        keep.add(el);
        if (depth >= maxDepth) return;
        Array.from(el.children).slice(0, maxChildren).forEach((child) => keepSubtree(child, depth + 1));
    };
    // Chaque partie d'une liste « a, b » a ses propres correspondances
    const parts = selectors.flatMap((selector) => selector.split(',')).map((part) => part.trim());
    for (const selector of parts) {
        Array.from(root.querySelectorAll(selector)).slice(0, maxMatches).forEach((match) => {
            for (let el = match.parentElement; el && el !== root; el = el.parentElement) keep.add(el);
            keepSubtree(match, 0);
        });
    }
    Array.from(root.querySelectorAll('*'))
        .filter((el) => !keep.has(el))
        .forEach((el) => el.remove());

    // 3. Anonymiser attributs et textes
    const keepTextElements = new Set(keepText.flatMap((selector) => Array.from(root.querySelectorAll(selector))));
    const scrub = (value) => value.replace(/\d{4,}/g, (digits) => '0'.repeat(digits.length));
    const anonymizeText = (text, parent) => {
        const trimmed = text.trim();
        if (!trimmed) return text;
        if (keepTextElements.has(parent) && /^\p{L}+\s+\d{4}$/u.test(trimmed)) return text;
        // Montants : valeur fixe, pour ne pas laisser deviner leur ordre de grandeur
        if (/€/.test(trimmed) && /\d/.test(trimmed)) return `${trimmed.startsWith('-') ? '-' : ''}0,00 €`;
        const letters = (trimmed.match(/\p{L}/gu) || []).length;
        if (/\d/.test(trimmed) && letters <= 3) return text.replace(/\d/g, '0');
        return 'Texte';
    };
    const walk = (node) => {
        for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === ELEMENT) {
                const el = /** @type {Element} */ (child);
                for (const { name } of Array.from(el.attributes)) {
                    if (name !== 'id' && name !== 'class') el.removeAttribute(name);
                }
                if (el.id) el.id = scrub(el.id);
                const className = el.getAttribute('class');
                if (className) el.setAttribute('class', scrub(className));
                walk(el);
            } else if (child.nodeType === TEXT) {
                child.textContent = anonymizeText(child.textContent, node);
            } else {
                child.remove(); // commentaires
            }
        }
    };
    walk(root);

    return root.innerHTML.replace(/\n\s*\n+/g, '\n').trim();
}
