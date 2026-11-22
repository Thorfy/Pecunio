// Capture anonymisée des pages Bankin (scripts/bankin-snapshot.js) : aucune
// donnée personnelle ne doit survivre à l'anonymisation.
import { describe, expect, test } from 'vitest';
import { BANKIN_SELECTORS } from '../../js/bankin/BankinPage.js';
import { anonymizedSnapshot } from '../../scripts/bankin-snapshot.js';

const capture = (html, options = { keepText: [BANKIN_SELECTORS.ACTIVE_MONTH] }) => {
    document.body.innerHTML = html;
    return anonymizedSnapshot(document, Object.values(BANKIN_SELECTORS), options);
};

describe('Capture anonymisée des pages Bankin', () => {
    test('textes neutralisés : noms, montants, dates, numéros', () => {
        const html = capture(`
            <div class="rightColumn"><div>
                <span class="dbl fs1 elp">Livret A - M Dupont Jean</span>
                <span class="dbl fs14 fw7 lh18 elp">12 345,67 €</span>
                <span class="amountRed">-1 234,56 €</span>
                <span class="amountGreen">05/09/2025</span>
                <span class="amountBlack">FR76 3000 4000 0312 3456 7890 143</span>
            </div></div>`);
        expect(html).not.toMatch(/Dupont|Jean|Livret|12 345|1 234|2025|FR76|3456/);
        expect(html).toContain('<span class="dbl fs14 fw7 lh18 elp">0,00 €</span>');
        expect(html).toContain('<span class="amountRed">-0,00 €</span>');
        expect(html).toContain('<span class="amountGreen">00/00/0000</span>');
        expect(html).toContain('<span class="dbl fs1 elp">Texte</span>');
        expect(html).toContain('<span class="amountBlack">FR00 0000 0000 0000 0000 0000 000</span>');
    });

    test('seuls id et class sont gardés, sans longues suites de chiffres', () => {
        const html = capture(
            '<div class="homeBlock" data-user="jean@example.com" title="Compte 123456" style="color:red"><a href="/accounts/987654" id="account-987654" class="row-123456 w30">x</a></div>',
        );
        expect(html).not.toMatch(/jean@|title=|style=|href=|987654|123456/);
        expect(html).toContain('id="account-000000"');
        expect(html).toContain('class="row-000000 w30"');
    });

    test('le mois affiché est gardé, pas les autres textes du sélecteur de mois', () => {
        const html = capture(
            '<div id="monthSelector"><div class="active"><span class="dib">Septembre 2026</span></div><div><span class="dib">Août 2026</span></div></div>',
        );
        expect(html).toContain('<span class="dib">Septembre 2026</span>');
        expect(html).toContain('<span class="dib">Texte</span>');
    });

    test('éléments sans rapport avec Pecunio retirés ; scripts, images et commentaires supprimés', () => {
        const html = capture(`
            <nav><a>Mon profil : Jean Dupont</a></nav>
            <script>window.token = "secret"</script>
            <!-- commentaire -->
            <div class="homeBlock"><img src="https://bankin.com/avatar/42.png"></div>`);
        expect(html).toBe('<div class="homeBlock"></div>');
    });

    test('ajouts de Pecunio retirés, donut de Bankin remis à sa place', () => {
        const html = capture(`
            <div class="scrollable categoryChart">
                <div class="pecunio-charts-row">
                    <div class="pecunio-donut-wrapper">
                        <h3 class="pecunio-title">Catégories</h3>
                        <div id="donutChart"><svg><text>1 234 €</text></svg></div>
                        <div class="mt2 tac"><span class="fs2 fw7">1 234 €</span></div>
                    </div>
                    <div class="pecunio-sankey-wrapper"><canvas></canvas></div>
                </div>
            </div>
            <img id="hideButton" class="pecunio-hide-button">`);
        expect(html).not.toMatch(/pecunio|hideButton|canvas|1 234/);
        document.body.innerHTML = html;
        const chart = document.querySelector('.categoryChart');
        expect(chart.querySelector(':scope > #donutChart text').textContent).toBe('0,00 €');
        expect(chart.querySelector(':scope > .mt2.tac span.fs2.fw7')).not.toBeNull();
    });

    test("chaque partie d'une liste de sélecteurs a ses propres correspondances", () => {
        const amounts = Array.from({ length: 5 }, () => '<span class="amountGreen">1 €</span>').join('');
        const html = capture(`<div>${amounts}</div><div class="categoryChart"><div id="donutChart"><svg><text>2 €</text></svg></div></div>`);
        expect(html).toContain('<text>0,00 €</text>');
    });

    test('nombre de correspondances et profondeur limités', () => {
        const rows = Array.from({ length: 10 }, (_, i) => `<div class="cntr dtb h100 active"><div><div><div><div>${i}</div></div></div></div></div>`).join('');
        const html = capture(`<div>${rows}</div>`, { maxMatches: 2, maxDepth: 2 });
        document.body.innerHTML = html;
        expect(document.querySelectorAll('.cntr')).toHaveLength(2);
        expect(document.querySelector('.cntr > div > div > div')).toBeNull();
    });
});
