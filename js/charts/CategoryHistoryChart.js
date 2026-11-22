import { BankinPage } from '../bankin/BankinPage.js';
import { Config } from '../core/Config.js';
import { DateRange } from '../core/DateRange.js';
import { Chart } from '../lib/chart.js';
import { InjectedStyles } from '../ui/InjectedStyles.js';
import { THEME } from '../ui/theme.js';
import { ColorParser } from '../utils/ColorParser.js';
import { MONTH_NAMES, formatEuros, formatNumber } from '../utils/format.js';
import { BaseChartData } from './base/BaseChartData.js';
import { deltaText } from './budgetComparison.js';
import { buildCategoryHistory, findCategory } from './categoryHistory.js';

/** Opacités des sous-catégories : nuances de la couleur de la catégorie. */
const SHADES = [1, 0.72, 0.5, 0.36, 0.26];
const OTHERS_COLOR = 'rgb(173, 184, 197)';

/**
 * Historique d'une catégorie sur 12 mois (page de détail d'une catégorie,
 * dont l'onglet Revenus de Bankin), lot UX-3a.
 */
export class CategoryHistoryChart extends BaseChartData {
    /**
     * @param {object[]} transactions
     * @param {object[]} categories
     * @param {{ categoryId: number, monthParams: string[] }} params catégorie et mois affiché (« octobre », « 2026 »)
     * @param {object} [settingsInstance]
     */
    constructor(transactions, categories, { categoryId, monthParams }, settingsInstance = null) {
        super(transactions, categories, null, null, settingsInstance);
        this.categoryId = categoryId;
        this.monthParams = monthParams;
        this.chartInstance = null;
        this.history = null;
        this.now = new Date();
    }

    /** Mois affiché par Bankin : { year, month }, ou null. */
    _month() {
        const month = DateRange.monthIndexFromLabel(this.monthParams?.[0]);
        const year = parseInt(String(this.monthParams?.[1]), 10);
        return month == null || Number.isNaN(year) ? null : { year, month };
    }

    /** Calcule l'historique (null si catégorie ou mois inconnus). */
    prepareData() {
        const category = findCategory(this.categories, this.categoryId);
        const month = this._month();
        if (!category || !month) return null;
        this.category = category;
        this.history = buildCategoryHistory({ category, transactions: this.transactions || [], month });
        return this.history;
    }

    /**
     * Nuance d'une couleur « rgb(r, g, b) » ou « #rrggbb » (autre format : inchangée).
     * @param {string} color
     * @param {number} alpha
     */
    static withAlpha(color, alpha) {
        const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
        if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
        const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
        if (hex) return `rgba(${hex.slice(1).map((h) => parseInt(h, 16)).join(', ')}, ${alpha})`;
        return color;
    }

    /**
     * Comme sur la page Catégories : donut de Bankin dans une carte, l'historique
     * à côté (renvoie la ligne où placer l'historique).
     * @param {Element} categoryBlock
     */
    static prepareContainer(categoryBlock) {
        return InjectedStyles.prepareChartsRow(categoryBlock, { detail: true });
    }

    /** Titre de la carte. */
    static title(category, isIncome) {
        return isIncome ? 'Revenus sur 12 mois' : `${category.name} sur 12 mois`;
    }

    /**
     * Phrase de synthèse : mois affiché face à la médiane des 12 mois précédents.
     * @param {ReturnType<typeof buildCategoryHistory>} history
     * @param {string} monthLabel
     * @param {boolean} hideAmounts
     * @param {boolean} [inProgress] mois en cours : pas d'écart avec un mois complet
     */
    static summary(history, monthLabel, hideAmounts, inProgress = false) {
        const current = history.totals.at(-1);
        const verb = history.isIncome ? 'reçus' : 'dépensés';
        if (inProgress) {
            const label = `${monthLabel} (en cours)`;
            if (hideAmounts) return label;
            const base = `${label} : ${formatEuros(current)} ${verb} à ce jour`;
            return history.median > 0 ? `${base} ; médiane des 12 mois précédents : ${formatEuros(history.median)}` : base;
        }
        const delta = history.median > 0 ? deltaText((current - history.median) / history.median) : null;
        if (hideAmounts) return delta ? `${monthLabel} face à la médiane des 12 mois précédents : ${delta}` : monthLabel;
        const base = `${monthLabel} : ${formatEuros(current)} ${verb}`;
        return delta
            ? `${base}, contre ${formatEuros(history.median)} habituellement (médiane des 12 mois précédents), ${delta}`
            : base;
    }

