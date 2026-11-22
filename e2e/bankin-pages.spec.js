// Scénarios de bout en bout sur les pages Bankin (extension chargée, Bankin simulé).
// Numéros : plan de modernisation, phase 5 (docs/AUDIT-MODERNISATION.md).
import { bankinUrl, expect, test } from './fixtures.js';

const LINE_CHART = '#originalChartContainer canvas';
const BUDGET_CHART = '#budgetChartBlock canvas';
const EXPENSE_TYPE_CHART = '.pecunio-expense-type-wrapper canvas';
const SANKEY_CHART = '.pecunio-sankey-wrapper canvas';
const TOGGLE = '.pecunio-chart-type-toggle';

/** Nombre d'appels à l'API des transactions reçus par le Bankin simulé. */
const transactionCalls = (bankin) => bankin.apiCalls.filter((call) => call.startsWith('/v2/transactions')).length;

test.describe('Page Comptes', () => {
    test('1 — en-têtes capturés, graphique temporel et comparaison budget affichés', async ({ context, serviceWorker, bankin, consoleErrors }) => {
        const page = await context.newPage();
        await page.goto(bankinUrl('/accounts'));
        await expect(page.locator(LINE_CHART)).toBeVisible();
        await expect(page.locator(BUDGET_CHART)).toBeVisible();

        // Le service worker a capturé les en-têtes de l'appel de Bankin (en session, pas sur disque)
        const stored = await serviceWorker.evaluate(() => chrome.storage.session.get('pecunio_auth_headers'));
        expect(Object.keys(stored.pecunio_auth_headers).sort()).toEqual(['Authorization', 'Bankin-Version', 'Client-Id', 'Client-Secret']);
        expect(transactionCalls(bankin)).toBe(1);
        expect(consoleErrors).toEqual([]);
    });

    test('4 — bouton de type × 2 puis ↻ : un seul rechargement (B4, B5, D10)', async ({ context, bankin, consoleErrors }) => {
        const page = await context.newPage();
        await page.goto(bankinUrl('/accounts'));
        const toggle = page.locator(TOGGLE);
        await expect(toggle).toHaveText('Afficher en courbes');

        await toggle.click();
        await expect(page.locator(TOGGLE)).toHaveText('Afficher en barres');
        // Au clavier : le bouton est un vrai bouton HTML (D10)
        await page.locator(TOGGLE).focus();
        await page.keyboard.press('Enter');
        await expect(page.locator(TOGGLE)).toHaveText('Afficher en courbes');
        await expect(page.locator(TOGGLE)).toHaveCount(1);

        const before = transactionCalls(bankin);
        await page.locator('.refreshIcon').click();
        await expect.poll(() => transactionCalls(bankin)).toBe(before + 1);
        // Laisser passer d'éventuels rechargements en double
        await page.waitForTimeout(2500);
        expect(transactionCalls(bankin)).toBe(before + 1);
        await expect(page.locator(LINE_CHART)).toBeVisible();
        await expect(page.locator(BUDGET_CHART)).toHaveCount(1);
        expect(consoleErrors).toEqual([]);
    });

    test('1b — période, vue détaillée et préréglages du budget (UX-2a)', async ({ context, bankin, consoleErrors }) => {
        const page = await context.newPage();
        await page.goto(bankinUrl('/accounts'));
        await expect(page.locator(LINE_CHART)).toBeVisible();
        const range = (label) => page.locator('.pecunio-range-selector button', { hasText: label });

        // 12 mois par défaut ; « 6 mois » enregistré et graphique redessiné
        await expect(range('12 mois')).toHaveAttribute('aria-pressed', 'true');
        await range('6 mois').click();
        await expect(range('6 mois')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.pecunio-detail-toggle')).toHaveText('Toutes les catégories');
        await page.locator('.pecunio-detail-toggle').click();
        await expect(page.locator('.pecunio-detail-toggle')).toHaveText('Vue simplifiée');
        await expect(range('6 mois')).toHaveAttribute('aria-pressed', 'true');

        // Comparaison du budget : « Mois dernier » par défaut, puis « Cette année »
        const preset = (label) => page.locator('.pecunio-budget-presets button', { hasText: label });
        await expect(preset('Mois dernier')).toHaveAttribute('aria-pressed', 'true');
        await preset('Cette année').click();
        await expect(preset('Cette année')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.pecunio-budget-custom')).toBeHidden();
        await preset('Personnaliser').click();
        await expect(page.locator('.pecunio-budget-custom')).toBeVisible();
        await expect(page.locator(BUDGET_CHART)).toBeVisible();
        expect(consoleErrors).toEqual([]);
    });

    test('9 — masquage des montants : flou appliqué puis retiré', async ({ context, bankin, consoleErrors }) => {
        const page = await context.newPage();
        await page.goto(bankinUrl('/accounts'));
        await expect(page.locator(LINE_CHART)).toBeVisible();
        const header = page.locator('.dbl.fs14.fw7.lh18.elp');
        const amounts = page.locator('.amountGreen');

        // Flou réellement appliqué par le navigateur (règle CSS du masquage)
        await page.locator('#hideButton').click();
        await expect(header).toHaveCSS('filter', /blur/);
        await expect(amounts.first()).toHaveCSS('filter', /blur/);

        await page.locator('#hideButton').click();
        await expect(header).toHaveCSS('filter', 'none');
        await expect(amounts.first()).toHaveCSS('filter', 'none');
        expect(consoleErrors).toEqual([]);
    });

    test('9b — masquage conservé au rechargement et après la mise à jour des montants par Bankin (U1, B25)', async ({ context, bankin, consoleErrors }) => {
        const page = await context.newPage();
        await page.goto(bankinUrl('/accounts'));
        await expect(page.locator(LINE_CHART)).toBeVisible();
        await page.locator('#hideButton').click();
        await expect(page.locator('#hideButton')).toHaveAttribute('src', /eyeClose\.png$/);

        for (let i = 0; i < 2; i++) {
            await page.reload();
            await expect(page.locator(LINE_CHART)).toBeVisible();
            // Après la réécriture des classes par Bankin (1,5 s après le chargement)
            await page.waitForTimeout(2000);
            // Icône, solde et montants dans le même état : masqués
            await expect(page.locator('#hideButton')).toHaveAttribute('src', /eyeClose\.png$/);
            await expect(page.locator('.dbl.fs14.fw7.lh18.elp')).toHaveCSS('filter', /blur/);
            await expect(page.locator('.amountGreen').first()).toHaveCSS('filter', /blur/);
        }
        expect(consoleErrors).toEqual([]);
    });
});

test.describe('Page Catégories', () => {
    test('9c — œil de masquage cliquable au-dessus du donut compact (Catégories, Revenus)', async ({ context, bankin, consoleErrors }) => {
        const page = await context.newPage();
        const html = page.locator('html');
        await page.goto(bankinUrl('/categories'));
        await expect(page.locator('.pecunio-pace-wrapper canvas')).toBeVisible();
        for (const path of ['/categories', '/categories/2']) {
            if (path !== '/categories') {
                await page.evaluate((p) => window.__bankinNavigate(p), path);
                await expect(page.locator('.pecunio-history-wrapper canvas')).toBeVisible();
            }
            await expect(page.locator('#hideButton')).toBeVisible();
            // Vrai clic : échoue si un autre élément (le SVG du donut) recouvre l'œil
            await page.locator('#hideButton').click({ timeout: 3000 });
            await expect(html).toHaveClass(/pecunio-amounts-hidden/);
            await page.locator('#hideButton').click({ timeout: 3000 });
            await expect(html).not.toHaveClass(/pecunio-amounts-hidden/);
        }
        expect(consoleErrors).toEqual([]);
    });

    test('2 — types de dépenses et flux financiers, mis à jour au changement de mois', async ({ context, bankin, consoleErrors }) => {
        const page = await context.newPage();
        await page.goto(bankinUrl('/categories'));
        await expect(page.locator(EXPENSE_TYPE_CHART)).toBeVisible();
        await expect(page.locator(SANKEY_CHART)).toBeVisible();
        // Rythme du mois (lot UX-3a)
        await expect(page.locator('.pecunio-pace-wrapper canvas')).toBeVisible();
        await expect(page.locator('.pecunio-pace-wrapper')).toContainText('Rythme du mois');
        // Juste sous le donut et les types de dépenses, avant les flux financiers
        const paceFirst = await page.evaluate(() => {
            const pace = document.querySelector('.pecunio-pace-wrapper');
            const sankey = document.querySelector('.pecunio-sankey-wrapper');
            return Boolean(pace.compareDocumentPosition(sankey) & Node.DOCUMENT_POSITION_FOLLOWING);
        });
        expect(paceFirst).toBe(true);

        // Changement de mois : les graphiques sont reconstruits (nouveaux canvas)
        await page.locator(SANKEY_CHART).evaluate((canvas) => canvas.setAttribute('data-avant', ''));
        await page.locator('#monthSelector a', { hasText: 'Févr.' }).click();
        await expect(page.locator('#monthSelector .active')).toHaveText('Février 2024');
        await expect(page.locator(`${SANKEY_CHART}:not([data-avant])`)).toBeVisible();
        await expect(page.locator(SANKEY_CHART)).toHaveCount(1);
        await expect(page.locator(EXPENSE_TYPE_CHART)).toHaveCount(1);
        await expect(page.locator('.pecunio-pace-wrapper')).toHaveCount(1);
        expect(consoleErrors).toEqual([]);
    });

    test('3 — onglet Revenus : aucun graphique de dépenses périmé (B6)', async ({ context, bankin, consoleErrors }) => {
        const page = await context.newPage();
        await page.goto(bankinUrl('/categories'));
        await expect(page.locator(SANKEY_CHART)).toBeVisible();

        await page.evaluate(() => window.__bankinNavigate('/categories/2'));
        await expect(page.locator('.pecunio-sankey-wrapper')).toHaveCount(0);
        await expect(page.locator('.pecunio-expense-type-wrapper')).toHaveCount(0);
        await expect(page.locator('.pecunio-pace-wrapper')).toHaveCount(0);
        // Onglet Revenus : historique des revenus sur 12 mois (lot UX-3a)
        await expect(page.locator('.pecunio-history-wrapper canvas')).toBeVisible();
        await expect(page.locator('.pecunio-history-wrapper')).toContainText('Revenus sur 12 mois');
        await expectDonutBesideHistory(page);

        // Autre catégorie : l'historique est remplacé, pas ajouté
        await page.evaluate(() => window.__bankinNavigate('/categories/159'));
        await expect(page.locator('.pecunio-history-wrapper')).toContainText('Logement sur 12 mois');
        await expect(page.locator('.pecunio-history-wrapper')).toHaveCount(1);

        // Retour sur Dépenses : les graphiques reviennent
        await page.evaluate(() => window.__bankinNavigate('/categories'));
        await expect(page.locator(SANKEY_CHART)).toBeVisible();
        await expect(page.locator('.pecunio-history-wrapper')).toHaveCount(0);
        await expect(page.locator('.pecunio-charts-row--detail')).toHaveCount(0);

        // Onglet Revenus ouvert directement : même mise en page
        const direct = await context.newPage();
        await direct.goto(bankinUrl('/categories/2'));
        await expect(direct.locator('.pecunio-history-wrapper canvas')).toBeVisible();
        await expectDonutBesideHistory(direct);
        expect(consoleErrors).toEqual([]);
    });
});

/** Détail d'une catégorie : donut de Bankin dans une carte, à sa taille, l'historique à côté. */
async function expectDonutBesideHistory(page) {
    const donut = page.locator('.pecunio-charts-row--detail > .pecunio-donut-wrapper');
    await expect(donut).toContainText('Catégories');
    await expect(page.locator('.categoryChart .h100')).toHaveCount(0);
    const history = page.locator('.pecunio-charts-row--detail > .pecunio-history-wrapper');
    const [d, h] = [await donut.boundingBox(), await history.boundingBox()];
    expect(Math.abs(d.y - h.y)).toBeLessThan(2);
    expect(h.x).toBeGreaterThanOrEqual(d.x + d.width);
}

test.describe('Plusieurs onglets et connexion', () => {
    test('5 — deux onglets Bankin affichent tous les deux leurs graphiques (B1)', async ({ context, bankin, consoleErrors }) => {
        const accounts = await context.newPage();
        await accounts.goto(bankinUrl('/accounts'));
        const categories = await context.newPage();
        await categories.goto(bankinUrl('/categories'));
        await expect(accounts.locator(LINE_CHART)).toBeVisible();
        await expect(categories.locator(SANKEY_CHART)).toBeVisible();
        expect(consoleErrors).toEqual([]);
    });

    test('6 — page de connexion : rien de chargé, aucune erreur, en-têtes oubliés (B12, D8)', async ({ context, serviceWorker, bankin, consoleErrors }) => {
        const page = await context.newPage();
        await page.goto(bankinUrl('/accounts'));
        await expect(page.locator(LINE_CHART)).toBeVisible();
        const calls = bankin.apiCalls.length;

        await page.goto(bankinUrl('/signin'));
        await expect
            .poll(() => serviceWorker.evaluate(() => chrome.storage.session.get('pecunio_auth_headers')))
            .toEqual({});
        // Au-delà du délai d'authentification (10 s) : aucune erreur, aucun appel à l'API
        await page.waitForTimeout(11_000);
        expect(bankin.apiCalls.length).toBe(calls);
        await expect(page.locator('#pecunio-status-banner')).toHaveCount(0);
        expect(consoleErrors).toEqual([]);
    });
});
