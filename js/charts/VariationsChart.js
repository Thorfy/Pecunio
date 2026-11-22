import { DateRange } from '../core/DateRange.js';
import { InjectedStyles } from '../ui/InjectedStyles.js';
import { THEME } from '../ui/theme.js';
import { ColorParser } from '../utils/ColorParser.js';
import { formatEuros } from '../utils/format.js';
import { BaseChartData } from './base/BaseChartData.js';
import { buildVariations, roundHalfAway } from './variations.js';

/**
 * Plus fortes variations (page Catégories, G5, lot UX-3b) : les catégories
 * dont la dépense du mois s'écarte le plus de l'habitude.
 */
export class VariationsChart extends BaseChartData {
    /**
     * @param {object[]} transactions
     * @param {object[]} categories
     * @param {string[]} monthParams mois affiché par Bankin (« octobre », « 2026 »)
     * @param {object} [settingsInstance]
     */
    constructor(transactions, categories, monthParams, settingsInstance = null) {
        super(transactions, categories, null, null, settingsInstance);
        this.monthParams = monthParams;
        this.variations = null;
        /** Date du jour (remplaçable dans les tests). */
        this.now = () => new Date();
    }

    prepareData() {
        const month = DateRange.monthIndexFromLabel(this.monthParams?.[0]);
        const year = parseInt(String(this.monthParams?.[1]), 10);
        if (month == null || Number.isNaN(year)) return null;
        this.variations = buildVariations({
            categories: this.categories || [],
            transactions: this.transactions || [],
            month: { year, month },
            today: this.now(),
        });
        return this.variations;
    }

    /** Sous-titre : base de comparaison. */
    static subtitle(day) {
        return day == null
            ? 'Dépenses du mois face à la médiane des 12 mois précédents'
            : `Au ${day}, face à la médiane des 12 mois précédents au même jour`;
    }

    /** « +45 % », « -30 % », « nouveau » (sans habitude). */
    static percent(variation) {
        if (variation.pct == null) return 'nouveau';
        const value = roundHalfAway(variation.pct * 100);
        return `${value > 0 ? '+' : ''}${value} %`;
    }

    /**
     * Ligne d'une catégorie : écart, part et détail (montants masqués : la part seule).
     * @param {import('./variations.js').Variation} variation
     * @param {boolean} hideAmounts
     */
    static describe(variation, hideAmounts) {
        const sign = variation.diff > 0 ? '+' : '-';
        const pct = VariationsChart.percent(variation);
        if (hideAmounts) return { value: pct, detail: '' };
        return {
            value: `${sign}${formatEuros(Math.abs(variation.diff))} (${pct})`,
            detail: `${formatEuros(variation.current)} contre ${formatEuros(variation.usual)} d'habitude`,
        };
    }

    /** Couleur de Bankin de la catégorie (violet de Pecunio à défaut). */
    static color(id) {
        const color = ColorParser.parseColorCSS(`categoryColor_${id}`);
        return color && !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(color) ? color : THEME.accent;
    }

    /**
     * Crée la carte.
     * @param {HTMLElement} container
     */
    async render(container) {
        const variations = this.prepareData();
        if (!variations) return null;

        const wrapper = document.createElement('div');
        wrapper.className = 'pecunio-section pecunio-variations-wrapper';
        wrapper.appendChild(InjectedStyles.createTitle('Plus fortes variations'));
        const subtitle = document.createElement('p');
        subtitle.className = 'pecunio-budget-summary';
        subtitle.textContent = VariationsChart.subtitle(variations.day);
        wrapper.appendChild(subtitle);

        if (variations.items.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'pecunio-variations-empty';
            empty.textContent = 'Rien d\'inhabituel : chaque catégorie est proche de son habitude.';
            wrapper.appendChild(empty);
        } else {
            const list = document.createElement('ul');
            list.className = 'pecunio-variations';
            for (const variation of variations.items) {
                const item = document.createElement('li');
                item.className = variation.diff > 0 ? 'pecunio-variation-up' : 'pecunio-variation-down';
                const dot = document.createElement('span');
                dot.className = 'pecunio-variation-dot';
                dot.style.background = VariationsChart.color(variation.id);
                const name = document.createElement('span');
                name.className = 'pecunio-variation-name';
                name.textContent = variation.name;
                const amount = document.createElement('span');
                amount.className = 'pecunio-variation-value';
                BaseChartData.bindAmountText(amount, (hide) => VariationsChart.describe(variation, hide).value);
                // Détail en montants : vide (et sans hauteur) quand ils sont masqués
                const small = document.createElement('span');
                small.className = 'pecunio-variation-detail';
                BaseChartData.bindAmountText(small, (hide) => VariationsChart.describe(variation, hide).detail);
                item.append(dot, name, amount, small);
                list.appendChild(item);
            }
            wrapper.appendChild(list);
        }
        container.appendChild(wrapper);
        return wrapper;
    }

    /** Pas de graphique Chart.js à détruire.
     * @override
     */
    destroy() {}
}