    /**
     * Crée la carte et le graphique dans le bloc de la catégorie.
     * @param {HTMLElement} container
     */
    async render(container) {
        const history = this.prepareData();
        if (!history) return null;
        const month = this._month();
        const monthLabel = `${MONTH_NAMES[month.month]} ${month.year}`;

        const wrapper = document.createElement('div');
        wrapper.className = 'pecunio-section pecunio-history-wrapper';
        wrapper.appendChild(InjectedStyles.createTitle(CategoryHistoryChart.title(this.category, history.isIncome)));
        const summary = document.createElement('p');
        summary.className = 'pecunio-budget-summary';
        const inProgress = month.year === this.now.getFullYear() && month.month === this.now.getMonth() + 1;
        BaseChartData.bindAmountText(summary, (hide) => CategoryHistoryChart.summary(history, monthLabel, hide, inProgress));
        wrapper.appendChild(summary);
        const canvasContainer = InjectedStyles.createCanvasContainer();
        canvasContainer.style.height = '300px';
        const canvas = InjectedStyles.createCanvas();
        canvasContainer.appendChild(canvas);
        wrapper.appendChild(canvasContainer);
        container.appendChild(wrapper);

        // Panneau du donut de Bankin à sa taille (classe h100 : toute la hauteur
        // de la page), comme sur la page Catégories
        const fitPanels = () => new BankinPage(document).categoryChartPanels().forEach((panel) => panel.classList.remove('h100'));
        fitPanels();
        setTimeout(fitPanels, 1000);

        // Couleur de Bankin de la catégorie (de la parente pour une sous-catégorie seule)
        const colorId = this.category.parentId ?? this.category.id;
        const base = ColorParser.parseColorCSS(`categoryColor_${colorId}`);
        const baseColor = base && !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(base) ? base : THEME.accent;
        const shade = (alpha) => CategoryHistoryChart.withAlpha(baseColor, alpha);
        const last = history.months.length - 1;
        const labels = history.months.map((m) => {
            const [year, mon] = m.split('-').map(Number);
            return new Date(year, mon - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        });

        const datasets = history.series.map((s, i) => ({
            label: s.label,
            data: s.values,
            backgroundColor: s.id == null ? OTHERS_COLOR : shade(SHADES[i] ?? SHADES.at(-1)),
            // Mois affiché par Bankin : encadré
            borderColor: history.months.map((_, j) => (j === last ? THEME.text : 'transparent')),
            borderWidth: history.months.map((_, j) => (j === last ? 2 : 0)),
            stack: 'mois',
            order: 1,
        }));
        datasets.push(/** @type {any} */ ({
            type: 'line',
            label: 'Médiane des 12 mois précédents',
            data: history.months.map(() => history.median),
            borderColor: THEME.textMuted,
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 0,
        }));

        this.chartInstance = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: { callback: (value) => (Config.isBlurry() ? '' : formatNumber(Number(value))) },
                    },
                },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                return Config.isBlurry() ? label : `${label} : ${formatEuros(Number(context.parsed.y))}`;
                            },
                            footer: (items) => {
                                if (Config.isBlurry() || !items.length) return '';
                                return `Total : ${formatEuros(history.totals[items[0].dataIndex])}`;
                            },
                        },
                    },
                },
            },
        });
        BaseChartData._attachAmountVisibilityListener(this.chartInstance);
        return this.chartInstance;
    }
}
