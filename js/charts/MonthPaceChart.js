import { Config } from '../core/Config.js';
import { DateRange } from '../core/DateRange.js';
import { Chart } from '../lib/chart.js';
import { InjectedStyles } from '../ui/InjectedStyles.js';
import { THEME } from '../ui/theme.js';
import { formatEuros, formatNumber } from '../utils/format.js';
import { BaseChartData } from './base/BaseChartData.js';
import { deltaText } from './budgetComparison.js';
import { buildMonthPace } from './monthPace.js';

/**
 * Rythme du mois (page Catégories, lot UX-3a) : dépenses cumulées du mois
 * affiché face au rythme habituel.
 */
export class MonthPaceChart extends BaseChartData {
    /**
     * @param {object[]} transactions
     * @param {object[]} categories
     * @param {string[]} monthParams mois affiché par Bankin (« octobre », « 2026 »)
     * @param {object} [settingsInstance]
     */
    constructor(transactions, categories, monthParams, settingsInstance = null) {
        super(transactions, categories, null, null, settingsInstance);
        this.monthParams = monthParams;
        this.chartInstance = null;
        /** Date du jour (remplaçable dans les tests). */
        this.now = () => new Date();
    }

    /** Catégories de revenus (« Entrées d'argent » et ses sous-catégories), ignorées. */
    _incomeCategoryIds() {
        const income = this.categories?.find((c) => c?.id === Config.CATEGORIES.BUDGET_CATEGORY_ID);
        return new Set([Config.CATEGORIES.BUDGET_CATEGORY_ID, ...(income?.categories || []).map((c) => c.id)]);
    }

    prepareData() {
        const month = DateRange.monthIndexFromLabel(this.monthParams?.[0]);
        const year = parseInt(String(this.monthParams?.[1]), 10);
        if (month == null || Number.isNaN(year)) return null;
        this.pace = buildMonthPace({
            transactions: this.transactions || [],
            month: { year, month },
            today: this.now(),
            incomeCategoryIds: this._incomeCategoryIds(),
        });
        return this.pace;
    }

    /**
     * Phrase de synthèse : « Au 22 : 1 310,53 € dépensés, contre 1 490,00 € d'habitude à cette date, écart −12 % ».
     * @param {ReturnType<typeof buildMonthPace>} pace
     * @param {boolean} hideAmounts
     */
    static summary(pace, hideAmounts) {
        if (pace.lastDay === 0) return 'Mois à venir : pas encore de dépenses.';
        const wholeMonth = pace.lastDay === pace.days.length;
        const when = wholeMonth ? 'Sur le mois' : `Au ${pace.lastDay}`;
        const delta = pace.delta == null ? null : deltaText(pace.delta);
        if (hideAmounts) return delta ? `${when} : ${delta} avec le rythme habituel` : when;
        const base = `${when} : ${formatEuros(pace.spent)} dépensés`;
        const usual = wholeMonth ? 'sur un mois habituel' : "d'habitude à cette date";
        return delta ? `${base}, contre ${formatEuros(pace.usual)} ${usual}, ${delta}` : base;
    }

    /**
     * Crée la carte et le graphique sous les autres graphiques de la page.
     * @param {HTMLElement} container
     */
    async render(container) {
        const pace = this.prepareData();
        if (!pace) return null;

        const wrapper = document.createElement('div');
        wrapper.className = 'pecunio-section pecunio-pace-wrapper';
        wrapper.appendChild(InjectedStyles.createTitle('Rythme du mois'));
        const summary = document.createElement('p');
        summary.className = 'pecunio-budget-summary';
        BaseChartData.bindAmountText(summary, (hide) => MonthPaceChart.summary(pace, hide));
        wrapper.appendChild(summary);
        const canvasContainer = InjectedStyles.createCanvasContainer();
        canvasContainer.style.height = '260px';
        const canvas = InjectedStyles.createCanvas();
        canvasContainer.appendChild(canvas);
        wrapper.appendChild(canvasContainer);
        container.appendChild(wrapper);

        this.chartInstance = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: pace.days.map(String),
                datasets: [
                    {
                        label: 'Ce mois-ci',
                        data: pace.current,
                        borderColor: THEME.accent,
                        backgroundColor: 'rgba(101, 98, 252, 0.12)',
                        fill: true,
                        borderWidth: 3,
                        pointRadius: 0,
                        tension: 0.2,
                        spanGaps: false,
                    },
                    {
                        label: 'Habituellement (médiane des 12 mois précédents)',
                        data: pace.reference,
                        borderColor: THEME.textMuted,
                        borderDash: [6, 4],
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.2,
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { title: { display: true, text: 'Jour du mois' }, grid: { display: false }, ticks: { maxTicksLimit: 16 } },
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (value) => (Config.isBlurry() ? '' : formatNumber(Number(value))) },
                    },
                },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            title: (items) => (items.length ? `Jour ${items[0].label}` : ''),
                            label: (context) => {
                                const label = context.dataset.label || '';
                                if (Config.isBlurry() || context.parsed.y == null) return label;
                                return `${label} : ${formatEuros(Number(context.parsed.y))}`;
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
