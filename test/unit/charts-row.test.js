// Ligne de cartes du bloc des catégories : donut de Bankin et cartes Pecunio.
import { beforeEach, describe, expect, test } from 'vitest';
import { InjectedStyles } from '../../js/ui/InjectedStyles.js';

const BLOCK = '<div class="scrollable categoryChart"><div class="cntr dtb h100 active"><div class="dtc vam">donut</div></div></div>';

describe('InjectedStyles.prepareChartsRow', () => {
    beforeEach(() => {
        document.body.innerHTML = BLOCK;
    });

    test('donut de Bankin dans une carte « Catégories », dans la ligne', () => {
        const block = document.querySelector('.categoryChart');
        const row = InjectedStyles.prepareChartsRow(block);
        const donut = row.querySelector(':scope > .pecunio-donut-wrapper');
        expect(donut.textContent).toContain('Catégories');
        expect(donut.querySelector('.cntr.dtb')).not.toBeNull();
        expect(row.classList.contains('pecunio-charts-row--detail')).toBe(false);
        // Page Catégories : donut et types de dépenses en un seul bloc
        expect(row.classList.contains('pecunio-charts-row--merged')).toBe(true);
    });

    test('page de détail : modificateur posé, puis retiré au retour sur la page Catégories', () => {
        const block = document.querySelector('.categoryChart');
        const row = InjectedStyles.prepareChartsRow(block, { detail: true });
        expect(row.classList.contains('pecunio-charts-row--detail')).toBe(true);
        expect(row.classList.contains('pecunio-charts-row--merged')).toBe(false);
        expect(InjectedStyles.prepareChartsRow(block)).toBe(row);
        expect(row.classList.contains('pecunio-charts-row--detail')).toBe(false);
        expect(block.querySelectorAll('.pecunio-donut-wrapper')).toHaveLength(1);
    });

    test('les cartes Pecunio présentes ne sont pas rangées dans la carte du donut', () => {
        const block = document.querySelector('.categoryChart');
        const pace = document.createElement('div');
        pace.className = 'pecunio-section pecunio-pace-wrapper';
        block.appendChild(pace);
        InjectedStyles.prepareChartsRow(block);
        expect(pace.parentElement).toBe(block);
    });
});
